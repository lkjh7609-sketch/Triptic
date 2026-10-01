/**
 * 글 본문에 쓰는 "가벼운 마크다운" — 굵게(**), 기울임(*), 제목(#), 목록(- / 1.), 링크([글](주소)), 인용(>)만.
 * 편집기(RichTextEditor)가 이 모양으로 저장하고, 화면은 LightMarkdown이 같은 규칙으로 그린다.
 * 예전에 평문으로 쓴 글도 그대로 읽히게, 줄바꿈은 그대로 살리고 규칙에 안 맞는 줄은 일반 문단이다.
 * HTML은 해석하지 않는다(그대로 글자로 보인다) — 화면에 그릴 때 dangerouslySetInnerHTML을 쓰지 않으므로 스크립트가 들어갈 길이 없다.
 */

export type InlineNode =
  | { type: 'text'; text: string }
  | { type: 'bold'; children: InlineNode[] }
  | { type: 'italic'; children: InlineNode[] }
  | { type: 'link'; href: string; children: InlineNode[] };

export type Block =
  | { type: 'paragraph'; lines: InlineNode[][] }
  | { type: 'heading'; level: 1 | 2 | 3; children: InlineNode[] }
  | { type: 'quote'; lines: InlineNode[][] }
  | { type: 'list'; ordered: boolean; items: InlineNode[][] };

/** 링크는 http(s)만 — javascript: 같은 주소는 링크가 되지 않고 글자로 남는다 */
export function isSafeUrl(url: string): boolean {
  return /^https?:\/\/[^\s]+$/i.test(url);
}

// 가장 먼저 나오는 서식 하나를 찾는다: [글](주소) · **굵게** · *기울임*
const INLINE = /\[([^\]\n]+)\]\(([^)\s]+)\)|\*\*([^*\n]+?)\*\*|\*([^*\s][^*\n]*?)\*/;

export function parseInline(text: string): InlineNode[] {
  const out: InlineNode[] = [];
  let rest = text;
  while (rest) {
    const m = INLINE.exec(rest);
    if (!m) {
      out.push({ type: 'text', text: rest });
      break;
    }
    if (m.index > 0) out.push({ type: 'text', text: rest.slice(0, m.index) });
    if (m[1] !== undefined) {
      out.push(isSafeUrl(m[2]) ? { type: 'link', href: m[2], children: parseInline(m[1]) } : { type: 'text', text: m[0] });
    } else if (m[3] !== undefined) {
      out.push({ type: 'bold', children: parseInline(m[3]) });
    } else {
      out.push({ type: 'italic', children: parseInline(m[4]) });
    }
    rest = rest.slice(m.index + m[0].length);
  }
  return out;
}

export function parseBlocks(source: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of source.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trimEnd();
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    const quote = /^>\s?(.*)$/.exec(line);
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line);
    const last = blocks[blocks.length - 1];
    if (heading) {
      blocks.push({ type: 'heading', level: Math.min(heading[1].length, 3) as 1 | 2 | 3, children: parseInline(heading[2]) });
    } else if (bullet || numbered) {
      const ordered = !bullet;
      const item = parseInline((bullet ?? numbered)![1]);
      if (last?.type === 'list' && last.ordered === ordered) last.items.push(item);
      else blocks.push({ type: 'list', ordered, items: [item] });
    } else if (quote) {
      const inline = parseInline(quote[1]);
      if (last?.type === 'quote') last.lines.push(inline);
      else blocks.push({ type: 'quote', lines: [inline] });
    } else if (line.trim() === '') {
      // 빈 줄은 문단을 끊는다(편집기가 문단 사이에 넣는 빈 줄 포함)
      if (last?.type === 'paragraph') blocks.push({ type: 'paragraph', lines: [] });
    } else if (last?.type === 'paragraph') {
      last.lines.push(parseInline(line));
    } else {
      blocks.push({ type: 'paragraph', lines: [parseInline(line)] });
    }
  }
  return blocks.filter((b) => b.type !== 'paragraph' || b.lines.length > 0);
}

function inlineText(nodes: InlineNode[]): string {
  return nodes.map((n) => (n.type === 'text' ? n.text : inlineText(n.children))).join('');
}

/**
 * 서식 기호를 뺀 글자만 — 피드 카드·미리보기·첫 줄을 제목으로 쓰는 곳처럼 글을 평문으로 보여 주는 자리에 쓴다.
 * 줄은 그대로 두고(첫 줄 = 제목 규칙이 그대로 동작), 빈 줄은 편집기가 문단 사이에 넣은 것이라 한 줄로 합친다.
 */
export function stripMarkdown(source: string): string {
  const lines: string[] = [];
  for (const block of parseBlocks(source)) {
    if (block.type === 'paragraph' || block.type === 'quote') {
      for (const line of block.lines) lines.push(inlineText(line));
    } else if (block.type === 'heading') {
      lines.push(inlineText(block.children));
    } else {
      for (const item of block.items) lines.push(inlineText(item));
    }
  }
  return lines.join('\n');
}
