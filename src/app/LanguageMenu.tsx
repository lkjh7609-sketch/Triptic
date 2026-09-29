import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Globe } from 'lucide-react';
import { SUPPORTED_LOCALES, normalizeLocale } from '@/shared/i18n';
import { LANGUAGE_AUTONYMS } from '@/shared/i18n/languageNames';
import styles from './HeaderDesktop.module.css';

/**
 * PC 헤더 지구본 메뉴 — 로그인하지 않아도 표시 언어를 바꾼다(로그인 버튼 왼쪽).
 * 고르면 바로 바뀌고 이 브라우저에 저장된다. 로그인하면 프로필 언어가 우선한다(useSyncLocale).
 */
export function LanguageMenu() {
  const { t, i18n } = useTranslation('common');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const current = normalizeLocale(i18n.language);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className={styles.languageWrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.languageButton}
        onClick={() => setOpen((v) => !v)}
        aria-label={t('menu.language')}
        title={t('menu.language')}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Globe size={20} strokeWidth={1.6} aria-hidden="true" />
      </button>
      <div className={`${styles.dropdown} ${styles.languageDropdown} ${open ? styles.open : ''}`} role="menu" hidden={!open}>
        {SUPPORTED_LOCALES.map((code) => (
          <button
            key={code}
            type="button"
            role="menuitemradio"
            aria-checked={code === current}
            lang={code}
            className={styles.dropdownItem}
            onClick={() => {
              setOpen(false);
              if (code !== current) void i18n.changeLanguage(code);
            }}
          >
            <span className={styles.languageName}>{LANGUAGE_AUTONYMS[code]}</span>
            {code === current ? <Check size={16} aria-hidden="true" /> : null}
          </button>
        ))}
      </div>
    </div>
  );
}
