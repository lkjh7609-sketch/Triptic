import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/shared/i18n';
import { DestinationSelector } from './DestinationSelector';
import type { Destination } from './types';

function dest(
  id: string,
  name: string,
  country_code: string,
  over: Partial<Destination> = {},
): Destination {
  return {
    id,
    name,
    country_code,
    slug: id,
    lat: 0,
    lng: 0,
    timezone: 'UTC',
    currency: null,
    cover_url: null,
    is_featured: true,
    sort_order: 1,
    post_count: 0,
    ...over,
  };
}

const list = [dest('tokyo', '도쿄', 'JP'), dest('paris', '파리', 'FR', { sort_order: 2 })];

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function setup(
  path = '/community',
  props: Partial<React.ComponentProps<typeof DestinationSelector>> = {},
) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <DestinationSelector destinations={list} {...props} />
              <Where />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => localStorage.clear());

describe('DestinationSelector', () => {
  it('알약 줄 대신 버튼 하나만 보이고, 누르면 선택 창이 열려 고르면 그 도시 채널로 간다', async () => {
    setup();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('도쿄')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '도시 선택' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByText('도쿄'));
    fireEvent.click(screen.getByRole('button', { name: '선택 완료' }));
    await waitFor(() =>
      expect(screen.getByTestId('where')).toHaveTextContent('/community/d/tokyo'),
    );
  });

  it('?continent=AS로 들어오면 선택 창이 아시아 탭으로 바로 열린다', () => {
    setup('/community?continent=AS');
    expect(screen.getByRole('tab', { name: '아시아', selected: true })).toBeInTheDocument();
  });

  it('필터로 쓸 때는 고른 도시 이름이 버튼에 보이고 "어디든 상관없어요"로 비운다', async () => {
    const onClear = vi.fn();
    setup('/community', { onCitySelect: vi.fn(), onClear, selectedDestinationId: 'paris' });
    expect(screen.getByRole('button', { name: '파리' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '파리' }));
    fireEvent.click(screen.getByRole('button', { name: '어디든 상관없어요' }));
    await waitFor(() => expect(onClear).toHaveBeenCalled());
  });
});
