import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/shared/i18n';
import { NotificationBell } from './NotificationBell';

const session = vi.hoisted(() => ({ user: { id: 'u1' } as { id: string } | null }));
const trips = vi.hoisted(() => ({ data: [] as unknown[] }));
const announce = vi.hoisted(() => ({ rows: [] as unknown[] }));
vi.mock('@/features/notices/useAnnouncements', () => ({ useAnnouncements: () => ({ data: announce.rows }) }));
const community = vi.hoisted(() => ({ rows: [] as unknown[], markRead: vi.fn(), remove: vi.fn() }));
vi.mock('./communityNotices', async () => {
  const actual = await vi.importActual<typeof import('./communityNotices')>('./communityNotices');
  return {
    ...actual,
    listCommunityNotices: async () => (community.rows as Parameters<typeof actual.toCommunityNotice>[0][]).map(actual.toCommunityNotice),
    markCommunityNoticesRead: async () => community.markRead(),
    deleteCommunityNotice: async (id: string) => community.remove(id),
  };
});

vi.mock('@/shared/hooks/useSession', () => ({
  useSession: () => ({ user: session.user, loading: false }),
}));
vi.mock('@/features/plan/hooks/useTrips', () => ({ useTrips: () => ({ data: trips.data }) }));
const travel = vi.hoisted(() => ({ alerts: new Map<string, unknown>() }));
vi.mock('@/features/travelAlerts/useTravelAlerts', () => ({
  useTravelAlerts: () => ({ alerts: travel.alerts, ready: true }),
  useDestinationCoords: () => ({ data: [{ country_code: 'AE', lat: 25.2, lng: 55.27 }] }),
}));

function ymd(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function setTrips() {
  trips.data = [
    {
      id: 't1',
      title: '도쿄 여행',
      city: '도쿄',
      start_date: ymd(1),
      end_date: ymd(3),
      status: 'planning',
    },
    {
      id: 't2',
      title: '오사카 여행',
      city: '오사카',
      start_date: ymd(5),
      end_date: ymd(7),
      status: 'planning',
    },
  ];
}

function setup() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  session.user = { id: 'u1' };
  trips.data = [];
  community.rows = [];
  announce.rows = [];
  community.markRead.mockClear();
  community.remove.mockClear();
  travel.alerts = new Map();
});

describe('NotificationBell', () => {
  it('로그인하지 않았으면 그리지 않는다', () => {
    session.user = null;
    setTrips();
    setup();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('곧 떠나는 여행이 있으면 안 읽은 개수가 뜨고, 열면 내용이 보이며, 닫으면 읽음 처리된다', () => {
    setTrips();
    setup();
    fireEvent.click(screen.getByRole('button', { name: '알림 (안 읽음 2개)' }));
    expect(screen.getByText('내일 출발해요')).toBeInTheDocument();
    expect(screen.getByText('출발이 5일 남았어요')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('button', { name: '알림' })).toBeInTheDocument();
  });

  it('지우면 목록에서 사라지고 새 알림이 없다고 나온다', () => {
    trips.data = [
      {
        id: 't1',
        title: '도쿄 여행',
        city: '도쿄',
        start_date: ymd(0),
        end_date: ymd(2),
        status: 'planning',
      },
    ];
    setup();
    fireEvent.click(screen.getByRole('button', { name: /알림/ }));
    expect(screen.getByText('오늘 출발해요! 즐거운 여행 되세요')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '도쿄 여행 알림 지우기' }));
    expect(screen.getByText('새 알림이 없어요.')).toBeInTheDocument();
  });

  it('여행이 없으면 빈 상태를 보여 준다', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: '알림' }));
    expect(screen.getByText('새 알림이 없어요.')).toBeInTheDocument();
  });

  it('목적지 나라가 2단계 이상이면 여행경보 알림이 뜬다', () => {
    travel.alerts = new Map([
      ['AE', { code: 'AE', nameKo: '아랍에미리트', nameEn: 'UAE', baseLevel: 3, partials: [] }],
    ]);
    trips.data = [
      {
        id: 'd1',
        title: '두바이 여행',
        city: '두바이',
        city_lat: 25.1,
        city_lng: 55.2,
        start_date: ymd(30),
        end_date: ymd(33),
        status: 'planning',
      },
    ];
    setup();
    fireEvent.click(screen.getByRole('button', { name: /알림/ }));
    expect(screen.getByText('두바이 여행')).toBeInTheDocument();
    expect(screen.getByText(/여행경보 3단계\(출국권고\)/)).toBeInTheDocument();
  });

  it('내 글에 달린 댓글·답글·좋아요 알림이 맨 위에 뜨고, 누르면 그 글(댓글)로 가며, 지우면 서버에서 지운다', async () => {
    setTrips();
    community.rows = [
      { id: 'n1', kind: 'post_comment', actor_name: '여행자', post_id: 'p1', comment_id: 'c1', post_title: '도쿄 후기', post_body: '', created_at: new Date().toISOString(), read_at: null },
      { id: 'n2', kind: 'comment_reply', actor_name: '둘리', post_id: 'p1', comment_id: 'c2', post_title: null, post_body: '첫 줄 제목\n둘째', created_at: new Date().toISOString(), read_at: null },
      { id: 'n3', kind: 'post_like', actor_name: '도우너', post_id: 'p2', comment_id: null, post_title: '맛집', post_body: '', created_at: new Date().toISOString(), read_at: new Date().toISOString() },
      { id: 'n4', kind: 'comment_like', actor_name: '또치', post_id: 'p2', comment_id: 'c9', post_title: '맛집', post_body: '', created_at: new Date().toISOString(), read_at: new Date().toISOString() },
    ];
    setup();
    fireEvent.click(await screen.findByRole('button', { name: '알림 (안 읽음 4개)' }));
    expect(screen.getByText('여행자님이 내 글에 댓글을 남겼어요')).toBeInTheDocument();
    expect(screen.getByText('둘리님이 내 댓글에 답글을 남겼어요')).toBeInTheDocument();
    expect(screen.getByText('도우너님이 내 글을 좋아해요')).toBeInTheDocument();
    expect(screen.getByText('또치님이 내 댓글을 좋아해요')).toBeInTheDocument();
    expect(screen.getByText('첫 줄 제목')).toBeInTheDocument();
    expect(screen.getAllByRole('link')[0]).toHaveAttribute('href', '/community/post/p1#comment-c1');
    fireEvent.click(screen.getByRole('button', { name: '도쿄 후기 알림 지우기' }));
    await waitFor(() => expect(community.remove).toHaveBeenCalledWith('n1'));
  });

  it('닫으면 안 읽은 커뮤니티 알림을 서버에 읽음으로 표시한다', async () => {
    community.rows = [{ id: 'n1', kind: 'post_like', actor_name: '여행자', post_id: 'p1', comment_id: null, post_title: '제목', post_body: '', created_at: new Date().toISOString(), read_at: null }];
    setup();
    fireEvent.click(await screen.findByRole('button', { name: '알림 (안 읽음 1개)' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(community.markRead).toHaveBeenCalled());
  });

  it('최근 공지·업데이트가 알림에 뜨고, 누르면 공지 페이지의 그 공지로 간다', async () => {
    announce.rows = [
      { id: 'a1', kind: 'update', title: '3.1.0 업데이트', body: '내용', version: '3.1.0', pinned: false, published: true, published_at: new Date().toISOString(), updated_at: '' },
      { id: 'a2', kind: 'notice', title: '오래된 공지', body: '내용', version: null, pinned: false, published: true, published_at: new Date(Date.now() - 90 * 86_400_000).toISOString(), updated_at: '' },
    ];
    setup();
    fireEvent.click(await screen.findByRole('button', { name: '알림 (안 읽음 1개)' }));
    expect(screen.getByText('3.1.0 업데이트')).toBeInTheDocument();
    expect(screen.getByText('새 업데이트 소식이에요 3.1.0')).toBeInTheDocument();
    expect(screen.queryByText('오래된 공지')).not.toBeInTheDocument();
    expect(screen.getAllByRole('link')[0]).toHaveAttribute('href', '/notices?open=a1');
  });
});
