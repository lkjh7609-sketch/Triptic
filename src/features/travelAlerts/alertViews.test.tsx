import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it } from 'vitest';
import '@/shared/i18n';
import i18n from '@/shared/i18n';
import { ChannelAlertBanner } from './ChannelAlertBanner';
import { TravelAlertSummary } from './TravelAlertSummary';
import type { TravelAlertRow } from './alertInfo';

const rows: TravelAlertRow[] = [
  {
    country_code: 'AE',
    country_name_ko: '아랍에미리트',
    country_name_en: 'UAE',
    alarm_lvl: 3,
    region_scope: 'all',
    remark: '전 지역',
    is_base: true,
  },
  {
    country_code: 'PH',
    country_name_ko: '필리핀',
    country_name_en: 'Philippines',
    alarm_lvl: 4,
    region_scope: 'part',
    remark: '민다나오 잠보앙가',
    is_base: false,
  },
  {
    country_code: 'PH',
    country_name_ko: '필리핀',
    country_name_en: 'Philippines',
    alarm_lvl: 2,
    region_scope: 'part',
    remark: '그 외 지역',
    is_base: true,
  },
];

function renderWith(ui: React.ReactElement) {
  const client = new QueryClient();
  client.setQueryData(['travel-alerts'], rows);
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(async () => {
  await i18n.changeLanguage('ko');
});

describe('ChannelAlertBanner', () => {
  it('한 줄만 보이고, 누르면 팝업에 자세한 안내와 일부 지역 경보가 나온다', () => {
    renderWith(<ChannelAlertBanner countryCode="PH" />);
    expect(screen.getByText(/필리핀 여행경보 2단계\(여행자제\)/)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText(/민다나오 잠보앙가/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /필리핀 여행경보/ }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/일부 지역 4단계\(여행금지\): 민다나오 잠보앙가/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('경보가 없거나 1단계 나라에서는 아무것도 그리지 않는다', () => {
    const { container } = renderWith(<ChannelAlertBanner countryCode="JP" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('TravelAlertSummary', () => {
  it('홈에는 한 줄만 있고, 누르면 아래로 펼치지 않고 팝업에서 단계별 나라를 보여 준다', () => {
    renderWith(<TravelAlertSummary />);
    expect(screen.getByText('2단계 이상 2개국')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /현재 여행경보 현황/ }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('3단계 출국권고');
    expect(dialog).toHaveTextContent('아랍에미리트');
    expect(dialog).toHaveTextContent('2단계 여행자제');
    expect(dialog).toHaveTextContent('필리핀');
  });

  it('PC에서는 도시 선택 옆의 짧은 알약 버튼이고, 눌렀을 때 같은 팝업이 열린다', () => {
    renderWith(<TravelAlertSummary variant="button" />);
    expect(screen.getByText('여행경보 2개국')).toBeInTheDocument();
    expect(screen.queryByText('2단계 이상 2개국')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /현재 여행경보 현황/ }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('3단계 출국권고');
    expect(dialog).toHaveTextContent('필리핀');
  });
});
