/**
 * 도시 대표 사진(destinations.cover_url)의 작은 판 주소 — 여행지 선택 창처럼 40px 칸에 100곳이 한꺼번에 나오는 곳은
 * 1024x768 원본(약 100KB) 대신 160x120 썸네일(약 4KB)을 쓴다.
 *  · 우리 저장소(destination-covers/슬러그.webp)는 같은 버킷의 thumbs/슬러그.webp
 *  · Unsplash 주소는 w=800을 w=160으로
 *  · 그 밖의 주소는 그대로
 */
const OWN = '/destination-covers/';

export function coverThumbUrl(coverUrl: string): string {
  const i = coverUrl.indexOf(OWN);
  if (i !== -1 && !coverUrl.includes(`${OWN}thumbs/`)) {
    return `${coverUrl.slice(0, i + OWN.length)}thumbs/${coverUrl.slice(i + OWN.length)}`;
  }
  if (coverUrl.startsWith('https://images.unsplash.com/')) return coverUrl.replace(/([?&])w=\d+/, '$1w=160');
  return coverUrl;
}
