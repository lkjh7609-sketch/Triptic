import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/shared/i18n';
import { WorldMap } from './WorldMap';

const places = [{ key: 'seoul', name: '서울', country: 'KR', lat: 37.56, lng: 126.98 }];

function touchEvent(type: string, points: { x: number; y: number }[], cancelable = true) {
  const e = new Event(type, { bubbles: true, cancelable });
  Object.assign(e, { touches: points.map((p) => ({ clientX: p.x, clientY: p.y })) });
  return e;
}

function viewBoxOf(container: HTMLElement): number[] {
  return (container.querySelector('svg')?.getAttribute('viewBox') ?? '').split(' ').map(Number);
}

describe('WorldMap 터치 조작', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 300,
      bottom: 375,
      width: 300,
      height: 375,
      toJSON: () => ({}),
    });
  });

  async function renderMap() {
    const utils = render(<WorldMap countries={['KR']} places={places} />);
    await waitFor(() => expect(utils.container.querySelector('svg')).not.toBeNull());
    const box = utils.container.firstElementChild as HTMLElement;
    return { ...utils, box };
  }

  it('다녀온 도시가 있으면 처음부터 그곳으로 확대돼 있다', async () => {
    const { container } = await renderMap();
    await waitFor(() => expect(viewBoxOf(container)[2]).toBeLessThan(1000));
  });

  it('한 손가락 이동은 가로채지 않는다(페이지 스크롤에 맡김)', async () => {
    const { box, container } = await renderMap();
    await waitFor(() => expect(viewBoxOf(container)[2]).toBeLessThan(1000));
    const before = viewBoxOf(container);
    const start = touchEvent('touchstart', [{ x: 100, y: 100 }]);
    const move = touchEvent('touchmove', [{ x: 160, y: 100 }]);
    act(() => {
      box.dispatchEvent(start);
      box.dispatchEvent(move);
    });
    expect(move.defaultPrevented).toBe(false);
    expect(viewBoxOf(container)).toEqual(before);
  });

  it('두 손가락을 벌리면 확대하고 페이지 스크롤은 막는다', async () => {
    const { box, container } = await renderMap();
    await waitFor(() => expect(viewBoxOf(container)[2]).toBeLessThan(1000));
    const before = viewBoxOf(container);
    const move = touchEvent('touchmove', [
      { x: 60, y: 150 },
      { x: 240, y: 150 },
    ]);
    act(() => {
      box.dispatchEvent(
        touchEvent('touchstart', [
          { x: 120, y: 150 },
          { x: 180, y: 150 },
        ]),
      );
      box.dispatchEvent(move);
    });
    expect(move.defaultPrevented).toBe(true);
    expect(viewBoxOf(container)[2]).toBeLessThan(before[2]);
  });

  it('취소할 수 없는 이벤트(이미 스크롤 중)는 건드리지 않는다', async () => {
    const { box, container } = await renderMap();
    await waitFor(() => expect(viewBoxOf(container)[2]).toBeLessThan(1000));
    const before = viewBoxOf(container);
    const move = touchEvent(
      'touchmove',
      [
        { x: 60, y: 150 },
        { x: 240, y: 150 },
      ],
      false,
    );
    act(() => {
      box.dispatchEvent(
        touchEvent('touchstart', [
          { x: 120, y: 150 },
          { x: 180, y: 150 },
        ]),
      );
      box.dispatchEvent(move);
    });
    expect(viewBoxOf(container)).toEqual(before);
  });

  function pointer(type: string, init: { x: number; y: number; target?: EventTarget }) {
    const e = new Event(type, { bubbles: true, cancelable: true });
    Object.assign(e, { pointerType: 'mouse', pointerId: 1, button: 0, clientX: init.x, clientY: init.y });
    return e;
  }

  it('PC: 마우스로 누른 채 끌면 지도가 움직인다', async () => {
    const { box, container } = await renderMap();
    await waitFor(() => expect(viewBoxOf(container)[2]).toBeLessThan(1000));
    const before = viewBoxOf(container);
    const svg = container.querySelector('svg') as SVGElement;
    act(() => {
      svg.dispatchEvent(pointer('pointerdown', { x: 100, y: 100 }));
      box.dispatchEvent(pointer('pointermove', { x: 160, y: 130 }));
    });
    const after = viewBoxOf(container);
    expect(after[2]).toBeCloseTo(before[2]); // 폭은 그대로
    expect(after[0]).not.toBeCloseTo(before[0]); // 가로로 움직였다
    act(() => {
      box.dispatchEvent(pointer('pointerup', { x: 160, y: 130 }));
    });
  });

  it('PC: 버튼을 누를 때는 끌기로 오인하지 않아 +/− 버튼이 그대로 눌린다', async () => {
    const { container } = await renderMap();
    await waitFor(() => expect(viewBoxOf(container)[2]).toBeLessThan(1000));
    const before = viewBoxOf(container);
    const zoomIn = screen.getByRole('button', { name: /지도 확대|Zoom in/ });
    act(() => {
      zoomIn.dispatchEvent(pointer('pointerdown', { x: 10, y: 10 }));
    });
    fireEvent.click(zoomIn);
    expect(viewBoxOf(container)[2]).toBeLessThan(before[2]);
  });

  it('PC: 두 번 클릭하면 그 자리를 확대한다', async () => {
    const { container, box } = await renderMap();
    await waitFor(() => expect(viewBoxOf(container)[2]).toBeLessThan(1000));
    const before = viewBoxOf(container);
    fireEvent.doubleClick(box, { clientX: 150, clientY: 180 });
    expect(viewBoxOf(container)[2]).toBeLessThan(before[2]);
  });

  it('+/−/처음 모습 버튼이 동작한다', async () => {
    const { container } = await renderMap();
    await waitFor(() => expect(viewBoxOf(container)[2]).toBeLessThan(1000));
    const initial = viewBoxOf(container);
    fireEvent.click(screen.getByRole('button', { name: /지도 확대|Zoom in/ }));
    expect(viewBoxOf(container)[2]).toBeLessThan(initial[2]);
    fireEvent.click(screen.getByRole('button', { name: /처음 모습으로|Reset view/ }));
    expect(viewBoxOf(container)).toEqual(initial);
  });
});
