import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import {
  $getNodeByKey,
  DecoratorNode,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from 'lexical';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import type { ElementTransformer } from '@lexical/markdown';
import { getPostImageUrl } from '../imageProcessing';
import { imageMarkdown, isImagePath } from './markdownParse';
import styles from './RichTextEditor.module.css';

type SerializedImageNode = Spread<{ path: string }, SerializedLexicalNode>;

function EditorImage({ nodeKey, path }: { nodeKey: NodeKey; path: string }) {
  const { t } = useTranslation('community');
  const [editor] = useLexicalComposerContext();
  return (
    <span className={styles.image}>
      <img src={getPostImageUrl(path)} alt="" className={styles.imageImg} draggable={false} />
      <button
        type="button"
        className={styles.imageRemove}
        aria-label={t('compose.editor.imageRemove')}
        title={t('compose.editor.imageRemove')}
        // 글 칸의 커서가 풀리지 않게 포커스를 옮기지 않는다
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.update(() => $getNodeByKey(nodeKey)?.remove())}
      >
        <X size={14} aria-hidden="true" />
      </button>
    </span>
  );
}

/**
 * 글 중간 사진 — 글 한 줄을 통째로 차지하는 블록. 저장은 `![](저장경로)` 한 줄이다(markdownParse.ts의 규칙과 같다).
 * 사진 파일은 글쓰기 사진 목록(post_images)에도 들어 있어서, 글을 지우거나 보관할 때 따로 챙길 것이 없다.
 */
export class ImageNode extends DecoratorNode<JSX.Element> {
  __path: string;

  static getType(): string {
    return 'triptic-image';
  }

  static clone(node: ImageNode): ImageNode {
    return new ImageNode(node.__path, node.__key);
  }

  static importJSON(serialized: SerializedImageNode): ImageNode {
    return $createImageNode(serialized.path);
  }

  constructor(path: string, key?: NodeKey) {
    super(key);
    this.__path = path;
  }

  exportJSON(): SerializedImageNode {
    return { ...super.exportJSON(), type: 'triptic-image', version: 1, path: this.__path };
  }

  getPath(): string {
    return this.getLatest().__path;
  }

  createDOM(): HTMLElement {
    const div = document.createElement('div');
    div.className = styles.imageBlock;
    return div;
  }

  updateDOM(): false {
    return false;
  }

  getTextContent(): string {
    return '';
  }

  isInline(): false {
    return false;
  }

  decorate(): JSX.Element {
    return <EditorImage nodeKey={this.__key} path={this.__path} />;
  }
}

export function $createImageNode(path: string): ImageNode {
  return new ImageNode(path);
}

export function $isImageNode(node: LexicalNode | null | undefined): node is ImageNode {
  return node instanceof ImageNode;
}

/** `![](경로)` 한 줄 ↔ 사진 블록. 우리 저장소 경로가 아니면 사진으로 바꾸지 않는다(그냥 글자로 남는다) */
export const IMAGE: ElementTransformer = {
  dependencies: [ImageNode],
  export: (node) => ($isImageNode(node) ? imageMarkdown(node.getPath()) : null),
  regExp: /^!\[\]\(([^)\s]+)\)\s*$/,
  replace: (parentNode, _children, match) => {
    if (!isImagePath(match[1])) return false;
    parentNode.replace($createImageNode(match[1]));
    return true;
  },
  type: 'element',
};
