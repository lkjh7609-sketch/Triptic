import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  BadgeCheck,
  Bell,
  BookOpen,
  ChevronRight,
  Code2,
  Database,
  FileText,
  Handshake,
  HardDrive,
  LifeBuoy,
  Lock,
  LogOut,
  Megaphone,
  MessageCircle,
  MessagesSquare,
  Monitor,
  MonitorSmartphone,
  Moon,
  Palette,
  Pencil,
  Plane,
  RefreshCw,
  Scale,
  ShieldCheck,
  Sun,
  Trash2,
  User,
  UserX,
  Users,
} from 'lucide-react';
import { SUPPORTED_LOCALES, normalizeLocale, type SupportedLocale } from '@/shared/i18n';
import { LANGUAGE_AUTONYMS } from '@/shared/i18n/languageNames';
import { useSession } from '@/shared/hooks/useSession';
import { useProfile, useUpdateProfile } from '@/shared/hooks/useProfile';
import { ProBadge } from '@/shared/ui/ProBadge';
import { useTrips } from '@/features/plan/hooks/useTrips';
import { CURRENCIES, currencyName } from '@/features/plan/expenses';
import { BackupModal } from '@/features/plan/BackupModal';
import { DemographicsFields } from '@/features/community/DemographicsFields';
import { signInProviderOf, signOut } from '@/shared/api/authService';
import { captureError, trackScreenView } from '@/shared/monitoring';
import { getStoredTheme, setTheme, type ThemePreference } from '@/shared/theme';
import { registerPushNotifications } from '@/shared/push/registerPush';
import { clearOfflineCache } from '@/shared/offline/persister';
import type { NotificationPrefs, ProfileRow } from '@/shared/api/profileService';
import { DeleteAccountFlow } from './DeleteAccountFlow';
import { LicensesModal } from './LicensesModal';
import { BlockedUsersList } from './BlockedUsersList';
import { EditProfileModal } from './EditProfileModal';
import { FeedbackModal } from './FeedbackModal';
import { PasswordChangeDialog } from './PasswordChangeDialog';
import { currentDeviceLabel } from './deviceInfo';
import styles from './SettingsDesktop.module.css';

const APP_VERSION = '1.0.2';

type SectionKey = 'account' | 'display' | 'matching' | 'notifications' | 'data' | 'community';

const NAV: { key: SectionKey; icon: ReactNode }[] = [
  { key: 'account', icon: <User size={18} aria-hidden="true" /> },
  { key: 'display', icon: <Palette size={18} aria-hidden="true" /> },
  { key: 'matching', icon: <BadgeCheck size={18} aria-hidden="true" /> },
  { key: 'notifications', icon: <Bell size={18} aria-hidden="true" /> },
  { key: 'data', icon: <HardDrive size={18} aria-hidden="true" /> },
  { key: 'community', icon: <Users size={18} aria-hidden="true" /> },
];

const UNIT_OPTIONS = [
  { value: 'c-km', temp: 'c', dist: 'km', label: '°C · km' },
  { value: 'f-mi', temp: 'f', dist: 'mi', label: '°F · mi' },
  { value: 'c-mi', temp: 'c', dist: 'mi', label: '°C · mi' },
  { value: 'f-km', temp: 'f', dist: 'km', label: '°F · km' },
] as const;

const NOTIFICATION_KEYS: (keyof NotificationPrefs)[] = ['preDeparture', 'flightChanges', 'communityReplies', 'marketing'];

const NOTIFICATION_ICONS: Record<keyof NotificationPrefs, ReactNode> = {
  preDeparture: <Plane size={18} />,
  flightChanges: <RefreshCw size={18} />,
  communityReplies: <MessagesSquare size={18} />,
  marketing: <Megaphone size={18} />,
};

/** 이 사이트가 이 기기에서 쓰는 저장 공간과 브라우저가 허용하는 한도(MB). 잴 수 없으면 null */
async function readStorage(): Promise<{ usedMB: number; quotaMB: number | null } | null> {
  if (!navigator.storage?.estimate) return null;
  try {
    const e = await navigator.storage.estimate();
    return { usedMB: (e.usage ?? 0) / 1048576, quotaMB: e.quota ? e.quota / 1048576 : null };
  } catch {
    return null;
  }
}

function formatSize(mb: number): string {
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(1)} MB`;
}

/**
 * PC 설정 화면 (Stitch/setting 시안) — 왼쪽 메뉴 6개, 누른 메뉴의 내용만 오른쪽에 보인다(탭처럼).
 * 모바일은 기존 SettingsScreen 그대로. 설정은 바꾸는 즉시 저장된다(하단 저장 버튼 없음).
 * 시안과 달라진 곳(사용자 결정 2026-10-05): '동행 매칭 정보' 안의 제목은 '성별 및 나이대', 배지 없음, 마지막 동기화·하단 저장 바 없음,
 * 로그인 세션은 현재 기기만, 비밀번호 변경은 이메일 가입자만, Pro 박스는 프로 회원에게만.
 */
export function SettingsDesktop() {
  const { t, i18n } = useTranslation(['settings', 'common']);
  const { user } = useSession();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const trips = useTrips();
  const [section, setSection] = useState<SectionKey>('account');
  const [theme, setThemeState] = useState<ThemePreference>(() => getStoredTheme());
  const [storage, setStorage] = useState<{ usedMB: number; quotaMB: number | null } | null>(null);
  const [clearing, setClearing] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showBackup, setShowBackup] = useState(false);
  const [showLicenses, setShowLicenses] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [feedbackKind, setFeedbackKind] = useState<'general' | 'partnership' | null>(null);

  useEffect(() => {
    trackScreenView('settings_desktop');
  }, []);

  useEffect(() => {
    void readStorage().then((s) => s && setStorage(s));
  }, []);

  if (showDelete) return <DeleteAccountFlow />;
  if (!user) return null;

  const isPro = profile?.plan === 'pro';
  const unitValue = `${profile?.temp_unit ?? 'c'}-${profile?.distance_unit ?? 'km'}`;
  const prefs: NotificationPrefs = profile?.notification_prefs ?? { preDeparture: true, flightChanges: true, communityReplies: true, marketing: false };

  function changeTheme(next: ThemePreference) {
    setTheme(next);
    setThemeState(next);
  }

  function changeUnit(value: string) {
    const opt = UNIT_OPTIONS.find((o) => o.value === value);
    if (opt) updateProfile.mutate({ temp_unit: opt.temp as ProfileRow['temp_unit'], distance_unit: opt.dist as ProfileRow['distance_unit'] });
  }

  function changeLanguage(code: SupportedLocale) {
    if (code !== i18n.language) void i18n.changeLanguage(code);
    if (profile && code !== profile.locale) updateProfile.mutate({ locale: code });
  }

  function togglePref(key: keyof NotificationPrefs, value: boolean) {
    updateProfile.mutate({ notification_prefs: { ...prefs, [key]: value } });
    if (value && user) registerPushNotifications(user.id).catch((err) => captureError(err, { context: 'registerPushNotifications' }));
  }

  async function clearCache() {
    setClearing(true);
    try {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('triptic-images')).map((k) => caches.delete(k)));
      await clearOfflineCache();
      const s = await readStorage();
      if (s) setStorage(s);
    } catch (err) {
      captureError(err, { context: 'clearOfflineCache' });
    } finally {
      setClearing(false);
    }
  }

  const usedPct = storage?.quotaMB ? Math.min(100, Math.max(2, (storage.usedMB / storage.quotaMB) * 100)) : null;
  const themeOptions: [ThemePreference, ReactNode, string][] = [
    ['light', <Sun key="l" size={14} aria-hidden="true" />, t('preferences.themeLight')],
    ['dark', <Moon key="d" size={14} aria-hidden="true" />, t('preferences.themeDark')],
    ['system', <Monitor key="s" size={14} aria-hidden="true" />, t('preferences.themeSystem')],
  ];

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className={styles.eyebrow}>PREFERENCES &amp; SECURITY</p>
        <h1 className={styles.title}>{t('desktop.title')}</h1>
        <p className={styles.subtitle}>{t('desktop.subtitle')}</p>
      </header>

      <div className={styles.layout}>
        <aside className={styles.side}>
          <nav className={styles.nav} aria-label={t('desktop.title')}>
            {NAV.map(({ key, icon }) => (
              <button
                key={key}
                type="button"
                className={section === key ? styles.navOn : styles.navItem}
                aria-current={section === key ? 'page' : undefined}
                onClick={() => setSection(key)}
              >
                <span className={styles.navMain}>
                  {icon}
                  {t(`desktop.nav.${key}`)}
                </span>
                <ChevronRight size={16} aria-hidden="true" className={styles.navChev} />
              </button>
            ))}
          </nav>

          {isPro ? (
            <div className={styles.proBox}>
              <ShieldCheck size={20} aria-hidden="true" />
              <div>
                <h4 className={styles.proTitle}>{t('desktop.pro.title')}</h4>
                <ul className={styles.proList}>
                  <li>{t('desktop.pro.trips')}</li>
                  <li>{t('desktop.pro.pdf')}</li>
                  <li>{t('desktop.pro.ai')}</li>
                </ul>
              </div>
            </div>
          ) : null}
        </aside>

        <main className={styles.content}>
          {section === 'account' ? (
            <section className={styles.card} aria-label={t('desktop.nav.account')}>
              <div className={styles.profileRow}>
                <div className={styles.profile}>
                  <img
                    src={user.user_metadata?.avatar_url || 'https://api.dicebear.com/7.x/notionists/svg?seed=' + user.email}
                    alt=""
                    className={styles.avatar}
                  />
                  <div>
                    <p className={styles.nameRow}>
                      <span className={styles.name}>{profile?.display_name || user.user_metadata?.name || t('account.fallbackName')}</span>
                      {isPro ? <ProBadge /> : null}
                    </p>
                    <p className={styles.meta}>
                      {profile?.handle ? <span className={styles.handle}>@{profile.handle}</span> : null}
                      {profile?.handle ? <span aria-hidden="true">•</span> : null}
                      <span>{user.email}</span>
                    </p>
                  </div>
                </div>
                <button type="button" className={styles.primaryBtn} onClick={() => setShowEdit(true)}>
                  <Pencil size={16} aria-hidden="true" /> {t('desktop.account.edit')}
                </button>
              </div>

              <div className={styles.cards3}>
                <div className={styles.miniCard}>
                  <p className={styles.miniTitle}>
                    <Lock size={16} aria-hidden="true" /> {t('desktop.account.passwordTitle')}
                  </p>
                  <p className={styles.miniDesc}>{t('desktop.account.passwordDesc')}</p>
                  <button type="button" className={styles.linkBtn} onClick={() => setShowPassword(true)}>
                    {t('desktop.account.passwordBtn')} →
                  </button>
                </div>
                <div className={styles.miniCard}>
                  <p className={styles.miniTitle}>
                    <MonitorSmartphone size={16} aria-hidden="true" /> {t('desktop.account.sessionTitle')}
                  </p>
                  <p className={styles.miniDesc}>{t('desktop.account.sessionDesc', { device: currentDeviceLabel() })}</p>
                  <button type="button" className={styles.linkBtn} onClick={() => signOut().catch((err) => captureError(err, { context: 'signOut' }))}>
                    {t('account.signOut')} <LogOut size={14} aria-hidden="true" />
                  </button>
                </div>
                <div className={`${styles.miniCard} ${styles.danger}`}>
                  <p className={styles.miniTitle}>
                    <UserX size={16} aria-hidden="true" /> {t('desktop.account.dangerTitle')}
                  </p>
                  <p className={styles.miniDesc}>{t('desktop.account.dangerDesc')}</p>
                  <button type="button" className={styles.dangerLink} onClick={() => setShowDelete(true)}>
                    {t('desktop.account.dangerBtn')}
                  </button>
                </div>
              </div>
            </section>
          ) : null}

          {section === 'display' ? (
            <section className={styles.card} aria-label={t('desktop.nav.display')}>
              <h2 className={styles.cardTitle}>
                <Palette size={20} aria-hidden="true" /> {t('desktop.display.title')}
              </h2>
              <p className={styles.cardDesc}>{t('desktop.display.desc')}</p>

              <div className={styles.themeRow}>
                <div>
                  <p className={styles.fieldLabel}>{t('desktop.display.theme')}</p>
                  <p className={styles.fieldHint}>{t('desktop.display.themeDesc')}</p>
                </div>
                <div className={styles.segmented} role="group" aria-label={t('desktop.display.theme')}>
                  {themeOptions.map(([key, icon, label]) => (
                    <button key={key} type="button" className={theme === key ? styles.segOn : styles.seg} aria-pressed={theme === key} onClick={() => changeTheme(key)}>
                      {icon} {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.grid2}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>{t('preferences.unitSettings')}</span>
                  <select className={styles.select} value={unitValue} onChange={(e) => changeUnit(e.target.value)}>
                    {UNIT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>{t('preferences.baseCurrency')}</span>
                  <select className={styles.select} value={profile?.base_currency ?? 'KRW'} onChange={(e) => updateProfile.mutate({ base_currency: e.target.value })}>
                    {Object.entries(CURRENCIES).map(([code, meta]) => (
                      <option key={code} value={code}>
                        {currencyName(code, i18n.language)} ({code}) - {meta.symbol}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className={`${styles.field} ${styles.half}`}>
                <span className={styles.fieldLabel}>{t('preferences.language')}</span>
                <select className={styles.select} value={normalizeLocale(i18n.language)} onChange={(e) => changeLanguage(e.target.value as SupportedLocale)}>
                  {SUPPORTED_LOCALES.map((code) => (
                    <option key={code} value={code}>
                      {LANGUAGE_AUTONYMS[code]}
                    </option>
                  ))}
                </select>
              </label>
            </section>
          ) : null}

          {section === 'matching' ? (
            <section className={styles.card} aria-label={t('desktop.nav.matching')}>
              <h2 className={styles.cardTitle}>
                <BadgeCheck size={20} aria-hidden="true" /> {t('desktop.matching.title')}
              </h2>
              <p className={styles.cardDesc}>{t('demographics.settingsHint', { ns: 'community' })}</p>
              <DemographicsFields
                gender={profile?.gender ?? null}
                ageBand={profile?.age_band ?? null}
                onChange={(next) => updateProfile.mutate({ gender: next.gender, age_band: next.ageBand })}
              />
            </section>
          ) : null}

          {section === 'notifications' ? (
            <section className={styles.card} aria-label={t('desktop.nav.notifications')}>
              <h2 className={styles.cardTitle}>
                <Bell size={20} aria-hidden="true" /> {t('desktop.notifications.title')}
              </h2>
              <p className={styles.cardDesc}>{t('desktop.notifications.desc')}</p>
              <ul className={styles.toggles}>
                {NOTIFICATION_KEYS.map((key) => (
                  <li key={key} className={styles.toggleRow}>
                    <span className={styles.toggleIcon} aria-hidden="true">
                      {NOTIFICATION_ICONS[key]}
                    </span>
                    <span className={styles.toggleText}>
                      <span className={styles.fieldLabel}>{t(`desktop.notifications.${key}.title`)}</span>
                      <span className={styles.fieldHint}>{t(`desktop.notifications.${key}.desc`)}</span>
                    </span>
                    <label className={styles.switch}>
                      <input
                        type="checkbox"
                        role="switch"
                        className={styles.switchInput}
                        checked={prefs[key] ?? key !== 'marketing'}
                        aria-label={t(`desktop.notifications.${key}.title`)}
                        onChange={(e) => togglePref(key, e.target.checked)}
                      />
                      <span className={styles.switchTrack} aria-hidden="true" />
                    </label>
                  </li>
                ))}
              </ul>
              <p className={styles.footNote}>{t('desktop.notifications.note')}</p>
            </section>
          ) : null}

          {section === 'data' ? (
            <section className={styles.card} aria-label={t('desktop.nav.data')}>
              <h2 className={styles.cardTitle}>
                <Database size={20} aria-hidden="true" /> {t('desktop.data.title')}
              </h2>
              <p className={styles.cardDesc}>{t('desktop.data.desc')}</p>
              <div className={styles.storageBox}>
                <div className={styles.storageHead}>
                  <span>{t('desktop.data.cacheLabel')}</span>
                  <strong>{storage ? (storage.quotaMB ? `${formatSize(storage.usedMB)} / ${formatSize(storage.quotaMB)}` : formatSize(storage.usedMB)) : t('data.calculating')}</strong>
                </div>
                {usedPct !== null ? (
                  <div className={styles.bar} role="presentation">
                    <div className={styles.barFill} style={{ width: `${usedPct}%` }} />
                  </div>
                ) : null}
                <div className={styles.storageActions}>
                  <button type="button" className={styles.softBtn} disabled={clearing} onClick={() => void clearCache()}>
                    <Trash2 size={14} aria-hidden="true" /> {clearing ? t('data.clearingCache') : t('desktop.data.clear')}
                  </button>
                  <button type="button" className={styles.softBtn} onClick={() => setShowBackup(true)}>
                    <HardDrive size={14} aria-hidden="true" /> {t('data.backup')}
                  </button>
                  <span className={styles.pdfHint}>
                    <FileText size={14} aria-hidden="true" /> {t('data.pdfHint')}
                  </span>
                </div>
              </div>
            </section>
          ) : null}

          {section === 'community' ? (
            <section className={styles.card} aria-label={t('desktop.nav.community')}>
              <h2 className={styles.cardTitle}>
                <UserX size={20} aria-hidden="true" /> {t('desktop.community.title')}
              </h2>
              <p className={styles.cardDesc}>{t('desktop.community.desc')}</p>
              <div className={styles.blockedBox}>
                <BlockedUsersList userId={user.id} />
              </div>

              <div className={styles.supportHead}>
                <h3 className={styles.supportTitle}>
                  <LifeBuoy size={18} aria-hidden="true" /> {t('desktop.community.supportTitle')}
                </h3>
                <span className={styles.version}>v{APP_VERSION}</span>
              </div>
              <div className={styles.links}>
                <Link to="/guide" className={styles.linkCard}>
                  <span className={styles.linkTitle}>
                    <BookOpen size={16} aria-hidden="true" /> {t('about.guide')}
                  </span>
                  <span className={styles.linkDesc}>{t('desktop.community.guideDesc')}</span>
                </Link>
                <Link to="/notices" className={styles.linkCard}>
                  <span className={styles.linkTitle}>
                    <Megaphone size={16} aria-hidden="true" /> {t('about.notices')}
                  </span>
                  <span className={styles.linkDesc}>{t('desktop.community.noticesDesc')}</span>
                </Link>
                <button type="button" className={styles.linkCard} onClick={() => setFeedbackKind('general')}>
                  <span className={styles.linkTitle}>
                    <MessageCircle size={16} aria-hidden="true" /> {t('desktop.community.contact')}
                  </span>
                  <span className={styles.linkDesc}>{t('desktop.community.contactDesc')}</span>
                </button>
                <button type="button" className={styles.linkCard} onClick={() => setFeedbackKind('partnership')}>
                  <span className={styles.linkTitle}>
                    <Handshake size={16} aria-hidden="true" /> {t('about.partnership')}
                  </span>
                  <span className={styles.linkDesc}>{t('desktop.community.partnershipDesc')}</span>
                </button>
                <a href="/terms.html" target="_blank" rel="noopener" className={styles.linkCard}>
                  <span className={styles.linkTitle}>
                    <FileText size={16} aria-hidden="true" /> {t('legal.terms', { ns: 'common' })}
                  </span>
                  <span className={styles.linkDesc}>{t('desktop.community.termsDesc')}</span>
                </a>
                <a href="/privacy.html" target="_blank" rel="noopener" className={styles.linkCard}>
                  <span className={styles.linkTitle}>
                    <Scale size={16} aria-hidden="true" /> {t('legal.privacy', { ns: 'common' })}
                  </span>
                  <span className={styles.linkDesc}>{t('desktop.community.privacyDesc')}</span>
                </a>
                <button type="button" className={styles.linkCard} onClick={() => setShowLicenses(true)}>
                  <span className={styles.linkTitle}>
                    <Code2 size={16} aria-hidden="true" /> {t('licenses.title')}
                  </span>
                  <span className={styles.linkDesc}>{t('desktop.community.licensesDesc')}</span>
                </button>
              </div>
              <p className={styles.operator}>{t('about.operator')}</p>
            </section>
          ) : null}
        </main>
      </div>

      {showBackup ? <BackupModal trips={trips.data ?? []} onClose={() => setShowBackup(false)} onImported={() => trips.refetch()} /> : null}
      {showLicenses ? <LicensesModal onClose={() => setShowLicenses(false)} /> : null}
      {showEdit ? <EditProfileModal onClose={() => setShowEdit(false)} profile={profile} updateProfile={updateProfile} /> : null}
      {showPassword ? <PasswordChangeDialog provider={signInProviderOf(user)} onClose={() => setShowPassword(false)} /> : null}
      {feedbackKind ? <FeedbackModal kind={feedbackKind} onClose={() => setFeedbackKind(null)} /> : null}
    </div>
  );
}
