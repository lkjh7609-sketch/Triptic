import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminUserRow } from './adminService';

const { adminSetTripLimit, adminSetUserPlan } = vi.hoisted(() => ({ adminSetTripLimit: vi.fn(), adminSetUserPlan: vi.fn() }));
vi.mock('./adminService', async () => ({
  ...(await vi.importActual<typeof import('./adminService')>('./adminService')),
  adminSetTripLimit,
  adminSetUserPlan,
}));

import { AdminUserPlanRow } from './AdminUserPlanRow';
import { parseLimit } from './adminService';

const base: AdminUserRow = { id: 'u1', handle: 'abc12', display_name: '김철수님', avatar_url: null, plan: 'free', trips_created_count: 3, trip_limit: 5 };
const onChanged = vi.fn();

beforeEach(() => {
  adminSetTripLimit.mockReset();
  adminSetUserPlan.mockReset();
  onChanged.mockReset();
});

describe('parseLimit', () => {
  it('0~1000 정수만 받는다', () => {
    expect(parseLimit('0')).toBe(0);
    expect(parseLimit('1000')).toBe(1000);
    for (const bad of ['', '-1', '1001', '1.5', 'abc', '99999']) expect(parseLimit(bad), bad).toBeNull();
  });
});

describe('AdminUserPlanRow — 무료 사용자', () => {
  it('사용/한도/남은 개수를 보여 준다(3/5 → 남은 2)', () => {
    render(<AdminUserPlanRow user={base} onChanged={onChanged} />);
    expect(screen.getByText(/여행 3\/5개 사용 · 남은 2개/)).toBeInTheDocument();
    expect(screen.getByText(/한도 5개 적용/)).toBeInTheDocument(); // 원래 2개보다 늘어난 한도 표시
  });

  it('한도를 다 쓰면 소진 표시, 남은 개수는 0', () => {
    render(<AdminUserPlanRow user={{ ...base, trips_created_count: 5 }} onChanged={onChanged} />);
    expect(screen.getByText(/남은 0개/)).toBeInTheDocument();
    expect(screen.getByText('한도 소진')).toBeInTheDocument();
  });

  it('+버튼은 초안만 바꾸고, 저장을 눌러야 서버에 새 한도(값)를 보낸다', async () => {
    adminSetTripLimit.mockResolvedValue(10);
    render(<AdminUserPlanRow user={base} onChanged={onChanged} />);
    const save = screen.getByRole('button', { name: '저장' });
    expect(save).toBeDisabled(); // 바뀐 게 없으면 못 누른다
    fireEvent.click(screen.getByRole('button', { name: '+5' }));
    expect(adminSetTripLimit).not.toHaveBeenCalled();
    expect(screen.getByText('저장하면 한도 10개 · 남은 7개')).toBeInTheDocument();
    fireEvent.click(save);
    await waitFor(() => expect(adminSetTripLimit).toHaveBeenCalledWith('u1', 10));
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith({ ...base, trip_limit: 10 }));
    expect(await screen.findByText('저장했어요')).toBeInTheDocument();
  });

  it('직접 입력한 값도 저장하고, 잘못된 값은 저장을 막는다', async () => {
    adminSetTripLimit.mockResolvedValue(20);
    render(<AdminUserPlanRow user={base} onChanged={onChanged} />);
    const input = screen.getByLabelText('한도');
    fireEvent.change(input, { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(adminSetTripLimit).toHaveBeenCalledWith('u1', 20));
    fireEvent.change(input, { target: { value: '' } });
    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
    expect(screen.getByText(/0~1000 사이 숫자/)).toBeInTheDocument();
  });

  it('저장이 실패하면 안내하고 한도는 그대로 둔다', async () => {
    adminSetTripLimit.mockRejectedValue(new Error('forbidden'));
    render(<AdminUserPlanRow user={base} onChanged={onChanged} />);
    fireEvent.click(screen.getByRole('button', { name: '+1' }));
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(await screen.findByText('저장하지 못했어요. 다시 시도해 주세요.')).toBeInTheDocument();
    expect(onChanged).not.toHaveBeenCalled();
  });
});

describe('AdminUserPlanRow — 프로 사용자', () => {
  it('한도 대신 생성 수만 보이고 한도 조정칸은 없다', () => {
    render(<AdminUserPlanRow user={{ ...base, plan: 'pro' }} onChanged={onChanged} />);
    expect(screen.getByText(/여행 3개 생성 · 한도 없음/)).toBeInTheDocument();
    expect(screen.queryByLabelText('한도')).not.toBeInTheDocument();
  });
});

describe('AdminUserPlanRow — 이용 기록(PostHog)', () => {
  it('연결 전이면(activity 없음) 이용 기록 줄을 숨긴다', () => {
    render(<AdminUserPlanRow user={base} onChanged={onChanged} />);
    expect(screen.queryByText(/마지막 접속/)).not.toBeInTheDocument();
    expect(screen.queryByText(/접속 기록 없음/)).not.toBeInTheDocument();
  });

  it('기록이 있으면 활동한 날·화면 조회 수를 보여 준다', () => {
    const lastSeen = new Date(Date.now() - 3 * 3600_000).toISOString();
    render(<AdminUserPlanRow user={base} onChanged={onChanged} activity={{ events: 20, views: 14, days: 4, lastSeen }} activityWindowDays={90} />);
    expect(screen.getByText(/활동 4일 · 화면 조회 14회 \(최근 90일\)/)).toBeInTheDocument();
  });

  it('기록이 null이면 "기록 없음"', () => {
    render(<AdminUserPlanRow user={base} onChanged={onChanged} activity={null} activityWindowDays={90} />);
    expect(screen.getByText(/최근 90일 접속 기록 없음/)).toBeInTheDocument();
  });
});
