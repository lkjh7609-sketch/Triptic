import styles from './BrandLogo.module.css';

export const BRAND_LOGO_SRC = '/triptic-logo.webp';

interface BrandLogoProps {
  className?: string;
}

export function BrandLogo({ className }: BrandLogoProps) {
  return (
    <img
      src={BRAND_LOGO_SRC}
      alt="Triptic"
      width={508}
      height={378}
      draggable={false}
      className={className ? `${styles.logo} ${className}` : styles.logo}
    />
  );
}
