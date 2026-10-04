import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ChevronDown, MapPin, RotateCcw, Search } from 'lucide-react';
import { EmptyState } from '@/shared/ui/states/EmptyState';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import {
  adminListMembers,
  adminMemberTrips,
  type AdminMemberFilters,
  type AdminMemberRow,
  type AdminUserRow,
} from './adminService';
import { AdminUserPlanRow } from './AdminUserPlanRow';
import { COMPANION_AGES } from './companionPrefs';
import { fetchAdminUserActivity } from './analyticsService';
import styles from './AdminScreen.module.css';
import memberStyles from './AdminMembersTab.module.css';

const PAGE_SIZE = 20;
const NO_FILTER: AdminMemberFilters = { query: '', gender: '', ageBand: '', plan: '', joinedFrom: '', joinedTo: '' };

function countryName(code: string | null, language: string): string {
  if (!code) return '';
  try {
    return new Intl.DisplayNames([language], { type: 'region' }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

function MemberTrips({ userId }: { userId: string }) {
  const { t } = useTranslation('community');
  const trips = useQuery({ queryKey: ['admin', 'member-trips', userId], queryFn: () => adminMemberTrips(userId) });
  if (trips.isLoading) return <Skeleton height="40px" />;
  if (!trips.data || trips.data.length === 0) return <p className={memberStyles.muted}>{t('admin.members.noTrips')}</p>;
  return (
    <ul className={memberStyles.trips}>
      {trips.data.map((trip) => (
        <li key={trip.id} className={trip.deleted_at ? memberStyles.tripDeleted : undefined}>
          <strong>{trip.title}</strong>
          <span>
            {[trip.city, trip.start_date && trip.end_date ? `${trip.start_date} ~ ${trip.end_date}` : null, trip.total_days ? t('admin.members.days', { count: trip.total_days }) : null]
              .filter(Boolean)
              .join(' · ')}
          </span>
          <span className={memberStyles.muted}>
            {t('admin.members.tripCreated', { date: trip.created_at.slice(0, 10) })}
            {trip.deleted_at ? ` · ${t('admin.members.tripDeleted')}` : ''}
          </span>
        </li>
      ))}
    </ul>
  );
}

function MemberRow({
  member,
  onChanged,
  activity,
  activityWindowDays,
}: {
  member: AdminMemberRow;
  onChanged: (u: AdminUserRow) => void;
  activity?: Parameters<typeof AdminUserPlanRow>[0]['activity'];
  activityWindowDays?: number;
}) {
  const { t, i18n } = useTranslation('community');
  const [open, setOpen] = useState(false);
  const lang = i18n.language;
  const location = [countryName(member.last_country, lang), member.last_city].filter(Boolean).join(' · ');
  const dt = (iso: string | null) => (iso ? new Date(iso).toLocaleString(lang) : '—');
  const demographics = [member.age_band ? t(`companion.ages.${member.age_band}`) : null, member.gender ? t(`companion.gender.${member.gender}`) : null]
    .filter(Boolean)
    .join(' · ');
  const userRow: AdminUserRow = {
    id: member.id,
    handle: member.handle,
    display_name: member.display_name,
    avatar_url: member.avatar_url,
    plan: member.plan,
    trips_created_count: member.trips_created_count,
    trip_limit: member.trip_limit,
  };

  return (
    <article className={memberStyles.card}>
      <button type="button" className={memberStyles.head} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className={memberStyles.avatar} aria-hidden="true">
          {(member.display_name ?? '?').slice(0, 1)}
        </span>
        <span className={memberStyles.main}>
          <span className={memberStyles.name}>
            {member.display_name || t('admin.userNoName')}
            <span className={memberStyles.handle}>@{member.handle || t('admin.userNoHandle')}</span>
            {member.plan === 'pro' ? <span className={memberStyles.pro}>PRO</span> : null}
            {demographics ? <span className={memberStyles.chip}>{demographics}</span> : null}
          </span>
          <span className={memberStyles.sub}>{member.email ?? '—'}</span>
          <span className={memberStyles.sub}>
            {t('admin.members.joined', { date: member.created_at.slice(0, 10) })} · {t('admin.members.lastLogin', { time: dt(member.last_sign_in_at) })}
          </span>
        </span>
        <ChevronDown size={18} aria-hidden="true" className={open ? memberStyles.chevOpen : memberStyles.chev} />
      </button>

      {open ? (
        <div className={memberStyles.detail}>
          <dl className={memberStyles.facts}>
            <div>
              <dt>{t('admin.members.handle')}</dt>
              <dd>@{member.handle || t('admin.userNoHandle')}</dd>
            </div>
            <div>
              <dt>{t('admin.members.email')}</dt>
              <dd>{member.email ?? '—'}</dd>
            </div>
            <div>
              <dt>{t('admin.members.demographics')}</dt>
              <dd>{demographics || t('admin.members.notEntered')}</dd>
            </div>
            <div>
              <dt>{t('admin.members.joinedLabel')}</dt>
              <dd>{dt(member.created_at)}</dd>
            </div>
            <div>
              <dt>{t('admin.members.lastLoginLabel')}</dt>
              <dd>{dt(member.last_sign_in_at)}</dd>
            </div>
            <div>
              <dt>{t('admin.members.lastSeenLabel')}</dt>
              <dd>{dt(member.last_seen_at)}</dd>
            </div>
            <div>
              <dt>{t('admin.members.location')}</dt>
              <dd>
                {location ? (
                  <span className={memberStyles.loc}>
                    <MapPin size={13} aria-hidden="true" /> {location}
                  </span>
                ) : (
                  t('admin.members.noLocation')
                )}
              </dd>
            </div>
          </dl>
          <h3 className={memberStyles.sectionTitle}>{t('admin.members.tripsTitle', { count: member.trips_created_count })}</h3>
          <MemberTrips userId={member.id} />
          <h3 className={memberStyles.sectionTitle}>{t('admin.members.planTitle')}</h3>
          <AdminUserPlanRow compact user={userRow} onChanged={onChanged} activity={activity} activityWindowDays={activityWindowDays} />
        </div>
      ) : null}
    </article>
  );
}

/**
 * 운영 콘솔 '회원' 탭 — 모든 회원을 이름·핸들·이메일로 검색하고, 성별·나잇대·등급·가입일로 거르고,
 * 한 줄을 눌러 이메일·가입일·최근 접속·대략적 위치·만든 여행 목록과 등급·무료 한도를 본다.
 * 최근 접속은 로그인 기록(auth)과 앱 접속 기록(profiles.last_seen_at), 위치는 접속 때 IP로 짐작한 국가·도시(정확한 위치는 모으지 않는다).
 */
export function AdminMembersTab() {
  const { t } = useTranslation('community');
  const [draft, setDraft] = useState<AdminMemberFilters>(NO_FILTER);
  const [applied, setApplied] = useState<AdminMemberFilters>(NO_FILTER);
  const [page, setPage] = useState(0);
  const [overrides, setOverrides] = useState<Record<string, AdminUserRow>>({});
  const members = useQuery({
    queryKey: ['admin', 'members', applied, page],
    queryFn: () => adminListMembers(applied, page, PAGE_SIZE),
  });
  // 회원별 이용 기록(PostHog) — 연결 전이거나 실패하면 그 줄만 숨긴다
  const activityQuery = useQuery({ queryKey: ['admin', 'user-activity'], queryFn: fetchAdminUserActivity, staleTime: 60_000, retry: false });
  const activityReady = activityQuery.data?.status === 'ok';

  function apply() {
    setOverrides({});
    setPage(0);
    setApplied({ ...draft, query: draft.query.trim() });
  }

  function reset() {
    setDraft(NO_FILTER);
    setApplied(NO_FILTER);
    setPage(0);
    setOverrides({});
  }

  const rows = members.data?.rows ?? [];
  const total = members.data?.total ?? 0;
  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);

  return (
    <div className={memberStyles.wrap}>
      <div className={memberStyles.filters}>
        <input
          className={styles.searchInput}
          placeholder={t('admin.members.searchPlaceholder')}
          aria-label={t('admin.members.searchPlaceholder')}
          value={draft.query}
          onChange={(e) => setDraft({ ...draft, query: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && apply()}
        />
        <select aria-label={t('admin.members.gender')} value={draft.gender} onChange={(e) => setDraft({ ...draft, gender: e.target.value })}>
          <option value="">{t('admin.members.gender')}: {t('admin.members.all')}</option>
          <option value="female">{t('companion.gender.female')}</option>
          <option value="male">{t('companion.gender.male')}</option>
          <option value="none">{t('admin.members.notEntered')}</option>
        </select>
        <select aria-label={t('admin.members.age')} value={draft.ageBand} onChange={(e) => setDraft({ ...draft, ageBand: e.target.value })}>
          <option value="">{t('admin.members.age')}: {t('admin.members.all')}</option>
          {COMPANION_AGES.map((a) => (
            <option key={a} value={a}>
              {t(`companion.ages.${a}`)}
            </option>
          ))}
          <option value="none">{t('admin.members.notEntered')}</option>
        </select>
        <select aria-label={t('admin.members.plan')} value={draft.plan} onChange={(e) => setDraft({ ...draft, plan: e.target.value })}>
          <option value="">{t('admin.members.plan')}: {t('admin.members.all')}</option>
          <option value="free">{t('admin.members.planFree')}</option>
          <option value="pro">PRO</option>
        </select>
        <label className={memberStyles.date}>
          <span>{t('admin.members.joinedFrom')}</span>
          <input type="date" value={draft.joinedFrom} onChange={(e) => setDraft({ ...draft, joinedFrom: e.target.value })} />
        </label>
        <label className={memberStyles.date}>
          <span>{t('admin.members.joinedTo')}</span>
          <input type="date" value={draft.joinedTo} onChange={(e) => setDraft({ ...draft, joinedTo: e.target.value })} />
        </label>
        <button type="button" className={styles.primaryBtn} onClick={apply}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Search size={16} /> {t('admin.userSearchButton')}
          </span>
        </button>
        <button type="button" className={styles.secondaryBtn} onClick={reset}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <RotateCcw size={14} /> {t('admin.members.reset')}
          </span>
        </button>
      </div>

      <p className={memberStyles.total} role="status">
        {t('admin.members.total', { count: total })}
      </p>

      {members.isLoading ? (
        <Skeleton height="72px" />
      ) : rows.length === 0 ? (
        <EmptyState message={t('admin.userSearchEmpty')} />
      ) : (
        <>
          <div className={memberStyles.list}>
            {rows.map((m) => (
              <MemberRow
                key={m.id}
                member={{ ...m, ...(overrides[m.id] ? { plan: overrides[m.id].plan, trip_limit: overrides[m.id].trip_limit } : {}) }}
                onChanged={(u) => setOverrides((prev) => ({ ...prev, [u.id]: u }))}
                activity={activityReady ? (activityQuery.data?.users?.[m.id] ?? null) : undefined}
                activityWindowDays={activityQuery.data?.windowDays}
              />
            ))}
          </div>
          <div className={styles.pagerRow}>
            <button type="button" className={styles.secondaryBtn} disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
              {t('admin.prevPage')}
            </button>
            <span className={styles.pagerLabel}>{t('admin.pageLabel', { page: page + 1 })}</span>
            <button type="button" className={styles.secondaryBtn} disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}>
              {t('admin.nextPage')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
