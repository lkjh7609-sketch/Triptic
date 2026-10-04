import { afterEach, describe, expect, it } from 'vitest';
import { installContentGuards } from './contentGuards';

let uninstall: (() => void) | null = null;
afterEach(() => {
  uninstall?.();
  uninstall = null;
  document.body.innerHTML = '';
});

function fire(el: Element, type: 'dragstart' | 'contextmenu') {
  const event = new Event(type, { bubbles: true, cancelable: true });
  el.dispatchEvent(event);
  return event.defaultPrevented;
}

describe('contentGuards', () => {
  it('링크·그림·버튼은 끌 수 없고, 글자(문단)는 막지 않는다', () => {
    uninstall = installContentGuards();
    document.body.innerHTML = '<a href="/x"><span id="t">링크</span></a><img id="i" src="a.png"><button id="b">버튼</button><p id="p">글자</p>';
    expect(fire(document.getElementById('t')!, 'dragstart')).toBe(true);
    expect(fire(document.getElementById('i')!, 'dragstart')).toBe(true);
    expect(fire(document.getElementById('b')!, 'dragstart')).toBe(true);
    expect(fire(document.getElementById('p')!, 'dragstart')).toBe(false);
  });

  it('draggable="true"로 일부러 표시한 요소는 끌 수 있다', () => {
    uninstall = installContentGuards();
    document.body.innerHTML = '<div draggable="true"><img id="i" src="a.png"></div>';
    expect(fire(document.getElementById('i')!, 'dragstart')).toBe(false);
  });

  it('우클릭 메뉴는 그림에서만 막고, 글자·입력칸에서는 그대로 둔다', () => {
    uninstall = installContentGuards();
    document.body.innerHTML = '<img id="i" src="a.png"><p id="p">글자</p><textarea id="x"></textarea>';
    expect(fire(document.getElementById('i')!, 'contextmenu')).toBe(true);
    expect(fire(document.getElementById('p')!, 'contextmenu')).toBe(false);
    expect(fire(document.getElementById('x')!, 'contextmenu')).toBe(false);
  });

  it('해제하면 다시 허용한다', () => {
    installContentGuards()();
    document.body.innerHTML = '<img id="i" src="a.png">';
    expect(fire(document.getElementById('i')!, 'contextmenu')).toBe(false);
  });
});
