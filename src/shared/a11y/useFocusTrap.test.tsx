import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useFocusTrap } from './useFocusTrap';

function Dialog() {
  const ref = useFocusTrap<HTMLDivElement>();
  return (
    <div ref={ref} role="dialog">
      <select aria-label="unit">
        <option>c</option>
      </select>
      <button type="button">save</button>
    </div>
  );
}

describe('useFocusTrap', () => {
  it('열릴 때 첫 <select>가 아니라 컨테이너에 포커스를 준다 (모바일 선택 휠 자동 펼침 방지)', () => {
    render(
      <>
        <button type="button">outside</button>
        <Dialog />
      </>,
    );
    expect(document.activeElement).toBe(screen.getByRole('dialog'));
  });

  it('컨테이너에 포커스가 있을 때 Tab/Shift+Tab이 밖으로 새지 않는다', () => {
    render(<Dialog />);
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'save' }));

    screen.getByRole('dialog').focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByRole('combobox', { name: 'unit' }));
  });
});
