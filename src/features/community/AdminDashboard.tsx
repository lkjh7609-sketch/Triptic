import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ErrorState } from '@/shared/ui/states/ErrorState';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import { ADMIN_DASHBOARD_KEY, adminDashboardStats } from './adminService';
import type { AdminSection } from './adminSections';
import styles from './AdminDashboard.module.css';

function Tile({ label, value, tone, onClick }: { label: string; value: string; tone?: 'alert' | 'ok'; onClick?: () => void }) {
  const body = (
    <>
      <span className={styles.tileLabel}>{label}</span>
      <span className={tone === 'alert' ? styles.tileValueAlert : styles.tileValue}>{value}</span>
    </>
  );
  return onClick ? (
    <button type="button" className={styles.tile} onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className={styles.tile}>{body}</div>
  );
}

/**
 * 운영 대시보드 — 지금 처리할 일(신고·검수 대기·정지 중·새 건의)을 맨 위에, 그 아래 회원·여행 현황과 최근 14일 가입 추이,
 * 최근 가입자·최근 정지 기록. 처리할 일 칸을 누르면 그 메뉴로 간다.
 */
export function AdminDashboard({ onNavigate }: { onNavigate: (section: AdminSection) => void }) {
  const { t, i18n } = useTranslation(['community', 'common']);
  const stats = useQuery({ queryKey: ADMIN_DASHBOARD_KEY, queryFn: adminDashboardStats, staleTime: 30_000 });

  if (stats.isLoading) {
    return (
      <div className={styles.skeleton}>
        <Skeleton height="96px" />
        <Skeleton height="96px" />
      </div>
    );
  }
  if (stats.isError || !stats.data) {
    return <ErrorState summary={t('admin.dashboard.loadFailed')} onRetry={() => void stats.refetch()} />;
  }

  const d = stats.data;
  const count = (n: number) => t('admin.dashboard.count', { count: n });
  const people = (n: number) => t('admin.dashboard.people', { count: n });
  const day = (iso: string) => new Date(iso).toLocaleDateString(i18n.language, { month: 'numeric', day: 'numeric' });
  // 날짜만 있는 값(yyyy-MM-dd)은 UTC로 읽어야 시간대에 따라 하루가 밀리지 않는다
  const dateOnly = (d: string) => new Date(d).toLocaleDateString(i18n.language, { month: 'numeric', day: 'numeric', timeZone: 'UTC' });
  const max = Math.max(1, ...d.signups_14d.map((s) => s.count));
  const todo = d.reports_open + d.pending_review + d.feedback_new;

  return (
    <div className={styles.wrap}>
      <section aria-labelledby="admin-dash-todo">
        <h2 id="admin-dash-todo" className={styles.sectionTitle}>
          {t('admin.dashboard.todo')}
          <span className={todo === 0 ? styles.allClear : styles.todoCount}>{todo === 0 ? t('admin.dashboard.allClear') : count(todo)}</span>
        </h2>
        <div className={styles.tiles}>
          <Tile label={t('admin.tabs.reports')} value={count(d.reports_open)} tone={d.reports_open > 0 ? 'alert' : undefined} onClick={() => onNavigate('reports')} />
          <Tile label={t('admin.tabs.pending')} value={count(d.pending_review)} tone={d.pending_review > 0 ? 'alert' : undefined} onClick={() => onNavigate('pending')} />
          <Tile label={t('admin.tabs.feedback')} value={count(d.feedback_new)} tone={d.feedback_new > 0 ? 'alert' : undefined} onClick={() => onNavigate('feedback')} />
          <Tile label={t('admin.dashboard.suspensionsActive')} value={people(d.suspensions_active)} onClick={() => onNavigate('suspensions')} />
        </div>
      </section>

      <section aria-labelledby="admin-dash-status">
        <h2 id="admin-dash-status" className={styles.sectionTitle}>
          {t('admin.dashboard.status')}
        </h2>
        <div className={styles.tiles}>
          <Tile label={t('admin.dashboard.membersTotal')} value={people(d.members_total)} onClick={() => onNavigate('members')} />
          <Tile label={t('admin.dashboard.membersToday')} value={people(d.members_today)} />
          <Tile label={t('admin.dashboard.members7d')} value={people(d.members_7d)} />
          <Tile label={t('admin.dashboard.trips7d')} value={count(d.trips_7d)} />
        </div>
      </section>

      <section className={styles.card} aria-labelledby="admin-dash-chart">
        <h2 id="admin-dash-chart" className={styles.cardTitle}>
          {t('admin.dashboard.signups')}
        </h2>
        <ol className={styles.chart}>
          {d.signups_14d.map((s) => (
            <li key={s.day} className={styles.barCol} title={`${dateOnly(s.day)} · ${people(s.count)}`}>
              <span className={styles.barValue}>{s.count > 0 ? s.count : ''}</span>
              <span className={styles.bar} style={{ height: `${Math.max(s.count > 0 ? 6 : 2, (s.count / max) * 72)}px` }} />
              <span className={styles.barDay}>{new Date(s.day).getUTCDate()}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className={styles.columns}>
        <section className={styles.card} aria-labelledby="admin-dash-members">
          <div className={styles.cardHead}>
            <h2 id="admin-dash-members" className={styles.cardTitle}>
              {t('admin.dashboard.recentMembers')}
            </h2>
            <button type="button" className={styles.link} onClick={() => onNavigate('members')}>
              {t('admin.dashboard.viewAll')}
            </button>
          </div>
          {d.recent_members.length === 0 ? (
            <p className={styles.none}>{t('admin.dashboard.none')}</p>
          ) : (
            <ul className={styles.rows}>
              {d.recent_members.map((m) => (
                <li key={m.id} className={styles.row}>
                  <span className={styles.rowMain}>
                    {m.display_name || t('admin.userNoName')} <span className={styles.muted}>@{m.handle || t('admin.userNoHandle')}</span>
                  </span>
                  <span className={styles.muted}>{day(m.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={styles.card} aria-labelledby="admin-dash-susp">
          <div className={styles.cardHead}>
            <h2 id="admin-dash-susp" className={styles.cardTitle}>
              {t('admin.dashboard.recentSuspensions')}
            </h2>
            <button type="button" className={styles.link} onClick={() => onNavigate('suspensions')}>
              {t('admin.dashboard.viewAll')}
            </button>
          </div>
          {d.recent_suspensions.length === 0 ? (
            <p className={styles.none}>{t('admin.dashboard.none')}</p>
          ) : (
            <ul className={styles.rows}>
              {d.recent_suspensions.map((s) => (
                <li key={s.id} className={styles.row}>
                  <span className={styles.rowMain}>
                    {s.email}
                    <span className={styles.muted}> · {t(`suspension.reasons.${s.reason}`, { ns: 'common' })}</span>
                  </span>
                  <span className={s.lifted_at ? styles.chipLifted : styles.chipActive}>
                    {s.lifted_at ? t('admin.suspensionHistory.statusLifted') : t('admin.suspensionHistory.statusActive')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
