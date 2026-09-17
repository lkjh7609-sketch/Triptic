/**
 * XSS 방어를 위한 HTML 이스케이프 함수
 */

/**
 * HTML 특수 문자를 이스케이프하여 XSS 공격 방지
 * @param str - 이스케이프할 문자열
 * @returns 이스케이프된 문자열
 */
export function escapeHtml(str: string | null | undefined): string {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * 안전한 HTML 렌더링을 위한 템플릿 태그 함수
 * @param strings - 템플릿 문자열 배열
 * @param values - 삽입할 값들
 * @returns 이스케이프된 HTML 문자열
 * @example
 * const name = '<script>alert("XSS")</script>';
 * const html = safeHtml`<div>${name}</div>`;
 * // <div>&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;</div>
 */
export function safeHtml(strings: TemplateStringsArray, ...values: any[]): string {
    return strings.reduce((acc, str, i) => {
        const value = values[i];
        const escaped = value !== undefined ? escapeHtml(String(value)) : '';
        return acc + str + escaped;
    }, '');
}
