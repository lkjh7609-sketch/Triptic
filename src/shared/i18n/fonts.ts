/**
 * 로케일별 동적 웹폰트 로드 (07-i18n.md §4.1)
 * Pretendard(ko/en)는 index.html에서 이미 CDN <link>로 로드돼 있다. zh-TW(번체)와
 * ja는 한자·가나 글리프가 필요한데, 서브셋이라도 수백 KB라 초기 번들/모든 사용자에게
 * 강제하지 않고 해당 언어로 전환하는 순간에만 <link>를 삽입한다.
 */
const FONT_LINK_ID = 'triptic-locale-font';

const FONT_HREF_BY_LOCALE: Partial<Record<string, string>> = {
  'zh-TW': 'https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&display=swap',
  ja: 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap',
};

let loadedHref: string | null = null;

export function loadLocaleFont(locale: string): void {
  const href = FONT_HREF_BY_LOCALE[locale];
  if (!href || href === loadedHref) return;

  const existing = document.getElementById(FONT_LINK_ID);
  existing?.remove();

  const link = document.createElement('link');
  link.id = FONT_LINK_ID;
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
  loadedHref = href;
}
