import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from '@/shared/hooks/useSession';
import { useProfile, useUpdateProfile } from '@/shared/hooks/useProfile';
import { useTrips } from '@/features/plan/hooks/useTrips';
import { signOut } from '@/shared/api/authService';
import { captureError, trackScreenView } from '@/shared/monitoring';
import { LoginButtons } from '@/features/auth/LoginButtons';
import { BackupModal } from '@/features/plan/BackupModal';
import { CURRENCIES } from '@/features/plan/expenses';
import { getStoredTheme, setTheme, type ThemePreference } from '@/shared/theme';
import { registerPushNotifications } from '@/shared/push/registerPush';
import type { DistanceUnit, Locale, NotificationPrefs, TempUnit } from '@/shared/api/profileService';
import { DeleteAccountFlow } from './DeleteAccountFlow';
import { LicensesModal } from './LicensesModal';
import { BlockedUsersList } from './BlockedUsersList';
import styles from './SettingsScreen.module.css';

const APP_VERSION = '3.0.0-dev';
const CONTACT_EMAIL = 'lkjh7609@gmail.com';

const NOTIFICATION_LABEL_KEYS: Record<keyof NotificationPrefs, string> = {
  preDeparture: 'notifications.preDeparture',
  flightChanges: 'notifications.flightChanges',
  communityReplies: 'notifications.communityReplies',
  marketing: 'notifications.marketing',
};

/**
 * 설정 탭 (02-screens.md §5)
 * 계정 섹션은 기존과 동일. 환경설정(테마 실동작, 온도단위 실동작, 나머지는
 * profiles 컬럼에 저장만 — 언어 실제 전환·거리단위 지도 반영은 Phase 6
 * i18n/§6.4 이관 이후), 알림(발송 파이프라인 없이 설정값만 저장, Phase 6에서
 * 소비), 데이터(백업 JSON 내보내기/가져오기 연동 + 오프라인 캐시 삭제),
 * 정보(약관/개인정보처리방침/오픈소스 라이선스/문의하기) 섹션을 채운다.
 */
export function SettingsScreen() {
  const { t } = useTranslation(['settings', 'common']);
  const { user, loading } = useSession();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const trips = useTrips();
  const [showDeleteFlow, setShowDeleteFlow] = useState(false);
  const [showBackup, setShowBackup] = useState(false);
  const [showLicenses, setShowLicenses] = useState(false);
  const [theme, setThemeState] = useState<ThemePreference>(() => getStoredTheme());
  const [cacheUsageMB, setCacheUsageMB] = useState<number | null>(null);
  const [clearingCache, setClearingCache] = useState(false);

  useEffect(() => {
    trackScreenView('settings');
  }, []);

  useEffect(() => {
    if (!navigator.storage?.estimate) return;
    navigator.storage
      .estimate()
      .then((estimate) => setCacheUsageMB((estimate.usage ?? 0) / (1024 * 1024)))
      .catch(() => {});
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
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      setCacheUsageMB(0);
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
    <div>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('section.account')}</h2>
        {loading ? null : user ? (
          <>
            <div className={styles.userInfo}>
              <span>{user.email ?? user.user_metadata?.name ?? t('account.fallbackName')}</span>
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
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('section.preferences')}</h2>
        <div className={styles.row}>
          <span>{t('preferences.theme')}</span>
          <select
            className={styles.select}
            value={theme}
            onChange={(e) => handleThemeChange(e.target.value as ThemePreference)}
          >
            <option value="system">{t('preferences.themeSystem')}</option>
            <option value="light">{t('preferences.themeLight')}</option>
            <option value="dark">{t('preferences.themeDark')}</option>
          </select>
        </div>

        {user ? (
          <>
            <div className={styles.row}>
              <span>{t('preferences.tempUnit')}</span>
              <select
                className={styles.select}
                value={profile?.temp_unit ?? 'c'}
                onChange={(e) => updateProfile.mutate({ temp_unit: e.target.value as TempUnit })}
              >
                <option value="c">°C</option>
                <option value="f">°F</option>
              </select>
            </div>
            <div className={styles.row}>
              <span>{t('preferences.distanceUnit')}</span>
              <select
                className={styles.select}
                value={profile?.distance_unit ?? 'km'}
                onChange={(e) => updateProfile.mutate({ distance_unit: e.target.value as DistanceUnit })}
              >
                <option value="km">km</option>
                <option value="mi">mi</option>
              </select>
            </div>
            <p className={styles.hint}>{t('preferences.distanceUnitHint')}</p>
            <div className={styles.row}>
              <span>{t('preferences.baseCurrency')}</span>
              <select
                className={styles.select}
                value={profile?.base_currency ?? 'KRW'}
                onChange={(e) => updateProfile.mutate({ base_currency: e.target.value })}
              >
                {Object.keys(CURRENCIES).map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.row}>
              <span>{t('preferences.language')}</span>
              <select
                className={styles.select}
                value={profile?.locale ?? 'ko'}
                onChange={(e) => updateProfile.mutate({ locale: e.target.value as Locale })}
              >
                {/* 언어 선택지는 각 언어의 자체 표기(고유명사)로 표시한다 — UI 로케일에 따라 번역하지 않음 */}
                <option value="ko">한국어</option> {/* i18n-exempt */}
                <option value="en">English</option>
                <option value="zh-CN">简体中文</option>
              </select>
            </div>
          </>
        ) : (
          <p className={styles.hint}>{t('preferences.loginHint')}</p>
        )}
      </section>

      {user ? (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('section.notifications')}</h2>
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
        </section>
      ) : null}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('section.data')}</h2>
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
      </section>

      {user ? (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('section.community')}</h2>
          <BlockedUsersList userId={user.id} />
        </section>
      ) : null}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('section.about')}</h2>
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
          <a href={`mailto:${CONTACT_EMAIL}`} className={styles.linkButton}>
            {t('action.contact', { ns: 'common' })}
          </a>
        </div>
        <p className={styles.row}>{t('about.version', { version: APP_VERSION })}</p>
      </section>

      {showBackup ? (
        <BackupModal trips={trips.data ?? []} onClose={() => setShowBackup(false)} onImported={() => trips.refetch()} />
      ) : null}
      {showLicenses ? <LicensesModal onClose={() => setShowLicenses(false)} /> : null}
    </div>
  );
}
