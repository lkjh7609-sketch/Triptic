import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import '@/shared/i18n';

let native = false;
vi.mock('@/shared/platform', () => ({ isNativeApp: () => native }));
vi.mock('@/shared/monitoring', () => ({ trackScreenView: () => {} }));
vi.mock('./HomeSectionTabs', () => ({ HomeSectionTabs: () => null }));
vi.mock('./hotels/HotelSearchForm', () => ({ HotelSearchForm: () => <div data-testid="form" /> }));
vi.mock('./hotels/HotelResults', () => ({ HotelResults: () => <div data-testid="results" /> }));
vi.mock('./hotels/RecommendedDestinations', () => ({ RecommendedDestinations: () => <div data-testid="recommend" /> }));

import { HotelsScreen } from './HotelsScreen';

const at = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <HotelsScreen />
    </MemoryRouter>,
  );

describe('호텔 탭 — 웹·앱 모두 우리 검색 화면', () => {
  it.each([false, true])('검색폼 + 추천 여행지, 위젯은 안 띄운다(앱=%s)', (isNative) => {
    native = isNative;
    at('/hotels');
    expect(screen.getByTestId('form')).toBeInTheDocument();
    expect(screen.getByTestId('recommend')).toBeInTheDocument();
    expect(screen.queryByTestId('widget')).toBeNull();
    expect(screen.queryByTestId('results')).toBeNull();
  });

  it.each([false, true])('주소에 검색 조건이 있으면 결과 목록을 보여 준다(앱=%s)', (isNative) => {
    native = isNative;
    at('/hotels?name=%EB%B0%A9%EC%BD%95&lat=13.75&lng=100.5&checkin=2026-11-20&checkout=2026-11-22&adults=2');
    expect(screen.getByTestId('results')).toBeInTheDocument();
  });
});
