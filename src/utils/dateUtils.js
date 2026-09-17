/**
 * 날짜 관련 유틸리티 함수
 */

/**
 * 날짜 문자열을 YYYY-MM-DD 형식으로 포맷
 * @param {Date|string} date - 포맷할 날짜
 * @returns {string} YYYY-MM-DD 형식 문자열
 */
export function formatDate(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * 두 날짜 사이의 일수 계산
 * @param {string} startDate - 시작일 (YYYY-MM-DD)
 * @param {string} endDate - 종료일 (YYYY-MM-DD)
 * @returns {number} 일수
 */
export function calculateDaysBetween(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * 요일 배열
 */
export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * 날짜에서 요일 가져오기
 * @param {Date|string} date - 날짜
 * @returns {string} 요일 (예: '월')
 */
export function getWeekday(date) {
    const d = new Date(date);
    return WEEKDAYS[d.getDay()];
}
