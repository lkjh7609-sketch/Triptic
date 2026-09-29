import styles from './BrandLogo.module.css';

export const BRAND_LOGO_SRC = '/triptic-logo.webp';

interface BrandLogoProps {
  className?: string;
  /** 첫 접속 인트로(introSplash.ts)의 로고가 날아와 앉을 자리로 표시 — 화면에 하나만 */
  introAnchor?: boolean;
}

export function BrandLogo({ className, introAnchor = false }: BrandLogoProps) {
  return (
    <img
      src={BRAND_LOGO_SRC}
      alt="Triptic"
      width={508}
      height={378}
      draggable={false}
      data-intro-anchor={introAnchor ? '' : undefined}
      className={className ? `${styles.logo} ${className}` : styles.logo}
    />
  );
}
