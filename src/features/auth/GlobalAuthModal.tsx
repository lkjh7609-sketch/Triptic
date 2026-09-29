import { useRef, useState } from 'react';
import { ChevronDown, Sparkles, X } from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { SAMPLE_TRIP_ID } from '@/features/plan/sampleTrip';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import { BrandLogo } from '@/shared/ui/BrandLogo';
import { flagInvalid } from '@/shared/ui/invalidField';
import { LoginButtons } from './LoginButtons';
import { EmailAuthForm } from './EmailAuthForm';
import styles from './GlobalAuthModal.module.css';

interface GlobalAuthModalProps {
  /** 샘플 여행 체험 중에 띄운 경우에만 넘긴다 — 닫으면 샘플로 돌아간다 */
  onClose?: () => void;
  /** 한마디 아래 덧붙일 안내(예: 공유 링크로 들어온 사람에게 "로그인하면 함께 편집") */
  notice?: string;
}

/**
 * 로그인 화면 (02-screens.md §6). 모바일 비로그인은 앱 전체가 이 화면으로 막히고, 로그인 없이
 * 체험할 수 있는 건 샘플 여행 하나뿐이다(체험 중엔 AppShell의 GuestBanner). PC는 둘러보다가
 * 로그인이 필요할 때 닫을 수 있는 창(onClose)으로 뜬다.
 */
export function GlobalAuthModal({ onClose, notice }: GlobalAuthModalProps) {
  const { t } = useTranslation();
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);
  const [agreed, setAgreed] = useState(false);
  const [consentMissing, setConsentMissing] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const emailToggleRef = useRef<HTMLButtonElement>(null);
  const consentLabelRef = useRef<HTMLLabelElement>(null);

  function handleAgreedChange(next: boolean) {
    setAgreed(next);
    if (next) setConsentMissing(false);
  }

  // 동의 전에 로그인·가입을 누르면 동의 체크박스로 눈길을 돌린다
  function handleConsentMissing() {
    setConsentMissing(true);
    flagInvalid(consentLabelRef.current);
  }

  function toggleEmail() {
    const next = !emailOpen;
    setEmailOpen(next);
    // 펼쳐진 폼이 화면 아래로 밀려 안 보이지 않게, 펼침이 끝날 즈음 이메일 영역 맨 위로 스크롤
    if (next) window.setTimeout(() => emailToggleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 320);
  }

  return (
    // 바깥(어두운 배경)을 눌러도 닫히지 않는다 — 닫기는 X로만
    <div className={onClose ? `${styles.overlay} ${styles.overlayFloating}` : styles.overlay}>
      <div
        ref={trapRef}
        className={onClose ? `${styles.modal} ${styles.modalFloating}` : styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
      >
        {onClose ? (
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label={t('action.close')}>
            <X size={20} />
          </button>
        ) : null}

        <div className={styles.header}>
          <h1 id="auth-title" className={styles.brand}>
            <BrandLogo className={styles.brandLogo} />
          </h1>
          {/* 로그인을 재촉하는 문구 대신 앱 한마디 */}
          <p className={styles.subtitle}>{t('auth.tagline')}</p>
          {notice ? <p className={styles.notice}>{notice}</p> : null}
        </div>

        <LoginButtons consent={{ agreed, onMissing: handleConsentMissing }} />

        <div className={styles.emailSection}>
          <button
            ref={emailToggleRef}
            type="button"
            className={styles.emailToggle}
            aria-expanded={emailOpen}
            aria-controls="auth-email-panel"
            onClick={toggleEmail}
          >
            {t('auth.email.toggle')}
            <ChevronDown size={16} aria-hidden="true" className={emailOpen ? styles.chevronOpen : styles.chevron} />
          </button>
          {/* 소셜 로그인·이메일 가입 공용 동의 — 이메일 가입하기 바로 아래 */}
          <div className={styles.consentBox}>
            <label ref={consentLabelRef} className={styles.consent}>
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => handleAgreedChange(e.target.checked)}
                aria-describedby={consentMissing ? 'auth-consent-hint' : undefined}
              />
              <span>
                <Trans
                  t={t}
                  i18nKey="auth.consent"
                  components={{
                    terms: <a href="/terms.html" target="_blank" rel="noopener" />,
                    privacy: <a href="/privacy.html" target="_blank" rel="noopener" />,
                  }}
                />
              </span>
            </label>
            {consentMissing ? (
              <p id="auth-consent-hint" className={styles.consentHint} role="alert">
                {t('auth.consentRequired')}
              </p>
            ) : null}
          </div>
          {/* 접혀 있는 동안은 visibility:hidden이라 탭 이동·스크린리더에서 빠진다 */}
          <div
            id="auth-email-panel"
            className={emailOpen ? `${styles.emailPanel} ${styles.emailPanelOpen}` : styles.emailPanel}
          >
            <div className={styles.emailPanelInner}>
              <EmailAuthForm agreed={agreed} onConsentMissing={handleConsentMissing} />
            </div>
          </div>
        </div>

        {onClose ? null : (
          <div className={styles.sampleBox}>
            <span className={styles.sampleHint}>{t('auth.sampleHint')}</span>
            <Link to={`/plan/${SAMPLE_TRIP_ID}`} className={styles.sampleLink}>
              <Sparkles size={16} aria-hidden="true" /> {t('auth.trySample')}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
