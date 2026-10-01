import { describe, expect, it } from 'vitest';
import { isSafeUrl, parseBlocks, parseInline, stripMarkdown } from './markdownParse';

describe('parseInline', () => {
  it('굵게·기울임·링크, 섞어 쓴 것도', () => {
    expect(parseInline('a **b** *c* [d](https://x.com)')).toEqual([
      { type: 'text', text: 'a ' },
      { type: 'bold', children: [{ type: 'text', text: 'b' }] },
      { type: 'text', text: ' ' },
      { type: 'italic', children: [{ type: 'text', text: 'c' }] },
      { type: 'text', text: ' ' },
      { type: 'link', href: 'https://x.com', children: [{ type: 'text', text: 'd' }] },
    ]);
  });

  it('http(s)가 아닌 주소는 링크가 되지 않고 글자로 남는다', () => {
    const nodes = parseInline('[눌러](javascript:alert(1))');
    expect(nodes.every((n) => n.type === 'text')).toBe(true);
    expect(nodes.map((n) => (n.type === 'text' ? n.text : '')).join('')).toBe('[눌러](javascript:alert(1))');
    expect(isSafeUrl('https://example.com/a?b=1')).toBe(true);
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeUrl('data:text/html,hi')).toBe(false);
  });

  it('HTML은 해석하지 않는다(그대로 글자)', () => {
    expect(parseInline('<script>alert(1)</script>')).toEqual([{ type: 'text', text: '<script>alert(1)</script>' }]);
  });

  it('짝이 안 맞는 별표는 그대로 둔다', () => {
    expect(parseInline('2 * 3 = 6')).toEqual([{ type: 'text', text: '2 * 3 = 6' }]);
  });
});

describe('parseBlocks', () => {
  it('제목·목록·문단, 빈 줄은 문단을 끊고 단일 줄바꿈은 같은 문단 안 줄바꿈', () => {
    const blocks = parseBlocks('# 제목\n\n첫 줄\n둘째 줄\n\n- 가\n- 나\n\n1. 하나\n2. 둘');
    expect(blocks.map((b) => b.type)).toEqual(['heading', 'paragraph', 'list', 'list']);
    expect(blocks[1]).toMatchObject({ type: 'paragraph', lines: [[{ text: '첫 줄' }], [{ text: '둘째 줄' }]] });
    expect(blocks[2]).toMatchObject({ type: 'list', ordered: false });
    expect((blocks[2] as { items: unknown[] }).items).toHaveLength(2);
    expect(blocks[3]).toMatchObject({ type: 'list', ordered: true });
  });

  it('예전 평문 글(서식 없음)은 줄바꿈이 그대로 산다', () => {
    const blocks = parseBlocks('오늘은 맑았다\n그래서 걸었다');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: 'paragraph', lines: [[{ text: '오늘은 맑았다' }], [{ text: '그래서 걸었다' }]] });
  });

  it('제목 수준은 3까지', () => {
    expect(parseBlocks('###### 아주 작은')[0]).toMatchObject({ type: 'heading', level: 3 });
  });
});

describe('stripMarkdown', () => {
  it('서식 기호를 뺀 글자만(줄은 그대로, 문단 사이 빈 줄은 접는다)', () => {
    expect(stripMarkdown('# 첫 제목\n\n**굵게** 와 *기울임* [링크](https://a.com)\n\n- 하나\n- 둘')).toBe('첫 제목\n굵게 와 기울임 링크\n하나\n둘');
  });

  it('평문은 그대로', () => {
    expect(stripMarkdown('그냥 글\n두 번째 줄')).toBe('그냥 글\n두 번째 줄');
  });
});
