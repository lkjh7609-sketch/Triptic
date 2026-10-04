import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import '@/shared/i18n';
import { FloatingMapInspector } from './FloatingMapInspector';

afterEach(() => localStorage.clear());

describe('FloatingMapInspector — 접기', () => {
  it('접으면 작은 동그라미 버튼이 되고, 누르면 다시 펼쳐진다', () => {
    render(<FloatingMapInspector title="센소지" subtitle="도쿄" time="10:00" />);
    expect(screen.getByRole('heading', { name: '센소지' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '카드 접기' }));
    expect(screen.queryByRole('heading', { name: '센소지' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '센소지 카드 펼치기' }));
    expect(screen.getByRole('heading', { name: '센소지' })).toBeInTheDocument();
  });

  it('접어 둔 상태는 기억해서 다음에도 접힌 채 열린다', () => {
    const first = render(<FloatingMapInspector title="센소지" subtitle="도쿄" />);
    fireEvent.click(screen.getByRole('button', { name: '카드 접기' }));
    first.unmount();
    render(<FloatingMapInspector title="우에노" subtitle="도쿄" />);
    expect(screen.getByRole('button', { name: '우에노 카드 펼치기' })).toBeInTheDocument();
  });
});
