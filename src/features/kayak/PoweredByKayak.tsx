import styles from './PoweredByKayak.module.css';

/** "Powered by Kayak" 표기 — 로고 파일이 없어 글자 표시(Kayak 항공·호텔 결과와 검색폼에 붙인다). 브랜드 이름이라 번역하지 않는다 */
export function PoweredByKayak({ className }: { className?: string }) {
  return (
    <span className={className ? `${styles.badge} ${className}` : styles.badge}>
      Powered by <strong className={styles.brand}>KAYAK</strong>
    </span>
  );
}
