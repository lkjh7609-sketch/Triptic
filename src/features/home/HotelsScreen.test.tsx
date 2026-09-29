import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const wideMock = vi.hoisted(() => ({ value: true }));
vi.mock('@/shared/hooks/useMediaQuery', () => ({ useMediaQuery: () => wideMock.value }));

import { HotelsScreen } from './HotelsScreen';

function renderScreen() {
  return render(
    <MemoryRouter>
      <HotelsScreen />
    </MemoryRouter>,
  );
}

describe('HotelsScreen', () => {
  beforeEach(() => {
    wideMock.value = true;
  });

  it('넓은 화면에서는 트립닷컴 검색창 위젯을 999×222로 띄운다(스크롤바·테두리 없이)', () => {
    renderScreen();
    const frame = screen.getByTitle('트립닷컴 호텔 검색');
    expect(frame.tagName).toBe('IFRAME');
    expect(frame).toHaveAttribute(
      'src',
      'https://kr.trip.com/partners/ad/S20018532?Allianceid=10792895&SID=332524291&trip_sub1=home_hotels',
    );
    expect(frame).toHaveAttribute('width', '999');
    expect(frame).toHaveAttribute('height', '222');
    expect(frame).toHaveAttribute('scrolling', 'no');
    expect(frame).toHaveAttribute('loading', 'lazy');
    expect(frame).not.toHaveAttribute('sandbox'); // sandbox를 걸면 위젯이 결과 창을 못 연다
    expect(screen.queryByRole('link', { name: /아고다/ })).not.toBeInTheDocument();
  });

  it('좁은 화면(폰)에서는 위젯을 아예 만들지 않고 아고다 버튼을 둔다', () => {
    wideMock.value = false;
    const { container } = renderScreen();
    expect(container.querySelector('iframe')).toBeNull();
    expect(screen.getByRole('link', { name: /아고다에서 숙소 찾기/ })).toHaveAttribute('href', 'https://www.agoda.com/');
  });
});
