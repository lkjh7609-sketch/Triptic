import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './toast.module.css';

interface ToastItem {
  id: number;
  message: string;
}

let nextId = 1;
let items: ToastItem[] = [];
const subscribers = new Set<(items: ToastItem[]) => void>();

function notify() {
  for (const sub of subscribers) sub(items);
}

/** 앱 전역 어디서든 짧은 안내 메시지를 띄운다(예: 무료 이용권 차감 안내).
 * 별도 Provider 없이 모듈 레벨 구독 목록만 쓴다 — AppShell에 <ToastHost/>
 * 하나만 마운트해두면 된다. */
export function showToast(message: string, durationMs = 3200) {
  const id = nextId++;
  items = [...items, { id, message }];
  notify();
  setTimeout(() => {
    items = items.filter((t) => t.id !== id);
    notify();
  }, durationMs);
}

export function ToastHost() {
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
      {list.map((t) => (
        <div key={t.id} className={styles.toast}>
          {t.message}
        </div>
      ))}
    </div>,
    document.body,
  );
}
