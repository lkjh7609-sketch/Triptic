import { render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { bootShellKind, captureBootShell } from './bootShellState';
import { BootShell } from './BootShell';

afterEach(() => {
  document.body.innerHTML = '';
  captureBootShell(); // 저장값 비우기
});

describe('bootShellKind', () => {
  it('홈은 홈 모양, 4탭 화면은 머리줄·탭바만, 그 밖은 배경만', () => {
    expect(bootShellKind('/')).toBe('home');
    expect(bootShellKind('/flights')).toBe('shell');
    expect(bootShellKind('/community/')).toBe('shell');
    expect(bootShellKind('/plan')).toBe('shell');
    expect(bootShellKind('/plan/abc')).toBe('bare');
    expect(bootShellKind('/community/post/1')).toBe('bare');
    expect(bootShellKind('/shared/xyz')).toBe('bare');
  });
});

describe('BootShell', () => {
  it('React가 지우기 전에 저장한 index.html 뼈대를 같은 id로 다시 그린다(부팅 안전망이 알아봄)', () => {
    document.body.innerHTML = '<div id="root"><div id="boot-shell" data-boot="home"><div class="bs-top"></div></div></div>';
    captureBootShell();
    document.body.innerHTML = '';
    const { container } = render(<BootShell fallback={<p>fallback</p>} />);
    const shell = container.querySelector('#boot-shell');
    expect(shell?.querySelector('.bs-top')).not.toBeNull();
    expect(shell?.getAttribute('aria-hidden')).toBe('true');
    expect(container.textContent).toBe('');
  });

  it('저장된 뼈대가 없으면 fallback', () => {
    const { container } = render(<BootShell fallback={<p>fallback</p>} />);
    expect(container.textContent).toBe('fallback');
  });
});
