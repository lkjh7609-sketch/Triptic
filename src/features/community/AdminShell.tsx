import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Archive, Ban, BarChart3, CircleDollarSign, Flag, LayoutDashboard, Megaphone, Menu, MessageSquare, ShieldAlert, Users, X, type LucideIcon } from 'lucide-react';
import { ADMIN_GROUPS, type AdminSection } from './adminSections';
import { useSectionLabel } from './useSectionLabel';
import styles from './AdminShell.module.css';

const ICONS: Record<AdminSection, LucideIcon> = {
  dashboard: LayoutDashboard,
  reports: Flag,
  pending: ShieldAlert,
  feedback: MessageSquare,
  members: Users,
  suspensions: Ban,
  notices: Megaphone,
  archive: Archive,
  sales: CircleDollarSign,
  analytics: BarChart3,
};

interface AdminShellProps {
  active: AdminSection;
  onSelect: (section: AdminSection) => void;
  /** 메뉴 옆에 보이는 처리할 일 개수 — 0이거나 없으면 안 보인다 */
  badges?: Partial<Record<AdminSection, number>>;
  children: ReactNode;
}

/**
 * 운영 콘솔 틀 — 큰 화면(1024px~)은 왼쪽에 고정된 메뉴, 작은 화면은 위쪽 줄의 ☰ 버튼으로 왼쪽에서 밀려 나오는 메뉴.
 * 메뉴 항목을 누르면 서랍은 닫힌다.
 */
export function AdminShell({ active, onSelect, badges = {}, children }: AdminShellProps) {
  const { t } = useTranslation('community');
  const labelOf = useSectionLabel();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <button type="button" className={styles.menuBtn} aria-label={t('admin.nav.open')} aria-expanded={open} onClick={() => setOpen(true)}>
          <Menu size={20} aria-hidden="true" />
        </button>
        <span className={styles.topTitle}>{labelOf(active)}</span>
      </header>

      {open ? <div className={styles.scrim} onClick={() => setOpen(false)} aria-hidden="true" /> : null}

      <aside className={open ? styles.sidebarOpen : styles.sidebar} aria-label={t('admin.nav.label')}>
        <div className={styles.brand}>
          <span>{t('admin.title')}</span>
          <button type="button" className={styles.closeBtn} aria-label={t('admin.nav.close')} onClick={() => setOpen(false)}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <nav>
          {ADMIN_GROUPS.map((group) => (
            <div key={group.key} className={styles.group}>
              {group.key !== 'overview' ? <p className={styles.groupTitle}>{t(`admin.nav.groups.${group.key}`)}</p> : null}
              <ul className={styles.items}>
                {group.sections.map((s) => {
                  const Icon = ICONS[s];
                  const badge = badges[s] ?? 0;
                  return (
                    <li key={s}>
                      <button
                        type="button"
                        className={active === s ? styles.itemActive : styles.item}
                        aria-current={active === s ? 'page' : undefined}
                        onClick={() => {
                          onSelect(s);
                          setOpen(false);
                        }}
                      >
                        <Icon size={18} aria-hidden="true" />
                        <span className={styles.itemLabel}>{labelOf(s)}</span>
                        {badge > 0 ? (
                          <span className={styles.badge} aria-label={t('admin.nav.pending', { count: badge })}>
                            {badge > 99 ? '99+' : badge}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      <main className={styles.main}>{children}</main>
    </div>
  );
}
