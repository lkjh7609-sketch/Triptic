import { useEffect, useId, useState, type RefObject } from 'react';
import { buildDisplacementMap, supportsBackdropSvgFilter } from './liquidGlass';

/** 굴절 세기 — 가장자리 안쪽 폭과 최대 이동량(px) */
const BEZEL_RATIO = 0.5;
const MAX_OFFSET = 22;

/**
 * 요소 크기에 맞는 변위 지도를 만들어 SVG 필터로 돌려준다. 지원하지 않는 브라우저에서는 filter가 null이라 호출한 쪽이 대체 스타일을 쓴다.
 * 필터 주소(`url(#…)`)는 filterUrl, 필터 정의는 svg를 화면 어딘가에 그려 둔다.
 */
export function useLiquidGlass(ref: RefObject<HTMLElement | null>) {
  const id = `liquid-glass-${useId().replace(/:/g, '')}`;
  const [supported] = useState(supportsBackdropSvgFilter);
  const [map, setMap] = useState<{ url: string; width: number; height: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!supported || !el) return;
    // 처음 한 번을 effect 안에서 getBoundingClientRect로 곧장 재면 아직 그려지는 중인 페이지 전체를 강제로 레이아웃해 100ms 안팎이 걸렸다
    // (Lighthouse 2026-10-04: 홈 로딩에서 HeroTabs 쪽 스크립트 1.4초). ResizeObserver는 observe하자마자 레이아웃이 끝난 뒤 한 번 알려 주므로
    // 그 콜백에서만 만든다(이미 계산된 값이라 강제 레이아웃이 없다). 크기가 같으면(반올림) 다시 그리지 않는다.
    let lastSize = '';
    const rebuild = () => {
      const { width, height } = el.getBoundingClientRect();
      const size = `${Math.round(width)}x${Math.round(height)}`;
      if (size === lastSize) return;
      lastSize = size;
      const url = buildDisplacementMap(width, height, { bezel: height * BEZEL_RATIO, maxOffset: MAX_OFFSET });
      setMap(url ? { url, width: Math.round(width), height: Math.round(height) } : null);
    };
    const observer = new ResizeObserver(rebuild);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, supported]);

  const ready = supported && map !== null;
  const svg = ready ? (
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: 'absolute', pointerEvents: 'none' }}>
      <filter id={id} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feImage href={map.url} x="0" y="0" width={map.width} height={map.height} preserveAspectRatio="none" result="map" />
        <feDisplacementMap in="SourceGraphic" in2="map" scale={MAX_OFFSET * 2} xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  ) : null;

  return { refracting: ready, filterUrl: `url(#${id})`, svg };
}
