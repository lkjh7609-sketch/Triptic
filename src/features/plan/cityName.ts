/**
 * 저장된 도시 문자열에서 "도시 이름만" 뽑는다(화면 표시·검색어용, 저장값은 그대로).
 * 여행을 만들 때는 도시를 Google formatted_address로 저장해서 언어에 따라
 *   - 영어: "Sydney NSW, Australia", "New York, NY, USA"  → 첫 조각 + 끝의 주 약어 제거
 *   - 한국어: "오스트레일리아 뉴사우스웨일스 주 시드니"(나라→주→도시, 쉼표 없음) → 마지막 단어
 *   - 일본어: "日本、東京都" → 마지막 조각
 * 처럼 길게 들어온다. 날짜별 도시(DayCityModal)는 이미 짧은 이름이라 그대로 나온다.
 */
export function cityDisplayName(city: string | null | undefined): string {
  const value = (city ?? '').trim();
  if (!value) return '';
  if (value.includes(',')) {
    return value.split(',')[0].trim().replace(/\s+[A-Z]{2,3}$/, '');
  }
  if (value.includes('、')) {
    const parts = value.split('、').map((s) => s.trim()).filter(Boolean);
    return parts[parts.length - 1] ?? value;
  }
  // 한글 음절(가~힣)이 섞여 있으면 한국어 주소 — 화면 문구가 아니라 판별용 범위라 이스케이프로 쓴다
  if (/[\uAC00-\uD7A3]/.test(value) && value.includes(' ')) {
    const words = value.split(/\s+/);
    return words[words.length - 1];
  }
  return value;
}
