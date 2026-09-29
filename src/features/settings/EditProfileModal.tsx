import { useRef, useState, type FormEvent } from 'react';
import { flagInvalid } from '@/shared/ui/invalidField';
import { useTranslation } from 'react-i18next';
import type { UseMutationResult } from '@tanstack/react-query';
import { checkDisplayNameAvailable, type ProfilePatch, type ProfileRow } from '@/shared/api/profileService';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import modalStyles from '../plan/AddPlaceModal.module.css';
import styles from './EditProfileModal.module.css';

interface EditProfileModalProps {
  onClose: () => void;
  profile: ProfileRow | undefined;
  updateProfile: UseMutationResult<void, Error, ProfilePatch>;
}

const MAX_NAME_LENGTH = 7;
const DISPLAY_NAME_REGEX = /^[가-힣]{2,7}$/; // i18n-exempt: 문자열이 아니라 한글 유니코드 범위를 검사하는 정규식

function getErrorHint(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'hint' in err) {
    return (err as { hint?: string }).hint;
  }
  return undefined;
}

/**
 * 내 정보 변경 — 표시 이름(profiles.display_name). 커뮤니티 글·동행자 목록에 보이는 이름이다.
 * (예전 화면의 휴대폰 인증은 실제 발송 없이 '1234'만 통과시키는 목업이었고, 존재하지 않는
 * nickname/phone 컬럼에 저장하려다 실패하고 있었다 — 제거)
 */
export function EditProfileModal({ onClose, profile, updateProfile }: EditProfileModalProps) {
  const { t } = useTranslation(['settings', 'common']);
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);
  const [name, setName] = useState(profile?.display_name ?? '');
  const [error, setError] = useState<string | null>(null);
  const [checkState, setCheckState] = useState<'idle' | 'checking' | 'available'>('idle');
  const [checking, setChecking] = useState(false);
  const checkedNameRef = useRef<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const nameChanged = name.trim() !== (profile?.display_name ?? '');

  function handleNameChange(value: string) {
    setName(value);
    setError(null);
    setCheckState('idle');
  }

  async function handleCheckDuplicate() {
    const trimmed = name.trim();
    if (!DISPLAY_NAME_REGEX.test(trimmed)) {
      setError(t('profile.nameFormatError'));
      flagInvalid(nameInputRef.current);
      return;
    }
    if (!profile) return;
    setChecking(true);
    setError(null);
    try {
      const available = await checkDisplayNameAvailable(trimmed, profile.id);
      checkedNameRef.current = trimmed;
      if (available) {
        setCheckState('available');
      } else {
        setCheckState('idle');
        setError(t('profile.nameTaken'));
      }
    } catch {
      setCheckState('idle');
      setError(t('profile.saveError'));
    } finally {
      setChecking(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t('profile.nameRequired'));
      flagInvalid(nameInputRef.current);
      return;
    }
    if (!nameChanged) {
      onClose();
      return;
    }
    if (!DISPLAY_NAME_REGEX.test(trimmed)) {
      setError(t('profile.nameFormatError'));
      flagInvalid(nameInputRef.current);
      return;
    }
    if (checkState !== 'available' || checkedNameRef.current !== trimmed) {
      setError(t('profile.nameCheckRequired'));
      flagInvalid(nameInputRef.current);
      return;
    }
    updateProfile.mutate(
      { display_name: trimmed },
      {
        onSuccess: onClose,
        onError: (err) => {
          const hint = getErrorHint(err);
          if (hint === 'duplicate_display_name') setError(t('profile.nameTaken'));
          else if (hint === 'reserved_display_name') setError(t('profile.nameReserved'));
          else if (hint === 'invalid_display_name') setError(t('profile.nameFormatError'));
          else setError(t('profile.saveError'));
        },
      },
    );
  }

  return (
    <div className={modalStyles.overlay} onClick={onClose}>
      <div
        ref={trapRef}
        className={modalStyles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-profile-title"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          <h2 id="edit-profile-title">{t('profile.title')}</h2>
          <div className={modalStyles.field}>
            <label className={modalStyles.label} htmlFor="profile-name">
              {t('profile.nameLabel')}
            </label>
            <div className={styles.nameRow}>
              <input
                ref={nameInputRef}
                id="profile-name"
                className={modalStyles.input}
                value={name}
                maxLength={MAX_NAME_LENGTH}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder={t('profile.namePlaceholder')}
                autoComplete="nickname"
              />
              <button
                type="button"
                className={styles.checkBtn}
                onClick={handleCheckDuplicate}
                disabled={!nameChanged || checking || !profile}
              >
                {checking ? t('profile.checking') : t('profile.checkDuplicate')}
              </button>
            </div>
            <p className={modalStyles.hint}>{t('profile.nameHint')}</p>
            {!error && checkState === 'available' ? (
              <p className={`${modalStyles.hint} ${styles.available}`}>{t('profile.nameAvailable')}</p>
            ) : null}
            {error ? (
              <p className={modalStyles.error} role="alert">
                {error}
              </p>
            ) : null}
          </div>
          <div className={modalStyles.actions}>
            <button type="button" className={modalStyles.secondary} onClick={onClose}>
              {t('common:action.cancel')}
            </button>
            <button
              type="submit"
              className={modalStyles.primary}
              disabled={updateProfile.isPending}
            >
              {t('common:action.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
