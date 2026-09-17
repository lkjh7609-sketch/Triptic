/**
 * @jest-environment jsdom
 */

import { escapeHtml, safeHtml } from '../utils/escapeHtml.js';

describe('escapeHtml', () => {
    test('XSS 공격 패턴을 차단해야 함', () => {
        const input = '<script>alert("XSS")</script>';
        const output = escapeHtml(input);
        expect(output).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
        expect(output).not.toContain('<script>');
    });

    test('일반 텍스트는 그대로 유지해야 함', () => {
        const input = '오사카 도톤보리';
        const output = escapeHtml(input);
        expect(output).toBe('오사카 도톤보리');
    });

    test('HTML 엔티티를 모두 이스케이프해야 함', () => {
        const input = '< > & " \'';
        const output = escapeHtml(input);
        expect(output).toBe('&lt; &gt; &amp; &quot; &#039;');
    });

    test('null 또는 undefined는 빈 문자열을 반환해야 함', () => {
        expect(escapeHtml(null)).toBe('');
        expect(escapeHtml(undefined)).toBe('');
    });

    test('숫자는 문자열로 변환되어야 함', () => {
        expect(escapeHtml(123)).toBe('123');
        expect(escapeHtml(0)).toBe('0');
    });
});

describe('safeHtml', () => {
    test('템플릿 리터럴의 변수를 자동으로 이스케이프해야 함', () => {
        const name = '<img src=x onerror=alert(1)>';
        const result = safeHtml`<div>${name}</div>`;
        expect(result).toContain('&lt;img');
        expect(result).not.toContain('<img');
    });

    test('여러 변수를 모두 이스케이프해야 함', () => {
        const title = '<script>';
        const content = '"></script>';
        const result = safeHtml`<h1>${title}</h1><p>${content}</p>`;
        expect(result).toBe('<h1>&lt;script&gt;</h1><p>&quot;&gt;&lt;/script&gt;</p>');
    });
});
