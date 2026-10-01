import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@/shared/i18n';
import { ToastHost, showToast } from './toast';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  act(() => {
    vi.runAllTimers();
  });
  vi.useRealTimers();
});

describe('토스트', () => {
  it('예전처럼 문자열 하나만 넘겨도 뜬다', () => {
    render(<ToastHost />);
    act(() => showToast('저장했어요'));
    expect(screen.getByText('저장했어요')).toBeInTheDocument();
  });

  it('설명·배지·톤을 함께 보여 준다', () => {
    render(<ToastHost />);
    act(() => showToast('사진 3장이 추가되었어요', { description: '첫 번째 사진이 커버로 자동 지정되었어요', badge: '완료', tone: 'success' }));
    expect(screen.getByText('완료')).toBeInTheDocument();
    expect(screen.getByText('첫 번째 사진이 커버로 자동 지정되었어요')).toBeInTheDocument();
    expect(screen.getByText('사진 3장이 추가되었어요').closest('[data-tone]')).toHaveAttribute('data-tone', 'success');
  });

  it('시간이 지나면 사라지는 애니메이션 뒤에 사라진다', () => {
    render(<ToastHost />);
    act(() => showToast('곧 사라져요', 1000));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    // 사라지는 중에도 잠깐 남아 있다
    expect(screen.getByText('곧 사라져요')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.queryByText('곧 사라져요')).not.toBeInTheDocument();
  });

  it('닫기 버튼으로 바로 닫을 수 있다', () => {
    render(<ToastHost />);
    act(() => showToast('닫아 볼게요', 60_000));
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.queryByText('닫아 볼게요')).not.toBeInTheDocument();
  });
});
