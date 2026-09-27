import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * 모달/시트용 포커스 트랩 (01-design-system.md §8 접근성 체크리스트,
 * DEVELOPMENT_PLAN.md §9 Phase 6 완료 기준 "VoiceOver로 완주 가능").
 * 열리는 순간 컨테이너 자체로 포커스를 옮기고, Tab/Shift+Tab이
 * 컨테이너 밖으로 나가지 않게 가두며, Escape로 닫을 수 있게 한다.
 * 첫 요소가 아니라 컨테이너에 포커스를 주는 이유: 첫 요소가 <select>면
 * 모바일(iOS)에서 포커스만으로 선택 휠이 자동으로 펼쳐졌다.
 *
 * 사용: `const ref = useFocusTrap<HTMLDivElement>(onClose); return <div ref={ref}>...`
 */
export function useFocusTrap<T extends HTMLElement>(onClose?: () => void) {
  const containerRef = useRef<T | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    if (!container.hasAttribute('tabindex')) container.tabIndex = -1;
    container.dataset.focusTrap = '';
    container.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && onClose) {
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !container) return;
      const current = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (current.length === 0) return;
      const first = current[0];
      const last = current[current.length - 1];
      // 열린 직후엔 컨테이너 자체에 포커스가 있어 first/last 비교로는 밖으로 샌다
      if (document.activeElement === container) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onClose는 매 렌더 새 함수여도 트랩 재설정이 필요 없다
  }, []);

  return containerRef;
}
