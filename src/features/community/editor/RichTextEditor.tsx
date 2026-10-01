import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Bold, Heading2, Italic, Link2, List, ListOrdered } from 'lucide-react';
import {
  $createParagraphNode,
  $createTextNode,
  $getSelection,
  $isRangeSelection,
  $setSelection,
  COMMAND_PRIORITY_LOW,
  FORMAT_TEXT_COMMAND,
  SELECTION_CHANGE_COMMAND,
  type BaseSelection,
  type LexicalEditor,
} from 'lexical';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { $createHeadingNode, $isHeadingNode, HeadingNode, QuoteNode } from '@lexical/rich-text';
import {
  $isListNode,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListItemNode,
  ListNode,
  REMOVE_LIST_COMMAND,
} from '@lexical/list';
import { $createLinkNode, $isLinkNode, $toggleLink, LinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link';
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  BOLD_ITALIC_STAR,
  BOLD_STAR,
  HEADING,
  ITALIC_STAR,
  LINK,
  ORDERED_LIST,
  QUOTE,
  UNORDERED_LIST,
  type Transformer,
} from '@lexical/markdown';
import { $setBlocksType } from '@lexical/selection';
import { isSafeUrl } from './markdownParse';
import styles from './RichTextEditor.module.css';

/** 편집기가 읽고 쓰는 마크다운 규칙 — 굵게·기울임·제목·목록·링크(+붙여넣은 인용). 저장 모양은 markdownParse.ts와 같다 */
const TRANSFORMERS: Transformer[] = [HEADING, QUOTE, UNORDERED_LIST, ORDERED_LIST, BOLD_ITALIC_STAR, BOLD_STAR, ITALIC_STAR, LINK];

const NODES = [HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode];

interface ToolbarState {
  bold: boolean;
  italic: boolean;
  heading: boolean;
  bullet: boolean;
  numbered: boolean;
  link: boolean;
}

const NO_FORMAT: ToolbarState = { bold: false, italic: false, heading: false, bullet: false, numbered: false, link: false };

function toolbarStateOf(): ToolbarState {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return NO_FORMAT;
  const anchor = selection.anchor.getNode();
  const top = anchor.getTopLevelElementOrThrow();
  return {
    bold: selection.hasFormat('bold'),
    italic: selection.hasFormat('italic'),
    heading: $isHeadingNode(top),
    bullet: $isListNode(top) && top.getListType() === 'bullet',
    numbered: $isListNode(top) && top.getListType() === 'number',
    link: $isLinkNode(anchor) || $isLinkNode(anchor.getParent()),
  };
}

function normalizeUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const url = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return isSafeUrl(url) ? url : null;
}

function Toolbar() {
  const { t } = useTranslation('community');
  const [editor] = useLexicalComposerContext();
  const [state, setState] = useState<ToolbarState>(NO_FORMAT);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState('');
  const [linkError, setLinkError] = useState(false);
  const linkInputRef = useRef<HTMLInputElement>(null);
  // 주소 칸으로 포커스가 옮겨 가면 글 칸의 선택이 풀리므로, 링크 버튼을 누른 순간의 선택을 붙들어 둔다
  const savedSelection = useRef<BaseSelection | null>(null);

  const refresh = useCallback(() => setState(editor.getEditorState().read(toolbarStateOf)), [editor]);
  useEffect(() => {
    const offUpdate = editor.registerUpdateListener(() => refresh());
    const offSelection = editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        refresh();
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );
    return () => {
      offUpdate();
      offSelection();
    };
  }, [editor, refresh]);

  function toggleHeading() {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) $setBlocksType(selection, () => (state.heading ? $createParagraphNode() : $createHeadingNode('h2')));
    });
  }

  function toggleList(kind: 'bullet' | 'numbered') {
    const active = kind === 'bullet' ? state.bullet : state.numbered;
    editor.dispatchCommand(active ? REMOVE_LIST_COMMAND : kind === 'bullet' ? INSERT_UNORDERED_LIST_COMMAND : INSERT_ORDERED_LIST_COMMAND, undefined);
  }

  function handleLink() {
    if (state.link) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
      return;
    }
    savedSelection.current = editor.getEditorState().read(() => $getSelection()?.clone() ?? null);
    setLinkOpen(true);
    setLinkValue('');
    setLinkError(false);
    window.setTimeout(() => linkInputRef.current?.focus(), 0);
  }

  function applyLink(e: FormEvent) {
    e.preventDefault();
    const url = normalizeUrl(linkValue);
    if (!url) {
      setLinkError(true);
      return;
    }
    editor.update(() => {
      if (savedSelection.current) $setSelection(savedSelection.current);
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      if (selection.isCollapsed()) {
        // 글자를 고르지 않았으면 주소 자체를 링크 글자로 넣는다
        const node = $createLinkNode(url);
        node.append($createTextNode(url));
        selection.insertNodes([node]);
      } else {
        $toggleLink(url);
      }
    });
    setLinkOpen(false);
    editor.focus();
  }

  // 버튼을 눌러도 글 칸의 선택이 풀리지 않게 포커스를 옮기지 않는다
  const keepFocus = (e: React.MouseEvent) => e.preventDefault();
  const button = (label: string, active: boolean, onClick: () => void, icon: React.ReactNode) => (
    <button type="button" className={active ? styles.toolOn : styles.tool} aria-label={label} title={label} aria-pressed={active} onMouseDown={keepFocus} onClick={onClick}>
      {icon}
    </button>
  );

  return (
    <div className={styles.toolbarWrap}>
      <div className={styles.toolbar} role="toolbar" aria-label={t('compose.editor.toolbar')}>
        {button(t('compose.editor.bold'), state.bold, () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold'), <Bold size={18} aria-hidden="true" />)}
        {button(t('compose.editor.italic'), state.italic, () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic'), <Italic size={18} aria-hidden="true" />)}
        {button(t('compose.editor.heading'), state.heading, toggleHeading, <Heading2 size={18} aria-hidden="true" />)}
        {button(t('compose.editor.bulletList'), state.bullet, () => toggleList('bullet'), <List size={18} aria-hidden="true" />)}
        {button(t('compose.editor.numberedList'), state.numbered, () => toggleList('numbered'), <ListOrdered size={18} aria-hidden="true" />)}
        {button(state.link ? t('compose.editor.linkRemove') : t('compose.editor.link'), state.link, handleLink, <Link2 size={18} aria-hidden="true" />)}
      </div>
      {linkOpen ? (
        <form className={styles.linkRow} onSubmit={applyLink} noValidate>
          <input
            ref={linkInputRef}
            type="url"
            inputMode="url"
            className={`${styles.linkInput} ${linkError ? styles.linkInputError : ''}`}
            value={linkValue}
            placeholder={t('compose.editor.linkPlaceholder')}
            aria-label={t('compose.editor.linkPlaceholder')}
            aria-invalid={linkError}
            onChange={(e) => {
              setLinkValue(e.target.value);
              setLinkError(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                setLinkOpen(false);
                editor.focus();
              }
            }}
          />
          <button type="submit" className={styles.linkApply}>
            {t('compose.editor.linkApply')}
          </button>
        </form>
      ) : null}
    </div>
  );
}

/** 편집기가 마지막으로 바깥에 알린 마크다운 — 바깥에서 온 값과 구분하는 데 쓴다 */
interface EmittedValue {
  get: () => string;
  set: (value: string) => void;
}

/** 바깥에서 값이 바뀌면(이어 쓰기 등) 편집기 내용도 바꾼다 — 편집기 자신이 낸 값이면 건드리지 않는다 */
function SyncValuePlugin({ value, emitted }: { value: string; emitted: EmittedValue }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    if (value === emitted.get()) return;
    emitted.set(value);
    editor.update(() => {
      $convertFromMarkdownString(value, TRANSFORMERS);
    });
  }, [editor, value, emitted]);
  return null;
}

function ChangePlugin({ maxLength, onChange, emitted }: { maxLength: number; onChange: (markdown: string) => void; emitted: EmittedValue }) {
  const [editor] = useLexicalComposerContext();
  // 글자 수 제한(저장되는 마크다운 기준) — 한도에 닿으면 더 입력되지 않게 막는다. 한글 조합 중인 글자는 막을 수 없어 그대로 두고,
  // 붙여넣기로 넘친 경우는 바깥(글쓰기 화면)이 글자 수를 보고 안내한다
  useEffect(() => {
    const guard = (e: Event) => {
      const input = e as InputEvent;
      if (input.isComposing || !input.inputType.startsWith('insert')) return;
      if (emitted.get().length >= maxLength) e.preventDefault();
    };
    const off = editor.registerRootListener((root, previous) => {
      previous?.removeEventListener('beforeinput', guard);
      root?.addEventListener('beforeinput', guard);
    });
    return () => {
      off();
      editor.getRootElement()?.removeEventListener('beforeinput', guard);
    };
  }, [editor, maxLength, emitted]);
  return (
    <OnChangePlugin
      ignoreSelectionChange
      onChange={(state) => {
        const markdown = state.read(() => $convertToMarkdownString(TRANSFORMERS));
        if (markdown === emitted.get()) return;
        emitted.set(markdown);
        onChange(markdown);
      }}
    />
  );
}

export interface RichTextEditorProps {
  /** 저장 형식(가벼운 마크다운) */
  value: string;
  onChange: (markdown: string) => void;
  maxLength: number;
  placeholder: string;
  /** 글 칸을 이름 붙여 줄 라벨 요소 id */
  labelledBy: string;
  /** 편집기를 감싸는 요소 — 포커스·오류 표시를 위해 바깥이 잡는다 */
  editorRef?: React.Ref<HTMLDivElement>;
  minHeight?: number;
}

/**
 * 글쓰기 본문 편집기(Lexical) — 굵게·기울임·제목·목록·링크. `# `·`- `·`**굵게**`처럼 마크다운을 직접 쳐도 서식이 된다.
 * 값은 가벼운 마크다운 문자열로 주고받는다(예전 평문 글도 그대로 열린다).
 * 무거워서 글쓰기 화면이 열릴 때만 따로 내려받는다(React.lazy로 불러 쓴다).
 */
export default function RichTextEditor({ value, onChange, maxLength, placeholder, labelledBy, editorRef, minHeight = 180 }: RichTextEditorProps) {
  const lastEmitted = useRef(value);
  const emitted = useMemo<EmittedValue>(
    () => ({
      get: () => lastEmitted.current,
      set: (next) => {
        lastEmitted.current = next;
      },
    }),
    [],
  );
  const initial = useRef(value);
  const onError = useCallback((error: Error) => {
    throw error;
  }, []);
  const config = {
    namespace: 'triptic-post',
    nodes: NODES,
    onError,
    editorState: (editor: LexicalEditor) => {
      editor.update(() => $convertFromMarkdownString(initial.current, TRANSFORMERS), { discrete: true });
    },
    theme: {
      paragraph: styles.paragraph,
      heading: { h1: styles.heading, h2: styles.heading, h3: styles.heading, h4: styles.heading, h5: styles.heading, h6: styles.heading },
      list: { ul: styles.ul, ol: styles.ol, listitem: styles.li, nested: { listitem: styles.nestedLi } },
      quote: styles.quote,
      link: styles.link,
      text: { bold: styles.bold, italic: styles.italic },
    },
  };

  return (
    <LexicalComposer initialConfig={config}>
      <div className={styles.editor} ref={editorRef}>
        <Toolbar />
        <div className={styles.surface}>
          <RichTextPlugin
            contentEditable={<ContentEditable className={styles.content} style={{ minHeight }} aria-labelledby={labelledBy} aria-multiline="true" />}
            placeholder={<div className={styles.placeholder}>{placeholder}</div>}
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>
        <HistoryPlugin />
        <ListPlugin />
        <LinkPlugin validateUrl={isSafeUrl} />
        <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
        <SyncValuePlugin value={value} emitted={emitted} />
        <ChangePlugin maxLength={maxLength} onChange={onChange} emitted={emitted} />
      </div>
    </LexicalComposer>
  );
}
