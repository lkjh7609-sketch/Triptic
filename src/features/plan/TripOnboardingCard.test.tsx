import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { docs, members, shareExists, track } = vi.hoisted(() => ({
  docs: { data: [] as unknown[], isSuccess: true },
  members: { data: {} as Record<string, unknown[]>, isSuccess: true },
  shareExists: { value: false },
  track: vi.fn(),
}));

vi.mock('@/features/documents/useDocuments', () => ({ useDocumentsList: () => docs }));
vi.mock('./hooks/useTripMembers', () => ({ useTripMembers: () => members }));
vi.mock('@/shared/monitoring', () => ({ track }));
vi.mock('@/shared/api/supabaseClient', () => ({
  getSupabaseClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ limit: () => ({ maybeSingle: async () => ({ data: shareExists.value ? { share_code: 'x' } : null }) }) }) }) }),
  }),
}));

import { TripOnboardingCard } from './TripOnboardingCard';

const handlers = { onAddPlace: vi.fn(), onUploadDocument: vi.fn(), onInvite: vi.fn(), onLocked: vi.fn() };

function renderCard(props: Partial<Parameters<typeof TripOnboardingCard>[0]> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TripOnboardingCard tripId="trip-1" hasPlace={false} isDraft={false} {...handlers} {...props} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  docs.data = [];
  members.data = {};
  shareExists.value = false;
  track.mockClear();
  Object.values(handlers).forEach((fn) => fn.mockClear());
});

describe('TripOnboardingCard', () => {
  it('아무것도 안 했으면 0/3과 세 단계 버튼을 보여 주고, 버튼이 각 동작을 부른다', async () => {
    renderCard();
    expect(await screen.findByText('0/3 완료')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '추가' }));
    fireEvent.click(screen.getByRole('button', { name: '올리기' }));
    fireEvent.click(screen.getByRole('button', { name: '초대' }));
    expect(handlers.onAddPlace).toHaveBeenCalledTimes(1);
    expect(handlers.onUploadDocument).toHaveBeenCalledTimes(1);
    expect(handlers.onInvite).toHaveBeenCalledTimes(1);
  });

  it('완료 여부는 실제 데이터에서 계산한다 — 장소·서류·멤버 2명', async () => {
    docs.data = [{ id: 'd1' }];
    members.data = { 'trip-1': [{ userId: 'a' }, { userId: 'b' }] };
    renderCard({ hasPlace: true });
    // 셋 다 끝났으면 카드가 없다
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByText(/완료/)).not.toBeInTheDocument();
  });

  it('공유 링크만 만들어도 초대 단계는 끝난 것으로 본다', async () => {
    shareExists.value = true;
    renderCard({ hasPlace: true });
    expect(await screen.findByText('2/3 완료')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '초대' })).not.toBeInTheDocument();
  });

  it('닫으면 그 여행에서는 다시 안 뜬다', async () => {
    const { unmount } = renderCard();
    fireEvent.click(await screen.findByRole('button', { name: '안내 닫기' }));
    expect(screen.queryByText('0/3 완료')).not.toBeInTheDocument();
    unmount();
    renderCard();
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByText('0/3 완료')).not.toBeInTheDocument();
  });

  it('임시 여행은 서류·초대를 누르면 로그인 안내를 부른다', async () => {
    renderCard({ isDraft: true, hasPlace: true });
    fireEvent.click(await screen.findByRole('button', { name: '올리기' }));
    fireEvent.click(screen.getByRole('button', { name: '초대' }));
    expect(handlers.onLocked).toHaveBeenCalledTimes(2);
    expect(handlers.onUploadDocument).not.toHaveBeenCalled();
    expect(handlers.onInvite).not.toHaveBeenCalled();
  });

  it('이 화면에서 아직 → 끝으로 바뀐 단계만 분석 이벤트를 보낸다', async () => {
    const view = renderCard({ hasPlace: false });
    await screen.findByText('0/3 완료');
    expect(track).not.toHaveBeenCalled();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    view.rerender(
      <QueryClientProvider client={client}>
        <TripOnboardingCard tripId="trip-1" hasPlace isDraft={false} {...handlers} />
      </QueryClientProvider>,
    );
    await screen.findByText('1/3 완료');
    expect(track).toHaveBeenCalledWith('onboarding_step_done', { step: 'place' });
    expect(track).toHaveBeenCalledTimes(1);
  });
});
