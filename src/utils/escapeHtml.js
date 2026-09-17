/**
 * XSS 방어를 위한 HTML 이스케이프 함수
 * @param {string} str - 이스케이프할 문자열
 * @returns {string} 이스케이프된 문자열
 */
export function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * 안전한 HTML 렌더링 (템플릿 태그 함수)
 * @param {TemplateStringsArray} strings - 템플릿 문자열
 * @param {...any} values - 삽입할 값들
 * @returns {string} 이스케이프된 HTML 문자열
 */
export function safeHtml(strings, ...values) {
    return strings.reduce((acc, str, i) => {
        const value = values[i];
        const escaped = value !== undefined ? escapeHtml(String(value)) : '';
        return acc + str + escaped;
    }, '');
}
