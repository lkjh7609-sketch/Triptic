import { lazy, Suspense, useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useSession } from '@/shared/hooks/useSession';
import { useProfile, useUpdateProfile } from '@/shared/hooks/useProfile';
import { ProBadge } from '@/shared/ui/ProBadge';
import { useTrips } from '@/features/plan/hooks/useTrips';
import { signOut } from '@/shared/api/authService';
import { captureError } from '@/shared/monitoring';
import { User, Settings, SlidersHorizontal, LogOut, Globe, HardDrive, Sun, Moon, Megaphone, BookOpen } from 'lucide-react';
import { getStoredTheme, setTheme, ThemePreference } from '@/shared/theme';
import { isHomeSectionPath } from '@/features/home/homeSections';
import { openLoginPrompt } from '@/features/auth/loginPrompt';
import { BrandLogo } from '@/shared/ui/BrandLogo';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import { LanguageMenu } from './LanguageMenu';
import styles from './HeaderDesktop.module.css';

// 메뉴에서 눌러야 열리는 창들은 첫 화면 번들에서 뺀다(눌렀을 때 받는다 — 청크가 낡았으면 chunkRetry가 새로고침)
const EditProfileModal = lazy(() => import('@/features/settings/EditProfileModal').then((m) => ({ default: m.EditProfileModal })));
const UnitSettingsModal = lazy(() => import('@/features/settings/UnitSettingsModal').then((m) => ({ default: m.UnitSettingsModal })));
const LanguageModal = lazy(() => import('@/features/settings/LanguageModal').then((m) => ({ default: m.LanguageModal })));
const BackupModal = lazy(() => import('@/features/plan/BackupModal').then((m) => ({ default: m.BackupModal })));

export function HeaderDesktop() {
  const { t } = useTranslation(['common', 'settings']);
  const { user } = useSession();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const trips = useTrips();
  const { pathname } = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [activeModal, setActiveModal] = useState<'profile' | 'unit' | 'language' | 'backup' | null>(null);
  const [currentTheme, setCurrentTheme] = useState<ThemePreference>(getStoredTheme());

  const toggleTheme = () => {
    const isCurrentlyDark = currentTheme === 'dark' || (currentTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const newTheme = isCurrentlyDark ? 'light' : 'dark';
    setTheme(newTheme);
    setCurrentTheme(newTheme);
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayName =
    profile?.display_name?.trim() ||
    user?.user_metadata?.name ||
    user?.user_metadata?.full_name ||
    t('account.fallbackName', { ns: 'settings' });
  // 소셜 로그인 아바타가 없으면 외부 서비스(이름을 URL로 전송) 대신 이니셜로 표시한다
  const avatarUrl: string | undefined = user?.user_metadata?.avatar_url || undefined;

  // 설정 화면과 같은 경로로 로그아웃한다 — 오프라인 캐시(IndexedDB)까지 지워야 다음 사용자에게
  // 이전 사용자의 여행 데이터가 남지 않는다
  const handleSignOut = () => {
    setDropdownOpen(false);
    signOut().catch((err) => captureError(err, { context: 'signOut' }));
  };

  const openModal = (modal: typeof activeModal) => {
    setActiveModal(modal);
    setDropdownOpen(false);
  };

  const isDark = currentTheme === 'dark' || (currentTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <header className={styles.header}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '3rem' }}>
        <Link to="/" className={styles.logo} aria-label="Triptic">
          <BrandLogo className={styles.logoImage} />
        </Link>
        
        <nav className={styles.nav}>
          {/* 항공·호텔·액티비티 이동은 각 화면 위의 탭 줄(HomeSectionTabs)이 맡는다 —
              예전엔 여기 "홈"에 커서를 올려야만 나타나서 있는 줄도 모르는 사람이 많았다 */}
          <Link to="/" className={styles.navLink} aria-current={isHomeSectionPath(pathname) ? 'page' : undefined}>
            {t('tab.home')}
          </Link>
          <Link to="/plan" className={styles.navLink} aria-current={pathname.startsWith('/plan') ? 'page' : undefined}>
            {t('tab.plan')}
          </Link>
          <Link to="/community" className={styles.navLink} aria-current={pathname.startsWith('/community') ? 'page' : undefined}>
            {t('tab.community')}
          </Link>
          <Link to="/airports" className={styles.navLink} aria-current={pathname.startsWith('/airports') ? 'page' : undefined}>
            {t('tab.airport')}
          </Link>
        </nav>
      </div>

      {/* 비로그인 둘러보기 — 프로필 자리에 언어(지구본)와 로그인 버튼 */}
      {!user ? (
        <div className={styles.guestActions}>
          <LanguageMenu />
          <button type="button" className={styles.signInButton} onClick={openLoginPrompt}>
            {t('auth.signIn')}
          </button>
        </div>
      ) : (
        <div className={styles.userActions}>
        <NotificationBell />
        <div style={{ position: 'relative' }} ref={dropdownRef}>
          <button
            type="button"
            className={styles.profileContainer}
            onClick={() => setDropdownOpen(!dropdownOpen)}
            aria-haspopup="menu"
            aria-expanded={dropdownOpen}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className={styles.avatar} />
            ) : (
              <span className={`${styles.avatar} ${styles.avatarInitial}`} aria-hidden="true">
                {displayName.trim().slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className={styles.userName}>{displayName}</span>
            {profile?.plan === 'pro' ? <ProBadge /> : null}
          </button>

          <div className={`${styles.dropdown} ${dropdownOpen ? styles.open : ''}`} role="menu" hidden={!dropdownOpen}>
            <button 
              className={styles.dropdownItem} 
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              onClick={(e) => {
                e.stopPropagation();
                toggleTheme();
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {isDark ? <Moon size={16} /> : <Sun size={16} />}
                {t('menu.darkMode')}
              </div>
              <div className={`${styles.toggleSwitch} ${isDark ? styles.toggleOn : ''}`}>
                <div className={styles.toggleThumb} />
              </div>
            </button>
            <div className={styles.dropdownDivider} />
            <Link to="/settings" className={styles.dropdownItem} onClick={() => setDropdownOpen(false)}>
              <Settings size={16} /> {t('menu.settingsPage')}
            </Link>
            <button className={styles.dropdownItem} onClick={() => openModal('profile')}>
              <User size={16} /> {t('menu.editProfile')}
            </button>
            <button className={styles.dropdownItem} onClick={() => openModal('unit')}>
              <SlidersHorizontal size={16} /> {t('menu.units')}
            </button>
            <button className={styles.dropdownItem} onClick={() => openModal('language')}>
              <Globe size={16} /> {t('menu.language')}
            </button>
            <button className={styles.dropdownItem} onClick={() => openModal('backup')}>
              <HardDrive size={16} /> {t('menu.backup')}
            </button>
            <div className={styles.dropdownDivider} />
            <Link to="/notices" className={styles.dropdownItem} onClick={() => setDropdownOpen(false)}>
              <Megaphone size={16} /> {t('menu.notices')}
            </Link>
            <Link to="/guide" className={styles.dropdownItem} onClick={() => setDropdownOpen(false)}>
              <BookOpen size={16} /> {t('menu.guide')}
            </Link>
            <div className={styles.dropdownDivider} />
            <button className={styles.dropdownItem} onClick={handleSignOut}>
              <LogOut size={16} /> {t('menu.signOut')}
            </button>
          </div>
        </div>
        </div>
      )}

      <Suspense fallback={null}>
        {activeModal === 'profile' && <EditProfileModal onClose={() => setActiveModal(null)} profile={profile} updateProfile={updateProfile} />}
        {activeModal === 'unit' && <UnitSettingsModal onClose={() => setActiveModal(null)} profile={profile} updateProfile={updateProfile} />}
        {activeModal === 'language' && <LanguageModal onClose={() => setActiveModal(null)} profile={profile} updateProfile={updateProfile} />}
        {activeModal === 'backup' && <BackupModal trips={trips.data ?? []} onClose={() => setActiveModal(null)} onImported={() => trips.refetch()} />}
      </Suspense>
    </header>
  );
}
