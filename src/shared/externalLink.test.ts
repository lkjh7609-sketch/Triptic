import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const open = vi.fn(async () => {});
vi.mock('@capacitor/browser', () => ({ Browser: { open } }));

let native = true;
vi.mock('./platform', () => ({ isNativeApp: () => native }));

import { installExternalLinkHandler, isOutboundHttp, openExternalUrl } from './externalLink';

function clickLink(attrs: Record<string, string>): MouseEvent {
  const a = document.createElement('a');
  for (const [k, v] of Object.entries(attrs)) a.setAttribute(k, v);
  document.body.appendChild(a);
  const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
  a.dispatchEvent(ev);
  a.remove();
  return ev;
}

describe('외부 링크 — 앱에서는 인앱 브라우저', () => {
  let uninstall: () => void;
  beforeEach(() => {
    open.mockClear();
    native = true;
    uninstall = installExternalLinkHandler();
  });
  afterEach(() => uninstall());

  it('앱에서 target=_blank 바깥 주소는 인앱 브라우저로 열고 기본 동작은 막는다', async () => {
    const ev = clickLink({ href: 'https://example.com/book?x=1', target: '_blank' });
    expect(ev.defaultPrevented).toBe(true);
    await vi.waitFor(() => expect(open).toHaveBeenCalledWith({ url: 'https://example.com/book?x=1' }));
  });

  it('우리 사이트 주소·새 탭이 아닌 링크는 건드리지 않는다', () => {
    expect(clickLink({ href: '/plan/1', target: '_blank' }).defaultPrevented).toBe(false);
    expect(clickLink({ href: 'https://example.com', }).defaultPrevented).toBe(false);
    expect(open).not.toHaveBeenCalled();
  });

  it('웹(앱 아님)에서는 아무것도 하지 않는다', () => {
    native = false;
    expect(clickLink({ href: 'https://example.com', target: '_blank' }).defaultPrevented).toBe(false);
    expect(open).not.toHaveBeenCalled();
  });

  it('openExternalUrl: 앱이면 인앱 브라우저, 웹이면 새 창', async () => {
    await openExternalUrl('https://example.com/a');
    expect(open).toHaveBeenCalledWith({ url: 'https://example.com/a' });
    native = false;
    const w = vi.spyOn(window, 'open').mockReturnValue(null);
    await openExternalUrl('https://example.com/b');
    expect(w).toHaveBeenCalledWith('https://example.com/b', '_blank', 'noopener');
    w.mockRestore();
  });

  it('isOutboundHttp', () => {
    expect(isOutboundHttp('https://other.com/x', 'https://triptic.my')).toBe(true);
    expect(isOutboundHttp('https://triptic.my/x', 'https://triptic.my')).toBe(false);
    expect(isOutboundHttp('mailto:a@b.c', 'https://triptic.my')).toBe(false);
  });
});
