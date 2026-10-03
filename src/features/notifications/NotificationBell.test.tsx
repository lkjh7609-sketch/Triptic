import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/shared/i18n';
import { NotificationBell } from './NotificationBell';

const session = vi.hoisted(() => ({ user: { id: 'u1' } as { id: string } | null }));
const trips = vi.hoisted(() => ({ data: [] as unknown[] }));

vi.mock('@/shared/hooks/useSession', () => ({
  useSession: () => ({ user: session.user, loading: false }),
}));
vi.mock('@/features/plan/hooks/useTrips', () => ({ useTrips: () => ({ data: trips.data }) }));

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
    <MemoryRouter>
      <NotificationBell />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  session.user = { id: 'u1' };
  trips.data = [];
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
});
