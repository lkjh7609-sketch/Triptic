import { isNativeApp } from '../platform';

const CLEAR_EVENTS = ['input', 'change'] as const;

function isFormControl(el: HTMLElement): el is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement;
}

function buzz() {
  try {
    if (isNativeApp()) {
      void import('@capacitor/haptics').then(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Light })).catch(() => {});
    } else if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(30);
    }
  } catch {
    // 진동이 안 되는 기기는 흔들림·빨간 테두리만으로 충분하다
  }
}

/** 값이 입력 이벤트 없이 바뀌는 필드(달력·목록 선택 등)에서 직접 되돌릴 때 쓴다 */
export function clearInvalid(el: HTMLElement | null | undefined): void {
  if (el) clear(el);
}

function clear(el: HTMLElement) {
  el.removeAttribute('data-invalid');
  el.removeAttribute('data-shake');
  if (isFormControl(el)) el.removeAttribute('aria-invalid');
}

/**
 * 필수 입력이 비어 다음 단계로 못 갈 때 그 필드를 알린다 — 테두리가 빨갛게 바뀌고 살짝 흔들리며
 * (모바일은 짧은 진동), 첫 필드로 포커스가 간다. 스타일은 global.css의 [data-invalid].
 * 값을 고치면(input/change) 저절로 원래대로 돌아온다. 인자가 여러 개면 전부 표시하고 첫 번째에 포커스한다.
 */
export function flagInvalid(...targets: Array<HTMLElement | null | undefined>): void {
  const els = targets.filter((el): el is HTMLElement => !!el && el.isConnected);
  if (els.length === 0) return;

  for (const el of els) {
    el.removeAttribute('data-shake');
    void el.offsetWidth; // 같은 필드를 연달아 눌러도 흔들림이 처음부터 다시 돈다
    el.setAttribute('data-invalid', 'true');
    el.setAttribute('data-shake', '');
    if (isFormControl(el)) el.setAttribute('aria-invalid', 'true');

    const onFix = () => {
      clear(el);
      for (const type of CLEAR_EVENTS) el.removeEventListener(type, onFix);
    };
    for (const type of CLEAR_EVENTS) el.addEventListener(type, onFix);
  }

  const first = els[0];
  const focusable = isFormControl(first) ? first : first.querySelector<HTMLElement>('input, textarea, select, button');
  (focusable ?? first).focus({ preventScroll: true });
  first.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  buzz();
}
