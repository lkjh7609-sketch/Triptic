import { isNativeApp } from './platform';

/**
 * 호텔·항공·액티비티 같은 바깥 사이트로 나가는 링크 — 앱(iOS 셸)에서는 앱 안에서 뜨는 인앱 브라우저(SFSafariViewController)로
 * 열어 사용자가 앱을 떠나지 않게 한다. 웹에서는 평소처럼 새 탭.
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (isNativeApp()) {
    try {
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ url });
      return;
    } catch {
      // 플러그인이 없는 셸이면 아래 새 창으로
    }
  }
  window.open(url, '_blank', 'noopener');
}

/** 우리 사이트가 아닌 http(s) 주소인지 */
export function isOutboundHttp(href: string, origin = window.location.origin): boolean {
  try {
    const u = new URL(href, origin);
    return (u.protocol === 'http:' || u.protocol === 'https:') && u.origin !== origin;
  } catch {
    return false;
  }
}

/**
 * 문서 전체의 링크 클릭을 받아, 앱 안에서는 새 탭(target=_blank)으로 나가는 바깥 주소를 인앱 브라우저로 돌린다.
 * 링크마다 고치지 않아도 제휴 링크(<a href target=_blank>)와 openExternal이 만드는 임시 링크가 모두 잡힌다.
 * 웹(앱 아님)에서는 아무것도 하지 않는다.
 */
export function installExternalLinkHandler(): () => void {
  const onClick = (e: MouseEvent) => {
    if (e.defaultPrevented || !isNativeApp()) return;
    const anchor = (e.target as Element | null)?.closest?.('a');
    if (!anchor || anchor.target !== '_blank') return;
    const href = anchor.href;
    if (!href || !isOutboundHttp(href)) return;
    e.preventDefault();
    void openExternalUrl(href);
  };
  document.addEventListener('click', onClick);
  return () => document.removeEventListener('click', onClick);
}
