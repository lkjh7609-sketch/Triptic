import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/shared/i18n';

const state = vi.hoisted(() => ({
  user: { id: 'u1' } as { id: string } | null,
  profile: { gender: null, age_band: null, demographics_skips: 0 } as unknown,
  mutateAsync: vi.fn(),
  skip: vi.fn(),
}));

vi.mock('@/shared/hooks/useSession', () => ({ useSession: () => ({ user: state.user }) }));
vi.mock('@/shared/hooks/useProfile', () => ({
  useProfile: () => ({ data: state.profile }),
  useUpdateProfile: () => ({ mutateAsync: state.mutateAsync, isPending: false }),
  profileQueryKey: (id: string) => ['profile', id],
}));
vi.mock('@/shared/api/profileService', () => ({ skipMyDemographics: () => state.skip() }));
vi.mock('@/shared/a11y/useFocusTrap', () => ({ useFocusTrap: () => ({ current: null }) }));

import { DemographicsPrompt, shouldAskDemographics } from './DemographicsPrompt';

function renderPrompt() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <DemographicsPrompt />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  state.user = { id: 'u1' };
  state.profile = { gender: null, age_band: null, demographics_skips: 0 };
  state.mutateAsync.mockReset().mockResolvedValue(undefined);
  state.skip.mockReset().mockResolvedValue(undefined);
});

describe('shouldAskDemographics', () => {
  it('둘 중 하나라도 비어 있고 두 번 미만 건너뛰었을 때만 묻는다', () => {
    expect(shouldAskDemographics({ gender: null, age_band: null, demographics_skips: 0 })).toBe(true);
    expect(shouldAskDemographics({ gender: 'male', age_band: null, demographics_skips: 1 })).toBe(true);
    expect(shouldAskDemographics({ gender: 'male', age_band: '40s', demographics_skips: 0 })).toBe(false);
    expect(shouldAskDemographics({ gender: null, age_band: null, demographics_skips: 2 })).toBe(false);
    expect(shouldAskDemographics(undefined)).toBe(false);
  });
});

describe('DemographicsPrompt', () => {
  it('이유를 밝히고, 고른 값을 저장한다', async () => {
    renderPrompt();
    expect(screen.getByText(/동행 모집글과 지원 화면/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: '20대 후반' }));
    fireEvent.click(screen.getByRole('radio', { name: '여성' }));
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(state.mutateAsync).toHaveBeenCalledWith({ gender: 'female', age_band: '20s_late' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('"나중에"는 서버에 건너뜀을 알리고 닫는다', async () => {
    renderPrompt();
    fireEvent.click(screen.getByRole('button', { name: '나중에' }));
    await waitFor(() => expect(state.skip).toHaveBeenCalled());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('이미 입력했으면 뜨지 않는다', () => {
    state.profile = { gender: 'male', age_band: '30s_early', demographics_skips: 0 };
    renderPrompt();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
