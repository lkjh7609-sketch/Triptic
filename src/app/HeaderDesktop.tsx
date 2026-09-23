import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useSession } from '@/shared/hooks/useSession';
import { useProfile, useUpdateProfile } from '@/shared/hooks/useProfile';
import { useTrips } from '@/features/plan/hooks/useTrips';
import { getSupabaseClient } from '@/shared/api/supabaseClient';
import { User, Settings, LogOut, Globe, HardDrive } from 'lucide-react';
import { EditProfileModal } from '@/features/settings/EditProfileModal';
import { UnitSettingsModal } from '@/features/settings/UnitSettingsModal';
import { LanguageModal } from '@/features/settings/LanguageModal';
import { BackupModal } from '@/features/plan/BackupModal';
import styles from './HeaderDesktop.module.css';

export function HeaderDesktop() {
  const { t } = useTranslation();
  const { user } = useSession();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const trips = useTrips();
  const { pathname } = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [activeModal, setActiveModal] = useState<'profile' | 'unit' | 'language' | 'backup' | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayName = user?.user_metadata?.name ?? user?.user_metadata?.full_name ?? t('account.fallbackName', { ns: 'settings' });
  const avatarUrl = user?.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=0D9488&color=fff`;

  const handleSignOut = async () => {
    await getSupabaseClient().auth.signOut();
  };

  const openModal = (modal: typeof activeModal) => {
    setActiveModal(modal);
    setDropdownOpen(false);
  };

  return (
    <header className={styles.header}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '3rem' }}>
        <Link to="/" className={styles.logo}>Triptic</Link>
        
        <nav className={styles.nav}>
          <Link to="/" className={styles.navLink} aria-selected={pathname === '/'}>
            {t('tab.home')}
          </Link>
          <Link to="/plan" className={styles.navLink} aria-selected={pathname.startsWith('/plan')}>
            {t('tab.plan')}
          </Link>
          <Link to="/community" className={styles.navLink} aria-selected={pathname.startsWith('/community')}>
            {t('tab.community')}
          </Link>
        </nav>
      </div>

      <div style={{ position: 'relative' }} ref={dropdownRef}>
        <div 
          className={styles.profileContainer}
          onClick={() => setDropdownOpen(!dropdownOpen)}
        >
          <img src={avatarUrl} alt="User Avatar" className={styles.avatar} />
          <span className={styles.userName}>{displayName}</span>
        </div>

        <div className={`${styles.dropdown} ${dropdownOpen ? styles.open : ''}`}>
          <button className={styles.dropdownItem} onClick={() => openModal('profile')}>
            <User size={16} /> 내 정보 변경
          </button>
          <button className={styles.dropdownItem} onClick={() => openModal('unit')}>
            <Settings size={16} /> 단위 및 테마 설정
          </button>
          <button className={styles.dropdownItem} onClick={() => openModal('language')}>
            <Globe size={16} /> 언어 설정
          </button>
          <button className={styles.dropdownItem} onClick={() => openModal('backup')}>
            <HardDrive size={16} /> 백업 및 복원
          </button>
          <div className={styles.dropdownDivider} />
          <button className={styles.dropdownItem} onClick={handleSignOut}>
            <LogOut size={16} /> 로그아웃
          </button>
        </div>
      </div>

      {activeModal === 'profile' && <EditProfileModal onClose={() => setActiveModal(null)} profile={profile} updateProfile={updateProfile} />}
      {activeModal === 'unit' && <UnitSettingsModal onClose={() => setActiveModal(null)} profile={profile} updateProfile={updateProfile} />}
      {activeModal === 'language' && <LanguageModal onClose={() => setActiveModal(null)} profile={profile} updateProfile={updateProfile} />}
      {activeModal === 'backup' && <BackupModal trips={trips.data ?? []} onClose={() => setActiveModal(null)} onImported={() => trips.refetch()} />}
    </header>
  );
}
