import styles from './BrandLogo.module.css';

export const BRAND_LOGO_SRC = '/triptic-logo.webp';

interface BrandLogoProps {
  className?: string;
}

/** 로고 이미지. 첫 접속 인트로(introSplash.ts)가 날아와 앉는 자리는 data-intro-anchor로 표시한다 */
export function BrandLogo({ className }: BrandLogoProps) {
  return (
    <img
      src={BRAND_LOGO_SRC}
      alt="Triptic"
      width={508}
      height={378}
      draggable={false}
      data-intro-anchor=""
      className={className ? `${styles.logo} ${className}` : styles.logo}
    />
  );
}
