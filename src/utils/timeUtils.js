/**
 * 시간 관련 유틸리티 함수
 */

/**
 * 시간 선택 옵션 생성 (00시 ~ 23시)
 * @param {string} selectedHour - 선택된 시간 (2자리)
 * @returns {string} HTML option 문자열
 */
export function generateHourOptions(selectedHour) {
    let html = '';
    for (let h = 0; h < 24; h++) {
        const hh = String(h).padStart(2, '0');
        html += `<option value="${hh}" ${hh === selectedHour ? 'selected' : ''}>${hh}시</option>`;
    }
    return html;
}

/**
 * 분 선택 옵션 생성 (00분 ~ 55분, 5분 단위)
 * @param {string} selectedMinute - 선택된 분 (2자리)
 * @returns {string} HTML option 문자열
 */
export function generateMinuteOptions(selectedMinute) {
    let html = '';
    for (let m = 0; m < 60; m += 5) {
        const mm = String(m).padStart(2, '0');
        html += `<option value="${mm}" ${mm === selectedMinute ? 'selected' : ''}>${mm}분</option>`;
    }
    return html;
}

/**
 * 시간 문자열이 유효한지 검사
 * @param {string} time - 시간 문자열 (HH:MM)
 * @returns {boolean} 유효 여부
 */
export function isValidTimeFormat(time) {
    return /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);
}

/**
 * 시간에 분 추가
 * @param {string} time - 기준 시간 (HH:MM)
 * @param {number} minutes - 추가할 분
 * @returns {string} 새로운 시간 (HH:MM)
 */
export function addMinutes(time, minutes) {
    const [hh, mm] = time.split(':').map(Number);
    const totalMinutes = hh * 60 + mm + minutes;
    const newHour = Math.floor(totalMinutes / 60) % 24;
    const newMinute = totalMinutes % 60;
    return `${String(newHour).padStart(2, '0')}:${String(newMinute).padStart(2, '0')}`;
}
