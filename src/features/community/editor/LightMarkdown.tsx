import type { ReactNode } from 'react';
import { parseBlocks, type InlineNode } from './markdownParse';
import styles from './LightMarkdown.module.css';

function renderInline(nodes: InlineNode[]): ReactNode[] {
  return nodes.map((node, i) => {
    switch (node.type) {
      case 'text':
        return node.text;
      case 'bold':
        return <strong key={i}>{renderInline(node.children)}</strong>;
      case 'italic':
        return <em key={i}>{renderInline(node.children)}</em>;
      case 'link':
        // 사용자가 쓴 주소라 추적·검색 순위 전달을 막고(ugc·nofollow) 새 탭에서 연다
        return (
          <a key={i} href={node.href} target="_blank" rel="nofollow ugc noopener noreferrer">
            {renderInline(node.children)}
          </a>
        );
    }
  });
}

function renderLines(lines: InlineNode[][]): ReactNode[] {
  return lines.flatMap((line, i) => (i === 0 ? renderInline(line) : [<br key={`br${i}`} />, ...renderInline(line)]));
}

/** 가벼운 마크다운(markdownParse.ts)을 화면에 그린다. HTML은 만들지 않고 React 요소로만 그린다 */
export function LightMarkdown({ text, className }: { text: string; className?: string }) {
  return (
    <div className={`${styles.root} ${className ?? ''}`}>
      {parseBlocks(text).map((block, i) => {
        switch (block.type) {
          case 'heading': {
            const Tag = (block.level === 1 ? 'h3' : block.level === 2 ? 'h4' : 'h5') as 'h3' | 'h4' | 'h5';
            return (
              <Tag key={i} className={styles.heading}>
                {renderInline(block.children)}
              </Tag>
            );
          }
          case 'quote':
            return (
              <blockquote key={i} className={styles.quote}>
                {renderLines(block.lines)}
              </blockquote>
            );
          case 'list': {
            const Tag = block.ordered ? 'ol' : 'ul';
            return (
              <Tag key={i} className={styles.list}>
                {block.items.map((item, j) => (
                  <li key={j}>{renderInline(item)}</li>
                ))}
              </Tag>
            );
          }
          default:
            return (
              <p key={i} className={styles.paragraph}>
                {renderLines(block.lines)}
              </p>
            );
        }
      })}
    </div>
  );
}
