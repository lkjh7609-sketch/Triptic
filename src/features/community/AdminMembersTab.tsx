import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Eye, MapPin, UserX } from 'lucide-react';
import { EmptyState } from '@/shared/ui/states/EmptyState';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import { showToast } from '@/shared/ui/toast';
import { captureError } from '@/shared/monitoring';
import {
  adminListMembers,
  adminMemberTrips,
  adminRemoveMember,
  AdminRemoveMemberError,
  type AdminMemberFilters,
  type AdminMemberRow,
  type AdminUserRow,
} from './adminService';
import type { SuspensionReason } from '@/shared/suspension';
import { AdminUserPlanRow } from './AdminUserPlanRow';
import { RemoveMemberDialog, type RemoveOutcome } from './RemoveMemberDialog';
import { AdminSuspensionsSection } from './AdminSuspensionsSection';
import { AdminFilterBar } from './AdminFilters';
import { AdminTripViewer } from './AdminTripViewer';
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
  const [viewing, setViewing] = useState<string | null>(null);
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
          <button type="button" className={memberStyles.viewBtn} onClick={() => setViewing(trip.id)}>
            <Eye size={14} aria-hidden="true" /> {t('admin.members.tripView.view')}
          </button>
        </li>
      ))}
      {viewing ? <AdminTripViewer tripId={viewing} onClose={() => setViewing(null)} /> : null}
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
  const [confirmRemove, setConfirmRemove] = useState(false);
  const queryClient = useQueryClient();
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

  async function removeMember(reason: SuspensionReason, reasonText: string | undefined, pin: string | undefined): Promise<RemoveOutcome> {
    try {
      await adminRemoveMember(member.id, reason, reasonText, pin);
      // 서버가 끝났으니 목록에서는 바로 뺀다(다시 불러오기를 기다리지 않는다) — 정지 명단은 뒤에서 새로 읽는다
      queryClient.setQueriesData<{ rows: AdminMemberRow[]; total: number }>({ queryKey: ['admin', 'members'] }, (old) =>
        old ? { rows: old.rows.filter((r) => r.id !== member.id), total: Math.max(0, old.total - 1) } : old,
      );
      showToast(t('admin.members.remove.done'), { tone: 'success' });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'members'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'suspensions'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'suspension-history'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
      return { ok: true };
    } catch (err) {
      const code = err instanceof AdminRemoveMemberError ? err.code : 'failed';
      // 보안코드가 틀렸거나 잠긴 경우는 창이 직접 보여 준다(알림을 따로 띄우지 않는다)
      if (err instanceof AdminRemoveMemberError && code === 'wrong_pin') return { ok: false, kind: 'wrong', attemptsLeft: err.detail.attemptsLeft ?? 0, retryAfter: err.detail.retryAfter };
      if (err instanceof AdminRemoveMemberError && code === 'locked') return { ok: false, kind: 'locked', retryAfter: err.detail.retryAfter ?? 900 };
      if (code === 'failed') captureError(err, { context: 'adminRemoveMember' });
      showToast(code === 'reauth_required' ? t('admin.members.remove.reauth') : code === 'admin_cannot_delete' ? t('admin.members.remove.adminBlocked') : t('admin.members.remove.failed'), { tone: 'error' });
      return { ok: false, kind: 'error' };
    }
  }

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
          <div className={memberStyles.dangerZone}>
            <button type="button" className={memberStyles.dangerBtn} onClick={() => setConfirmRemove(true)}>
              <UserX size={16} aria-hidden="true" /> {t('admin.members.remove.button')}
            </button>
          </div>
        </div>
      ) : null}
      {confirmRemove ? (
        <RemoveMemberDialog
          name={member.display_name || member.handle || member.id.slice(0, 6)}
          onConfirm={removeMember}
          onClose={() => setConfirmRemove(false)}
        />
      ) : null}
    </article>
  );
}

/**
 * 운영 콘솔 '회원' 탭 — 모든 회원을 이름·핸들·이메일로 검색하고, 성별·나잇대·등급·가입일로 거르고,
 * 한 줄을 눌러 이메일·가입일·최근 접속·대략적 위치·만든 여행 목록과 등급·무료 한도를 본다.
 * 최근 접속은 로그인 기록(auth)과 앱 접속 기록(profiles.last_seen_at), 위치는 접속 때 IP로 짐작한 국가·도시(정확한 위치는 모으지 않는다).
 */
export function AdminMembersTab({ onOpenHistory }: { onOpenHistory?: () => void }) {
  const { t } = useTranslation('community');
  // 검색어는 Enter/검색 버튼으로 적용하고, 알약·날짜 필터는 누르는 즉시 적용된다
  const [queryDraft, setQueryDraft] = useState('');
  const [filters, setFilters] = useState<AdminMemberFilters>(NO_FILTER);
  const [page, setPage] = useState(0);
  const [overrides, setOverrides] = useState<Record<string, AdminUserRow>>({});
  const members = useQuery({
    queryKey: ['admin', 'members', filters, page],
    queryFn: () => adminListMembers(filters, page, PAGE_SIZE),
  });
  // 회원별 이용 기록(PostHog) — 연결 전이거나 실패하면 그 줄만 숨긴다
  const activityQuery = useQuery({ queryKey: ['admin', 'user-activity'], queryFn: fetchAdminUserActivity, staleTime: 60_000, retry: false });
  const activityReady = activityQuery.data?.status === 'ok';

  function change(patch: Partial<AdminMemberFilters>) {
    setOverrides({});
    setPage(0);
    setFilters((f) => ({ ...f, ...patch }));
  }

  function reset() {
    setQueryDraft('');
    setFilters(NO_FILTER);
    setPage(0);
    setOverrides({});
  }

  const rows = members.data?.rows ?? [];
  const total = members.data?.total ?? 0;
  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);

  return (
    <div className={memberStyles.wrap}>
      <AdminSuspensionsSection onOpenHistory={onOpenHistory} />
      <AdminFilterBar
        searchValue={queryDraft}
        searchPlaceholder={t('admin.members.searchPlaceholder')}
        onSearchChange={setQueryDraft}
        onSearchSubmit={() => change({ query: queryDraft.trim() })}
        onReset={reset}
        pills={[
          {
            key: 'gender',
            label: t('admin.members.gender'),
            value: filters.gender,
            onChange: (gender) => change({ gender }),
            options: [
              { value: 'female', label: t('companion.gender.female') },
              { value: 'male', label: t('companion.gender.male') },
              { value: 'none', label: t('admin.members.notEntered') },
            ],
          },
          {
            key: 'age',
            label: t('admin.members.age'),
            value: filters.ageBand,
            onChange: (ageBand) => change({ ageBand }),
            options: [...COMPANION_AGES.map((a) => ({ value: a, label: t(`companion.ages.${a}`) })), { value: 'none', label: t('admin.members.notEntered') }],
          },
          {
            key: 'plan',
            label: t('admin.members.plan'),
            value: filters.plan,
            onChange: (plan) => change({ plan }),
            options: [
              { value: 'free', label: t('admin.members.planFree') },
              { value: 'pro', label: 'PRO' },
            ],
          },
        ]}
        dateRange={{
          key: 'joined',
          label: t('admin.members.joinedRange'),
          from: filters.joinedFrom,
          to: filters.joinedTo,
          fromLabel: t('admin.members.joinedFrom'),
          toLabel: t('admin.members.joinedTo'),
          onChange: (joinedFrom, joinedTo) => change({ joinedFrom, joinedTo }),
        }}
      />

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
