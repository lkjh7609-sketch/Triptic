import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Info, TriangleAlert, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import styles from './toast.module.css';

export type ToastTone = 'success' | 'info' | 'error';

export interface ToastOptions {
  /** 제목 아래 작은 보조 설명 */
  description?: string;
  /** 제목 옆 작은 알약 글자(예: "완료") */
  badge?: string;
  /** 아이콘 색·모양. 기본은 info */
  tone?: ToastTone;
  durationMs?: number;
}

interface ToastItem {
  id: number;
  message: string;
  description?: string;
  badge?: string;
  tone: ToastTone;
  /** 사라지는 애니메이션 중 */
  leaving: boolean;
}

const DEFAULT_DURATION_MS = 3200;
const LEAVE_MS = 280;

let nextId = 1;
let items: ToastItem[] = [];
const subscribers = new Set<(items: ToastItem[]) => void>();

function notify() {
  for (const sub of subscribers) sub(items);
}

/** 사라지는 애니메이션을 틀고 끝나면 목록에서 뺀다 */
function dismissToast(id: number) {
  const target = items.find((t) => t.id === id);
  if (!target || target.leaving) return;
  items = items.map((t) => (t.id === id ? { ...t, leaving: true } : t));
  notify();
  setTimeout(() => {
    items = items.filter((t) => t.id !== id);
    notify();
  }, LEAVE_MS);
}

/** 앱 전역 어디서든 짧은 안내 메시지를 띄운다(예: 무료 이용권 차감 안내).
 * 별도 Provider 없이 모듈 레벨 구독 목록만 쓴다 — App에 <ToastHost/> 하나만 마운트해두면 된다.
 * 두 번째 인자는 예전처럼 표시 시간(ms)이거나, 설명·배지·톤을 담은 옵션 객체다. 라이트/다크 모두 같은 어두운 카드로 보인다 */
export function showToast(message: string, options?: number | ToastOptions) {
  const opts: ToastOptions = typeof options === 'number' ? { durationMs: options } : (options ?? {});
  const id = nextId++;
  items = [...items, { id, message, description: opts.description, badge: opts.badge, tone: opts.tone ?? 'info', leaving: false }];
  notify();
  setTimeout(() => dismissToast(id), opts.durationMs ?? DEFAULT_DURATION_MS);
}

function ToastIcon({ tone }: { tone: ToastTone }) {
  if (tone === 'success') return <Check size={14} strokeWidth={2.6} aria-hidden="true" />;
  if (tone === 'error') return <TriangleAlert size={14} strokeWidth={2.2} aria-hidden="true" />;
  return <Info size={14} strokeWidth={2.2} aria-hidden="true" />;
}

export function ToastHost() {
  const { t } = useTranslation('common');
  const [list, setList] = useState<ToastItem[]>(items);

  useEffect(() => {
    subscribers.add(setList);
    return () => {
      subscribers.delete(setList);
    };
  }, []);

  if (list.length === 0) return null;

  return createPortal(
    <div className={styles.stack} role="status" aria-live="polite">
      {list.map((item) => (
        <div key={item.id} className={`${styles.toast} ${item.leaving ? styles.leaving : styles.entering}`} data-tone={item.tone}>
          <span className={styles.badgeIcon}>
            <ToastIcon tone={item.tone} />
          </span>
          <div className={styles.text}>
            <span className={styles.title}>
              {item.message}
              {item.badge ? <span className={styles.pill}>{item.badge}</span> : null}
            </span>
            {item.description ? <span className={styles.description}>{item.description}</span> : null}
          </div>
          <button type="button" className={styles.close} onClick={() => dismissToast(item.id)} aria-label={t('action.close')}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}
