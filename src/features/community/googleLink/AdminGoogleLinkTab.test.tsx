import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/shared/i18n';
import i18n from '@/shared/i18n';

const svc = vi.hoisted(() => ({
  load: vi.fn(),
  save: vi.fn(),
  search: vi.fn(),
}));
vi.mock('./googleLinkService', () => ({
  loadLinkOverview: svc.load,
  saveGooglePlaceId: svc.save,
  searchGooglePlaces: svc.search,
}));

import { AdminGoogleLinkTab } from './AdminGoogleLinkTab';

const t = (slug: string, nameEn: string, lat: number, lng: number) => ({
  id: slug,
  slug,
  nameEn,
  countryEn: 'Japan',
  lat,
  lng,
});

function renderTab() {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <AdminGoogleLinkTab />
    </QueryClientProvider>,
  );
}

beforeEach(async () => {
  await i18n.changeLanguage('ko');
  svc.load.mockReset();
  svc.save.mockReset().mockResolvedValue(undefined);
  svc.search.mockReset();
});

describe('AdminGoogleLinkTab', () => {
  it('연동 현황과 시작 버튼을 보여 준다', async () => {
    svc.load.mockResolvedValue({ pending: [t('kyoto', 'Kyoto', 35, 135)], linked: 99, total: 100 });
    renderTab();
    expect(await screen.findByText('구글 장소 연동 99 / 100곳')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '연동 시작 (1곳)' })).toBeEnabled();
  });

  it('모두 연동됐으면 버튼이 꺼진다', async () => {
    svc.load.mockResolvedValue({ pending: [], linked: 100, total: 100 });
    renderTab();
    expect(await screen.findByRole('button', { name: '모두 연동됐어요' })).toBeDisabled();
  });

  it('가까운 장소는 자동 저장하고, 먼 장소는 확인 목록에 올려 "이 장소로 연결"로 정할 수 있다', async () => {
    svc.load.mockResolvedValue({
      pending: [t('tokyo', 'Tokyo', 35.6762, 139.6503), t('kyoto', 'Kyoto', 35.0116, 135.7681)],
      linked: 98,
      total: 100,
    });
    svc.search.mockImplementation(async (q: string) =>
      q.startsWith('Tokyo')
        ? [{ placeId: 'P-tokyo', name: 'Tokyo', lat: 35.68, lng: 139.69, types: ['locality'] }]
        : [{ placeId: 'P-x', name: 'Kyoto Station', lat: 36.5, lng: 137.0, types: ['locality'] }],
    );
    renderTab();
    fireEvent.click(await screen.findByRole('button', { name: '연동 시작 (2곳)' }));
    expect(
      await screen.findByText('확인이 필요한 곳 1곳', undefined, { timeout: 4000 }),
    ).toBeInTheDocument();
    expect(svc.save).toHaveBeenCalledWith('tokyo', 'P-tokyo');
    expect(screen.getByText(/가장 가까운 후보 "Kyoto Station"/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '이 장소로 연결' }));
    await waitFor(() => expect(svc.save).toHaveBeenCalledWith('kyoto', 'P-x'));
  });

  it('현황을 못 읽으면(0079 전) 안내와 다시 시도', async () => {
    svc.load.mockRejectedValue(new Error('no column'));
    renderTab();
    expect(await screen.findByText(/0079 마이그레이션이 적용됐는지/)).toBeInTheDocument();
  });
});
