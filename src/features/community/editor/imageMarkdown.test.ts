import { describe, expect, it } from 'vitest';
import { createEditor, $getRoot } from 'lexical';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListItemNode, ListNode } from '@lexical/list';
import { LinkNode } from '@lexical/link';
import { $convertFromMarkdownString, $convertToMarkdownString, HEADING, QUOTE, UNORDERED_LIST, ORDERED_LIST, BOLD_ITALIC_STAR, BOLD_STAR, ITALIC_STAR, LINK } from '@lexical/markdown';
import { IMAGE, ImageNode, $isImageNode } from './ImageNode';
import { bodyTextLength, dropUnknownImages, imagePathsOf, parseBlocks, stripMarkdown, withoutImages } from './markdownParse';

const A = '11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222.webp';
const B = '11111111-1111-1111-1111-111111111111/33333333-3333-3333-3333-333333333333.jpg';
const TRANSFORMERS = [IMAGE, HEADING, QUOTE, UNORDERED_LIST, ORDERED_LIST, BOLD_ITALIC_STAR, BOLD_STAR, ITALIC_STAR, LINK];

describe('글 중간 사진 마크다운', () => {
  const md = `첫 문단\n\n![](${A})\n\n둘째 문단\n\n![](${B})`;

  it('사진 줄은 image 블록으로 읽고, 우리 저장소 경로가 아니면 글자로 남긴다', () => {
    expect(parseBlocks(md).map((b) => b.type)).toEqual(['paragraph', 'image', 'paragraph', 'image']);
    expect(parseBlocks('![](https://evil.example/x.png)')[0].type).toBe('paragraph');
  });

  it('글자 수는 사진 줄을 빼고 센다', () => {
    expect(bodyTextLength(md)).toBe('첫 문단\n\n둘째 문단\n\n'.length);
    expect(withoutImages(md)).not.toContain('![]');
  });

  it('경로 목록·평문·목록에 없는 사진 정리', () => {
    expect(imagePathsOf(md)).toEqual([A, B]);
    expect(stripMarkdown(md)).toBe('첫 문단\n둘째 문단');
    expect(dropUnknownImages(md, [A]).trim()).toBe(`첫 문단\n\n![](${A})\n\n둘째 문단`);
  });

  it('편집기(Lexical)와 마크다운이 왕복한다', () => {
    const editor = createEditor({ nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode, ImageNode], onError: (e) => { throw e; } });
    let out = '';
    let kinds: boolean[] = [];
    editor.update(
      () => {
        $convertFromMarkdownString(md, TRANSFORMERS);
        kinds = $getRoot().getChildren().map((n) => $isImageNode(n));
        out = $convertToMarkdownString(TRANSFORMERS);
      },
      { discrete: true },
    );
    expect(kinds).toEqual([false, true, false, true]);
    expect(out).toBe(md);
  });
});
