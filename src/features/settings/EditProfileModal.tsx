import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { UseMutationResult } from '@tanstack/react-query';
import type { ProfilePatch, ProfileRow } from '@/shared/api/profileService';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import modalStyles from '../plan/AddPlaceModal.module.css';

interface EditProfileModalProps {
  onClose: () => void;
  profile: ProfileRow | undefined;
  updateProfile: UseMutationResult<void, Error, ProfilePatch>;
}

const MAX_NAME_LENGTH = 30;

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

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t('profile.nameRequired'));
      return;
    }
    updateProfile.mutate(
      { display_name: trimmed },
      {
        onSuccess: onClose,
        onError: () => setError(t('profile.saveError')),
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
            <input
              id="profile-name"
              className={modalStyles.input}
              value={name}
              maxLength={MAX_NAME_LENGTH}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder={t('profile.namePlaceholder')}
              autoComplete="nickname"
            />
            <p className={modalStyles.hint}>{t('profile.nameHint')}</p>
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
            <button type="submit" className={modalStyles.primary} disabled={updateProfile.isPending}>
              {t('common:action.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
