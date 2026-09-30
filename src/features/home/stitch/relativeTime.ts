/** "10분 전"·"2일 전" — 언어에 맞는 상대 시간. 한 달이 넘으면 날짜로 넘어가지 않고 "n개월 전"까지만 센다 */
export function relativeTime(iso: string, locale: string, now = Date.now()): string {
  const diffSec = Math.round((new Date(iso).getTime() - now) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 60) return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(0, 'second'); // "지금"
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'always' }); // "어제"·"그저께" 대신 "1일 전"·"2일 전"처럼
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour');
  if (abs < 86400 * 7) return rtf.format(Math.round(diffSec / 86400), 'day');
  if (abs < 86400 * 30) return rtf.format(Math.round(diffSec / (86400 * 7)), 'week');
  if (abs < 86400 * 365) return rtf.format(Math.round(diffSec / (86400 * 30)), 'month');
  return rtf.format(Math.round(diffSec / (86400 * 365)), 'year');
}
