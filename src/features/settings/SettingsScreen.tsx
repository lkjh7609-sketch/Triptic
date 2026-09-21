import { useEffect, useState } from 'react';
import { useSession } from '@/shared/hooks/useSession';
import { useProfile, useUpdateProfile } from '@/shared/hooks/useProfile';
import { useTrips } from '@/features/plan/hooks/useTrips';
import { signOut } from '@/shared/api/authService';
import { captureError, trackScreenView } from '@/shared/monitoring';
import { LoginButtons } from '@/features/auth/LoginButtons';
import { BackupModal } from '@/features/plan/BackupModal';
import { CURRENCIES } from '@/features/plan/expenses';
import { getStoredTheme, setTheme, type ThemePreference } from '@/shared/theme';
import type { DistanceUnit, Locale, NotificationPrefs, TempUnit } from '@/shared/api/profileService';
import { DeleteAccountFlow } from './DeleteAccountFlow';
import { LicensesModal } from './LicensesModal';
import styles from './SettingsScreen.module.css';

const APP_VERSION = '3.0.0-dev';
const CONTACT_EMAIL = 'lkjh7609@gmail.com';

const NOTIFICATION_LABELS: Record<keyof NotificationPrefs, string> = {
  preDeparture: '출발 전 리마인더',
  flightChanges: '항공편 변경',
  communityReplies: '커뮤니티 답글',
  marketing: '마케팅 소식',
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
  }

  return (
    <div>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>계정</h2>
        {loading ? null : user ? (
          <>
            <div className={styles.userInfo}>
              <span>{user.email ?? user.user_metadata?.name ?? '내 계정'}</span>
            </div>
            <div className={styles.row}>
              <button
                type="button"
                className={styles.linkButton}
                onClick={() => signOut().catch((err) => captureError(err, { context: 'signOut' }))}
              >
                로그아웃
              </button>
            </div>
            <div className={styles.row}>
              <button
                type="button"
                className={styles.dangerLink}
                onClick={() => setShowDeleteFlow(true)}
              >
                계정 삭제
              </button>
            </div>
          </>
        ) : (
          <LoginButtons />
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>환경설정</h2>
        <div className={styles.row}>
          <span>테마</span>
          <select
            className={styles.select}
            value={theme}
            onChange={(e) => handleThemeChange(e.target.value as ThemePreference)}
          >
            <option value="system">시스템</option>
            <option value="light">라이트</option>
            <option value="dark">다크</option>
          </select>
        </div>

        {user ? (
          <>
            <div className={styles.row}>
              <span>온도 단위</span>
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
              <span>거리 단위</span>
              <select
                className={styles.select}
                value={profile?.distance_unit ?? 'km'}
                onChange={(e) => updateProfile.mutate({ distance_unit: e.target.value as DistanceUnit })}
              >
                <option value="km">km</option>
                <option value="mi">mi</option>
              </select>
            </div>
            <p className={styles.hint}>거리 단위는 지도·경로 표시에는 아직 반영되지 않아요.</p>
            <div className={styles.row}>
              <span>기본 통화</span>
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
              <span>언어</span>
              <select
                className={styles.select}
                value={profile?.locale ?? 'ko'}
                onChange={(e) => updateProfile.mutate({ locale: e.target.value as Locale })}
              >
                <option value="ko">한국어</option>
                <option value="en">English</option>
                <option value="zh-CN">简体中文</option>
              </select>
            </div>
            <p className={styles.hint}>표시 언어 전환은 다음 업데이트에서 지원돼요. 지금은 설정만 저장돼요.</p>
          </>
        ) : (
          <p className={styles.hint}>로그인하면 온도·거리 단위, 기본 통화, 언어 설정을 저장할 수 있어요.</p>
        )}
      </section>

      {user ? (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>알림</h2>
          {(Object.keys(NOTIFICATION_LABELS) as (keyof NotificationPrefs)[]).map((key) => (
            <label className={styles.row} key={key}>
              <span>{NOTIFICATION_LABELS[key]}</span>
              <input
                type="checkbox"
                checked={profile?.notification_prefs?.[key] ?? key !== 'marketing'}
                onChange={(e) => updateNotificationPref(key, e.target.checked)}
              />
            </label>
          ))}
          <p className={styles.hint}>실제 알림 발송은 다음 업데이트에서 지원돼요. 지금은 설정만 저장돼요.</p>
        </section>
      ) : null}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>데이터</h2>
        <div className={styles.row}>
          <span>오프라인 캐시</span>
          <span>{cacheUsageMB == null ? '계산 중…' : `${cacheUsageMB.toFixed(1)}MB`}</span>
        </div>
        <div className={styles.row}>
          <button type="button" className={styles.linkButton} onClick={handleClearCache} disabled={clearingCache}>
            {clearingCache ? '지우는 중…' : '캐시 지우기'}
          </button>
        </div>
        <div className={styles.row}>
          <button type="button" className={styles.linkButton} onClick={() => setShowBackup(true)}>
            📤 내보내기 / 📥 가져오기 (JSON)
          </button>
        </div>
        <p className={styles.hint}>여행별 PDF 내보내기는 여행 상세의 공유(↗) 버튼에서 할 수 있어요.</p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>정보</h2>
        <div className={styles.row}>
          <a href="/terms.html" target="_blank" rel="noopener" className={styles.linkButton}>
            이용약관
          </a>
        </div>
        <div className={styles.row}>
          <a href="/privacy.html" target="_blank" rel="noopener" className={styles.linkButton}>
            개인정보처리방침
          </a>
        </div>
        <div className={styles.row}>
          <button type="button" className={styles.linkButton} onClick={() => setShowLicenses(true)}>
            오픈소스 라이선스
          </button>
        </div>
        <div className={styles.row}>
          <a href={`mailto:${CONTACT_EMAIL}`} className={styles.linkButton}>
            문의하기
          </a>
        </div>
        <p className={styles.row}>버전 {APP_VERSION}</p>
      </section>

      {showBackup ? (
        <BackupModal trips={trips.data ?? []} onClose={() => setShowBackup(false)} onImported={() => trips.refetch()} />
      ) : null}
      {showLicenses ? <LicensesModal onClose={() => setShowLicenses(false)} /> : null}
    </div>
  );
}
