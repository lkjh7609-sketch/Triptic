import type { CSSProperties } from 'react';
import { Compass } from 'lucide-react';
import styles from './HomeWordmark.module.css';

const NAME = 'Triptic';

/** 모바일·태블릿 홈 검색창 위 사이트 이름 — 나침반 로고가 돌아 자리 잡고 글자가 차례로 떠오른다 */
export function HomeWordmark() {
  return (
    <div className={styles.wordmark} aria-hidden="true">
      <span className={styles.mark}>
        <Compass size={20} strokeWidth={2.25} className={styles.needle} />
      </span>
      <span className={styles.name}>
        {NAME.split('').map((ch, i) => (
          <span key={i} className={styles.letter} style={{ '--i': i } as CSSProperties}>
            {ch}
          </span>
        ))}
        <span className={styles.rule} />
      </span>
    </div>
  );
}
