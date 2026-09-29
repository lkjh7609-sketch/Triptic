import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useSession } from '@/shared/hooks/useSession';
import { useProfile, useUpdateProfile } from '@/shared/hooks/useProfile';
import { useTrips } from '@/features/plan/hooks/useTrips';
import { signOut } from '@/shared/api/authService';
import { captureError } from '@/shared/monitoring';
import { User, Settings, SlidersHorizontal, LogOut, Globe, HardDrive, Sun, Moon } from 'lucide-react';
import { getStoredTheme, setTheme, ThemePreference } from '@/shared/theme';
import { EditProfileModal } from '@/features/settings/EditProfileModal';
import { UnitSettingsModal } from '@/features/settings/UnitSettingsModal';
import { LanguageModal } from '@/features/settings/LanguageModal';
import { BackupModal } from '@/features/plan/BackupModal';
import { HOME_SECTIONS, isHomeSectionPath } from '@/features/home/homeSections';
import { openLoginPrompt } from '@/features/auth/loginPrompt';
import { BrandLogo } from '@/shared/ui/BrandLogo';
import styles from './HeaderDesktop.module.css';

export function HeaderDesktop() {
  const { t } = useTranslation(['common', 'settings', 'home']);
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
          {/* 홈에 커서를 올리거나(키보드는 포커스) 하면 항공·호텔·액티비티가 펼쳐진다.
              메뉴가 헤더 바로 아래 붙어 있어 커서를 내리는 사이 닫히지 않는다 */}
          <div className={styles.navItem}>
            <Link to="/" className={styles.navLink} aria-current={isHomeSectionPath(pathname) ? 'page' : undefined}>
              {t('tab.home')}
            </Link>
            <div className={styles.subMenu}>
              {HOME_SECTIONS.filter((s) => s.to !== '/').map((s) => (
                <Link
                  key={s.to}
                  to={s.to}
                  className={styles.subMenuItem}
                  aria-current={pathname === s.to ? 'page' : undefined}
                  // 누른 뒤에도 포커스가 남아 메뉴가 계속 열려 있지 않게
                  onClick={(e) => e.currentTarget.blur()}
                >
                  {t(`home:sections.${s.key}`)}
                </Link>
              ))}
            </div>
          </div>
          <Link to="/plan" className={styles.navLink} aria-current={pathname.startsWith('/plan') ? 'page' : undefined}>
            {t('tab.plan')}
          </Link>
          <Link to="/community" className={styles.navLink} aria-current={pathname.startsWith('/community') ? 'page' : undefined}>
            {t('tab.community')}
          </Link>
        </nav>
      </div>

      {/* 비로그인 둘러보기 — 프로필 자리에 로그인 버튼 */}
      {!user ? (
        <button type="button" className={styles.signInButton} onClick={openLoginPrompt}>
          {t('auth.signIn')}
        </button>
      ) : (
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
            <button className={styles.dropdownItem} onClick={handleSignOut}>
              <LogOut size={16} /> {t('menu.signOut')}
            </button>
          </div>
        </div>
      )}

      {activeModal === 'profile' && <EditProfileModal onClose={() => setActiveModal(null)} profile={profile} updateProfile={updateProfile} />}
      {activeModal === 'unit' && <UnitSettingsModal onClose={() => setActiveModal(null)} profile={profile} updateProfile={updateProfile} />}
      {activeModal === 'language' && <LanguageModal onClose={() => setActiveModal(null)} profile={profile} updateProfile={updateProfile} />}
      {activeModal === 'backup' && <BackupModal trips={trips.data ?? []} onClose={() => setActiveModal(null)} onImported={() => trips.refetch()} />}
    </header>
  );
}
