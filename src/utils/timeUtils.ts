/**
 * 시간 관련 유틸리티 함수
 */

/**
 * 시간 선택 옵션 생성 (00시 ~ 23시)
 * @param selectedHour - 선택된 시간 (2자리 문자열)
 * @returns HTML option 문자열
 */
export function generateHourOptions(selectedHour: string): string {
    let html = '';
    for (let h = 0; h < 24; h++) {
        const hh = String(h).padStart(2, '0');
        html += `<option value="${hh}" ${hh === selectedHour ? 'selected' : ''}>${hh}시</option>`;
    }
    return html;
}

/**
 * 분 선택 옵션 생성 (00분 ~ 55분, 5분 단위)
 * @param selectedMinute - 선택된 분 (2자리 문자열)
 * @returns HTML option 문자열
 */
export function generateMinuteOptions(selectedMinute: string): string {
    let html = '';
    for (let m = 0; m < 60; m += 5) {
        const mm = String(m).padStart(2, '0');
        html += `<option value="${mm}" ${mm === selectedMinute ? 'selected' : ''}>${mm}분</option>`;
    }
    return html;
}

/**
 * 시간 문자열이 유효한 HH:MM 형식인지 검사
 * @param time - 검사할 시간 문자열
 * @returns 유효 여부
 */
export function isValidTimeFormat(time: string): boolean {
    return /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);
}

/**
 * 시간에 분 추가
 * @param time - 기준 시간 (HH:MM)
 * @param minutes - 추가할 분 (음수 가능)
 * @returns 새로운 시간 (HH:MM)
 * @throws {Error} 잘못된 시간 형식
 */
export function addMinutes(time: string, minutes: number): string {
    if (!isValidTimeFormat(time)) {
        throw new Error(`Invalid time format: ${time}`);
    }

    const [hh, mm] = time.split(':').map(Number);
    const totalMinutes = hh * 60 + mm + minutes;

    // 24시간 순환 처리
    const normalizedMinutes = ((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60);
    const newHour = Math.floor(normalizedMinutes / 60);
    const newMinute = normalizedMinutes % 60;

    return `${String(newHour).padStart(2, '0')}:${String(newMinute).padStart(2, '0')}`;
}

/**
 * 두 시간 사이의 분 차이 계산
 * @param startTime - 시작 시간 (HH:MM)
 * @param endTime - 종료 시간 (HH:MM)
 * @returns 분 차이
 */
export function getMinutesDifference(startTime: string, endTime: string): number {
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);

    const startTotal = startHour * 60 + startMin;
    const endTotal = endHour * 60 + endMin;

    return endTotal - startTotal;
}
