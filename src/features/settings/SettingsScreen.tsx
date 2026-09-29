import { useEffect, useState } from 'react';
import { normalizeLocale } from '@/shared/i18n';
import { LANGUAGE_AUTONYMS } from '@/shared/i18n/languageNames';
import { useTranslation } from 'react-i18next';
import { useSession } from '@/shared/hooks/useSession';
import { useProfile, useUpdateProfile } from '@/shared/hooks/useProfile';
import { useTrips } from '@/features/plan/hooks/useTrips';
import { signOut } from '@/shared/api/authService';
import { captureError, trackScreenView } from '@/shared/monitoring';
import { LoginButtons } from '@/features/auth/LoginButtons';
import { BackupModal } from '@/features/plan/BackupModal';
import { getStoredTheme, setTheme, type ThemePreference } from '@/shared/theme';
import { registerPushNotifications } from '@/shared/push/registerPush';
import { clearOfflineCache } from '@/shared/offline/persister';
import type { NotificationPrefs } from '@/shared/api/profileService';
import { DeleteAccountFlow } from './DeleteAccountFlow';
import { LicensesModal } from './LicensesModal';
import { BlockedUsersList } from './BlockedUsersList';
import { User, Palette, Bell, HardDrive, Globe, Info, Sun, Moon, Monitor } from 'lucide-react';

import { EditProfileModal } from './EditProfileModal';
import { UnitSettingsModal } from './UnitSettingsModal';
import { LanguageModal } from './LanguageModal';
import { CurrencyModal } from './CurrencyModal';
import { FeedbackModal } from './FeedbackModal';

import styles from './SettingsScreen.module.css';

const APP_VERSION = '1.0.2';

const NOTIFICATION_LABEL_KEYS: Record<keyof NotificationPrefs, string> = {
  preDeparture: 'notifications.preDeparture',
  flightChanges: 'notifications.flightChanges',
  communityReplies: 'notifications.communityReplies',
  marketing: 'notifications.marketing',
};

/** 이 사이트가 이 기기에서 실제로 쓰는 저장 공간(MB). 잴 수 없는 환경이면 null */
async function readCacheUsageMB(): Promise<number | null> {
  if (!navigator.storage?.estimate) return null;
  try {
    const estimate = await navigator.storage.estimate();
    return (estimate.usage ?? 0) / (1024 * 1024);
  } catch {
    return null;
  }
}

/**
 * 설정 탭 (02-screens.md §5)
 * 계정 섹션은 기존과 동일. 환경설정(테마 실동작, 온도단위 실동작, 나머지는
 * profiles 컬럼에 저장만 — 언어 실제 전환·거리단위 지도 반영은 Phase 6
 * i18n/§6.4 이관 이후), 알림(발송 파이프라인 없이 설정값만 저장, Phase 6에서
 * 소비), 데이터(백업 JSON 내보내기/가져오기 연동 + 오프라인 캐시 삭제),
 * 정보(약관/개인정보처리방침/오픈소스 라이선스/문의하기) 섹션을 채운다.
 */
export function SettingsScreen() {
  const { t, i18n } = useTranslation(['settings', 'common']);
  const { user, loading } = useSession();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const trips = useTrips();
  const [showDeleteFlow, setShowDeleteFlow] = useState(false);
  const [showBackup, setShowBackup] = useState(false);
  const [showLicenses, setShowLicenses] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showUnitSettings, setShowUnitSettings] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  const [theme, setThemeState] = useState<ThemePreference>(() => getStoredTheme());
  const [cacheUsageMB, setCacheUsageMB] = useState<number | null>(null);
  const [clearingCache, setClearingCache] = useState(false);

  useEffect(() => {
    trackScreenView('settings');
  }, []);

  useEffect(() => {
    void readCacheUsageMB().then((mb) => {
      if (mb != null) setCacheUsageMB(mb);
    });
  }, []);

  if (showDeleteFlow) {
    return <DeleteAccountFlow />;
  }

  function handleThemeChange(next: ThemePreference) {
    setTheme(next);
    setThemeState(next);
  }

  async function handleClearCache() {
    setClearingCache(true);
    try {
      // 앱 셸 캐시(오프라인으로 앱을 여는 데 필요)는 남기고, 사진 캐시와 저장된 여행 데이터만 비운다
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key.startsWith('triptic-images')).map((key) => caches.delete(key)));
      await clearOfflineCache();
      const mb = await readCacheUsageMB();
      if (mb != null) setCacheUsageMB(mb);
    } catch (err) {
      captureError(err, { context: 'clearOfflineCache' });
    } finally {
      setClearingCache(false);
    }
  }

  function updateNotificationPref(key: keyof NotificationPrefs, value: boolean) {
    const base: NotificationPrefs = profile?.notification_prefs ?? {
      preDeparture: true,
      flightChanges: true,
      communityReplies: true,
      marketing: false,
    };
    updateProfile.mutate({ notification_prefs: { ...base, [key]: value } });
    // 알림을 처음 켜는 순간 디바이스 토큰을 등록한다(네이티브 앱에서만 동작,
    // 실제 발송 파이프라인은 아직 없다 — src/shared/push/registerPush.ts 참고).
    if (value && user) {
      registerPushNotifications(user.id).catch((err) => captureError(err, { context: 'registerPushNotifications' }));
    }
  }

  return (
    <div className={styles.container}>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}><User size={18}/> {t('section.account')}</h2>
        <div className={styles.card}>
        {loading ? null : user ? (
          <>
            <div className={styles.profileHeader}>
              <img src={user.user_metadata?.avatar_url || 'https://api.dicebear.com/7.x/notionists/svg?seed=' + user.email} alt="Profile" className={styles.avatar} />
              <div className={styles.profileInfo}>
                <span className={styles.profileName}>{profile?.display_name || user.user_metadata?.name || t('account.fallbackName')}</span>
                {profile?.handle ? <span className={styles.profileHandle}>@{profile.handle}</span> : null}
                <span className={styles.profileEmail}>{user.email}</span>
              </div>
            </div>
            <div className={styles.row}>
              <button type="button" className={styles.linkButton} onClick={() => setShowEditProfile(true)}>
                {t('account.editProfile')}
              </button>
            </div>
            <div className={styles.row}>
              <button
                type="button"
                className={styles.linkButton}
                onClick={() => signOut().catch((err) => captureError(err, { context: 'signOut' }))}
              >
                {t('account.signOut')}
              </button>
            </div>
            <div className={styles.row}>
              <button
                type="button"
                className={styles.dangerLink}
                onClick={() => setShowDeleteFlow(true)}
              >
                {t('account.deleteAction')}
              </button>
            </div>
          </>
        ) : (
          <LoginButtons />
        )}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}><Palette size={18}/> {t('section.preferences')}</h2>
        <div className={styles.card}>
        <div className={styles.row}>
          <span>{t('preferences.theme')}</span>
          <div className={styles.themeToggleGroup}>
            <button type="button" className={theme === 'light' ? styles.themeToggleActive : styles.themeToggleBtn} onClick={() => handleThemeChange('light')} aria-label={t('preferences.themeLight')} aria-pressed={theme === 'light'}><Sun size={18}/></button>
            <button type="button" className={theme === 'dark' ? styles.themeToggleActive : styles.themeToggleBtn} onClick={() => handleThemeChange('dark')} aria-label={t('preferences.themeDark')} aria-pressed={theme === 'dark'}><Moon size={18}/></button>
            <button type="button" className={theme === 'system' ? styles.themeToggleActive : styles.themeToggleBtn} onClick={() => handleThemeChange('system')} aria-label={t('preferences.themeSystem')} aria-pressed={theme === 'system'}><Monitor size={18}/></button>
          </div>
        </div>
        {user ? (
          <>
            <button type="button" className={`${styles.row} ${styles.rowButton}`} onClick={() => setShowUnitSettings(true)}>
              <span>{t('preferences.unitSettings')}</span>
              <span style={{color: 'var(--text-muted)'}}>{profile?.temp_unit === 'f' ? '°F' : '°C'}, {profile?.distance_unit === 'mi' ? 'mi' : 'km'} &gt;</span>
            </button>
            <button type="button" className={`${styles.row} ${styles.rowButton}`} onClick={() => setShowCurrencyModal(true)}>
              <span>{t('preferences.baseCurrency')}</span>
              <span style={{color: 'var(--text-muted)'}}>{profile?.base_currency ?? 'KRW'} &gt;</span>
            </button>
            <button type="button" className={`${styles.row} ${styles.rowButton}`} onClick={() => setShowLanguageModal(true)}>
              <span>{t('preferences.language')}</span>
              <span style={{color: 'var(--text-muted)'}}>{LANGUAGE_AUTONYMS[normalizeLocale(i18n.language)]} &gt;</span>
            </button>
          </>
        ) : (
          <p className={styles.hint}>{t('preferences.loginHint')}</p>
        )}
        </div>
      </section>

      {user ? (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}><Bell size={18}/> {t('section.notifications')}</h2>
        <div className={styles.card}>
          {(Object.keys(NOTIFICATION_LABEL_KEYS) as (keyof NotificationPrefs)[]).map((key) => (
            <label className={styles.row} key={key}>
              <span>{t(NOTIFICATION_LABEL_KEYS[key])}</span>
              <input
                type="checkbox"
                checked={profile?.notification_prefs?.[key] ?? key !== 'marketing'}
                onChange={(e) => updateNotificationPref(key, e.target.checked)}
              />
            </label>
          ))}
          <p className={styles.hint}>{t('notifications.hint')}</p>
        </div>
        </section>
      ) : null}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}><HardDrive size={18}/> {t('section.data')}</h2>
        <div className={styles.card}>
        <div className={styles.row}>
          <span>{t('data.offlineCache')}</span>
          <span>{cacheUsageMB == null ? t('data.calculating') : `${cacheUsageMB.toFixed(1)}MB`}</span>
        </div>
        <div className={styles.row}>
          <button type="button" className={styles.linkButton} onClick={handleClearCache} disabled={clearingCache}>
            {clearingCache ? t('data.clearingCache') : t('data.clearCache')}
          </button>
        </div>
        <div className={styles.row}>
          <button type="button" className={styles.linkButton} onClick={() => setShowBackup(true)}>
            {t('data.backup')}
          </button>
        </div>
        <p className={styles.hint}>{t('data.pdfHint')}</p>
        </div>
      </section>

      {user ? (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}><Globe size={18}/> {t('section.community')}</h2>
        <div className={styles.card}>
          <BlockedUsersList userId={user.id} />
        </div>
        </section>
      ) : null}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}><Info size={18}/> {t('section.about')}</h2>
        <div className={styles.card}>
        <div className={styles.row}>
          <a href="/terms.html" target="_blank" rel="noopener" className={styles.linkButton}>
            {t('legal.terms', { ns: 'common' })}
          </a>
        </div>
        <div className={styles.row}>
          <a href="/privacy.html" target="_blank" rel="noopener" className={styles.linkButton}>
            {t('legal.privacy', { ns: 'common' })}
          </a>
        </div>
        <div className={styles.row}>
          <button type="button" className={styles.linkButton} onClick={() => setShowLicenses(true)}>
            {t('licenses.title')}
          </button>
        </div>
        <div className={styles.row}>
          <button type="button" className={styles.linkButton} onClick={() => setShowFeedback(true)}>
            {t('feedback.menuLabel')}
          </button>
        </div>
        <p className={styles.row}>{t('about.version', { version: APP_VERSION })}</p>
        </div>
      </section>

      {showBackup ? (
        <BackupModal trips={trips.data ?? []} onClose={() => setShowBackup(false)} onImported={() => trips.refetch()} />
      ) : null}
      {showLicenses ? <LicensesModal onClose={() => setShowLicenses(false)} /> : null}
      {showEditProfile ? <EditProfileModal onClose={() => setShowEditProfile(false)} profile={profile} updateProfile={updateProfile} /> : null}
      {showUnitSettings ? <UnitSettingsModal onClose={() => setShowUnitSettings(false)} profile={profile} updateProfile={updateProfile} /> : null}
      {showCurrencyModal ? <CurrencyModal onClose={() => setShowCurrencyModal(false)} profile={profile} updateProfile={updateProfile} /> : null}
      {showLanguageModal ? <LanguageModal onClose={() => setShowLanguageModal(false)} profile={profile} updateProfile={updateProfile} /> : null}
      {showFeedback ? <FeedbackModal onClose={() => setShowFeedback(false)} /> : null}
    </div>
  );
}
