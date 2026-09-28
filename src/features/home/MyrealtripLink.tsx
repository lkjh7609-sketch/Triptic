import type { ReactNode } from 'react';
import { useMyrealtripLink, type PartnerPlacement } from '@/features/plan/partnerLinks';

interface MyrealtripLinkProps {
  /** kind=search(q) | page(url: 상품 상세) */
  target: { kind: 'search'; q: string } | { kind: 'page'; url: string };
  placement: PartnerPlacement;
  /** 마이링크를 아직 못 받았을 때 누르면("이동 중" 탭으로 받아서 연다) */
  onFallback: () => void;
  className?: string;
  children: ReactNode;
}

/**
 * 마이리얼트립으로 가는 진짜 링크 — 화면에 보일 때 마이링크를 미리 받아 두고(서버가 한 번 만들어
 * 저장) href로 쓴다. 누르는 순간 바로 열려 빈 화면을 기다리지 않는다.
 */
export function MyrealtripLink({ target, placement, onFallback, className, children }: MyrealtripLinkProps) {
  const params: Record<string, string> =
    target.kind === 'search' ? { kind: 'search', q: target.q, placement } : { kind: 'page', url: target.url, placement };
  const href = useMyrealtripLink(params);
  return (
    <a
      href={href ?? '#'}
      target="_blank"
      rel="sponsored noopener"
      className={className}
      onClick={(e) => {
        if (href) return;
        e.preventDefault();
        onFallback();
      }}
    >
      {children}
    </a>
  );
}
