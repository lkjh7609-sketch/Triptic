import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/features/community/hooks/useDestinations', () => ({ useDestinations: () => ({ data: [] }) }));
vi.mock('./useNearestTrip', () => ({ useNearestTrip: () => undefined }));

import { HotelsScreen } from './HotelsScreen';

describe('HotelsScreen', () => {
  it('검색창 아래에 트립닷컴 추천 호텔 배너 3개(300×250)와 Powered by Trip.com이 있다', () => {
    const client = new QueryClient();
    const { container } = render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <HotelsScreen />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const frames = Array.from(container.querySelectorAll('iframe'));
    expect(frames).toHaveLength(3);
    expect(frames.map((f) => new URL(f.src).searchParams.get('trip_sub1'))).toEqual(['home_hotels_card1', 'home_hotels_card2', 'home_hotels_card3']);
    for (const f of frames) {
      expect(f).toHaveAttribute('width', '300');
      expect(f).toHaveAttribute('height', '250');
      expect(f).toHaveAttribute('loading', 'lazy');
      expect(f).not.toHaveAttribute('sandbox');
    }
    // 검색창이 배너보다 먼저(위에)
    const search = screen.getByRole('button', { name: '호텔 검색' });
    expect(search.compareDocumentPosition(frames[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText('Trip.com')).toBeInTheDocument();
    expect(screen.getByText(/Powered by/)).toBeInTheDocument();
  });
});
