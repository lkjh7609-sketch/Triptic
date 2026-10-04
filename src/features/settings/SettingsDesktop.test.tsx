import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/shared/i18n';

const state = vi.hoisted(() => ({
  profile: { id: 'u1', display_name: '관리자', handle: 'dfxrj', plan: 'pro', locale: 'ko', temp_unit: 'c', distance_unit: 'km', base_currency: 'KRW', notification_prefs: { preDeparture: true, flightChanges: false, communityReplies: true, marketing: false }, gender: null, age_band: null, demographics_skips: 0, avatar_url: null, trips_created_count: 3, trip_limit: 5 } as Record<string, unknown>,
  mutate: vi.fn(),
}));

vi.mock('@/shared/hooks/useSession', () => ({ useSession: () => ({ user: { id: 'u1', email: 'a@b.c', app_metadata: { provider: 'kakao' }, user_metadata: {} }, loading: false }) }));
vi.mock('@/shared/hooks/useProfile', () => ({ useProfile: () => ({ data: state.profile }), useUpdateProfile: () => ({ mutate: state.mutate, mutateAsync: vi.fn(), isPending: false }) }));
vi.mock('@/features/plan/hooks/useTrips', () => ({ useTrips: () => ({ data: [], refetch: vi.fn() }) }));
vi.mock('@/features/plan/BackupModal', () => ({ BackupModal: () => null }));
vi.mock('./BlockedUsersList', () => ({ BlockedUsersList: () => <p>차단한 사용자가 없어요.</p> }));
vi.mock('@/shared/push/registerPush', () => ({ registerPushNotifications: vi.fn().mockResolvedValue(true) }));
vi.mock('@/shared/api/authService', () => ({ signOut: vi.fn(), signInProviderOf: () => 'kakao' }));

import { SettingsDesktop } from './SettingsDesktop';

function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <SettingsDesktop />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  state.mutate.mockReset();
  state.profile.plan = 'pro';
});

describe('SettingsDesktop', () => {
  it('처음엔 계정 정보만 보이고, 메뉴를 누르면 그 메뉴의 내용만 보인다(탭처럼)', () => {
    renderPage();
    expect(screen.getByText('@dfxrj')).toBeInTheDocument();
    expect(screen.queryByText('성별 및 나이대')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /동행 매칭 정보/ }));
    expect(screen.getByRole('heading', { name: '성별 및 나이대' })).toBeInTheDocument();
    expect(screen.queryByText('@dfxrj')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /디스플레이 & 언어/ }));
    expect(screen.getByRole('heading', { name: '디스플레이 및 환경설정' })).toBeInTheDocument();
  });

  it('동행 매칭 정보에는 배지가 없고, 성별·나잇대를 고르면 바로 저장한다', () => {
    renderPage();
    expect(screen.queryByText('필수')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /동행 매칭 정보/ }));
    fireEvent.click(screen.getByRole('radio', { name: '여성' }));
    expect(state.mutate).toHaveBeenCalledWith({ gender: 'female', age_band: null });
  });

  it('Pro 박스는 프로 회원에게만 보인다', () => {
    const { unmount } = renderPage();
    expect(screen.getByText('Pro 혜택 활성화됨')).toBeInTheDocument();
    unmount();
    state.profile.plan = 'free';
    renderPage();
    expect(screen.queryByText('Pro 혜택 활성화됨')).not.toBeInTheDocument();
  });

  it('무료 회원에게는 무료 티어와 남은 여행 생성 개수가 보이고, 다 쓰면 소진 안내가 나온다', () => {
    state.profile.plan = 'free';
    const { unmount } = renderPage();
    expect(screen.getByText('무료 티어')).toBeInTheDocument();
    expect(screen.getByText('여행 생성 3 / 5개 사용')).toBeInTheDocument();
    expect(screen.getByText('남은 여행 생성 2개')).toBeInTheDocument();
    unmount();
    state.profile.trips_created_count = 5;
    renderPage();
    expect(screen.getByText('여행 생성 한도를 모두 썼어요')).toBeInTheDocument();
    state.profile.trips_created_count = 3;
  });

  it('프로필 사진 변경 버튼이 있고, 올린 사진이 있을 때만 사진 삭제가 보인다', () => {
    const { unmount } = renderPage();
    expect(screen.getByRole('button', { name: '프로필 사진 변경' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '사진 삭제' })).not.toBeInTheDocument();
    unmount();
    state.profile.avatar_url = 'https://x.supabase.co/storage/v1/object/public/avatars/u1/avatar.webp?v=1';
    renderPage();
    expect(screen.getByRole('button', { name: '사진 삭제' })).toBeInTheDocument();
    state.profile.avatar_url = null;
  });

  it('로그인 세션 카드는 현재 기기만 보여 주고, 카카오 가입자의 비밀번호 변경은 안내 창이 뜬다', () => {
    renderPage();
    expect(screen.getByText(/현재 사용 중인 기기:/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /비밀번호 변경하기/ }));
    expect(screen.getByText(/카카오로 가입했어요/)).toBeInTheDocument();
  });

  it('알림 스위치는 바꾸는 즉시 저장한다', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /알림 수신 설정/ }));
    fireEvent.click(screen.getByRole('switch', { name: '마케팅 및 특가 소식' }));
    expect(state.mutate).toHaveBeenCalledWith({ notification_prefs: { preDeparture: true, flightChanges: false, communityReplies: true, marketing: true } });
  });
});
