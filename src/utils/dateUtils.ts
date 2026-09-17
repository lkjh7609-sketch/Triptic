/**
 * 날짜 관련 유틸리티 함수
 */

/**
 * 날짜를 YYYY-MM-DD 형식으로 포맷
 * @param date - 포맷할 날짜
 * @returns YYYY-MM-DD 형식 문자열
 */
export function formatDate(date: Date | string): string {
    const d = new Date(date);

    if (isNaN(d.getTime())) {
        throw new Error(`Invalid date: ${date}`);
    }

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

/**
 * 두 날짜 사이의 일수 계산 (양 끝 포함)
 * @param startDate - 시작일 (YYYY-MM-DD)
 * @param endDate - 종료일 (YYYY-MM-DD)
 * @returns 일수
 */
export function calculateDaysBetween(startDate: string, endDate: string): number {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new Error(`Invalid date range: ${startDate} - ${endDate}`);
    }

    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * 요일 배열 (일~토)
 */
export const WEEKDAYS: readonly string[] = ['일', '월', '화', '수', '목', '금', '토'] as const;

/**
 * 날짜의 요일 가져오기
 * @param date - 날짜
 * @returns 요일 (예: '월')
 */
export function getWeekday(date: Date | string): string {
    const d = new Date(date);

    if (isNaN(d.getTime())) {
        throw new Error(`Invalid date: ${date}`);
    }

    return WEEKDAYS[d.getDay()];
}

/**
 * 날짜가 유효한 YYYY-MM-DD 형식인지 검사
 * @param dateString - 검사할 날짜 문자열
 * @returns 유효 여부
 */
export function isValidDateFormat(dateString: string): boolean {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString)) return false;

    const date = new Date(dateString);
    return !isNaN(date.getTime());
}

/**
 * 오늘 날짜를 YYYY-MM-DD 형식으로 반환
 * @returns 오늘 날짜
 */
export function getToday(): string {
    return formatDate(new Date());
}

/**
 * 특정 날짜에 일수 더하기
 * @param date - 기준 날짜
 * @param days - 더할 일수 (음수 가능)
 * @returns 새로운 날짜
 */
export function addDays(date: Date | string, days: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}
