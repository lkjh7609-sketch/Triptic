import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import type { VisitedPlace } from './statsCompute';
import { useWorldMap } from './useWorldMap';
import {
  WORLD_H,
  WORLD_W,
  fitView,
  panBy,
  pathBBox,
  unionBBox,
  viewBoxOf,
  worldView,
  zoomAt,
  type MapView,
} from './mapView';
import styles from './Stats.module.css';

const HINT_KEY = 'triptic.stats.mapHint';
const HINT_MS = 2800;
const DOT_PX = 4.5;

function hintSeen(): boolean {
  try {
    return window.sessionStorage.getItem(HINT_KEY) === '1';
  } catch {
    return false;
  }
}

function markHintSeen() {
  try {
    window.sessionStorage.setItem(HINT_KEY, '1');
  } catch {
    /* 저장 못 해도 안내만 한 번 더 보일 뿐 */
  }
}

function isTouchDevice(): boolean {
  try {
    return typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

/**
 * 다녀온 곳 세계 지도 — 구글 지도를 부르지 않는 정적 SVG(나라 모양은 Natural Earth 110m, 파일 한 번 받으면 끝).
 * 다녀온 나라는 브랜드색으로 칠하고, 도시는 점으로 찍는다.
 * 처음엔 다녀온 곳이 보이게 자동으로 확대한다. 한 손가락은 페이지 스크롤, 두 손가락은 확대·이동(PC는 끌기·버튼).
 */
export function WorldMap({ countries, places }: { countries: string[]; places: VisitedPlace[] }) {
  const { t } = useTranslation('stats');
  const world = useWorldMap();
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 300, h: 118 });
  const [touch] = useState(isTouchDevice);
  const [showHint, setShowHint] = useState(false);
  const aspect = size.w / size.h;

  const visited = useMemo(() => new Set(countries), [countries]);

  const x = useCallback((lng: number) => ((lng + 180) / 360) * WORLD_W, []);
  const y = useCallback(
    (lat: number) => {
      const top = world?.latTop ?? 84;
      const bottom = world?.latBottom ?? -58;
      return ((top - Math.max(bottom, Math.min(top, lat))) / (top - bottom)) * WORLD_H;
    },
    [world],
  );

  // 처음 보기: 도시 점이 있으면 점을 감싸고, 없으면 다녀온 나라 모양, 그것도 없으면 세계 전체
  const initialBox = useMemo(() => {
    if (!world) return null;
    if (places.length > 0) {
      return {
        minX: Math.min(...places.map((p) => x(p.lng))),
        maxX: Math.max(...places.map((p) => x(p.lng))),
        minY: Math.min(...places.map((p) => y(p.lat))),
        maxY: Math.max(...places.map((p) => y(p.lat))),
      };
    }
    return unionBBox(countries.map((c) => (world.paths[c] ? pathBBox(world.paths[c]) : null)));
  }, [world, places, countries, x, y]);

  const [view, setView] = useState<MapView>(() => worldView(WORLD_W / WORLD_H));
  const viewRef = useRef(view);
  const aspectRef = useRef(aspect);
  const touched = useRef(false);

  const apply = useCallback((next: MapView) => {
    viewRef.current = next;
    setView(next);
  }, []);

  // 화면 크기(=가로세로비) 추적 — 크기가 바뀌면 사용자가 만지기 전까지는 처음 보기를 다시 맞춘다
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setSize({ w: r.width, h: r.height });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [world]);

  useEffect(() => {
    aspectRef.current = aspect;
    if (!touched.current) apply(fitView(initialBox, aspect));
    else apply(panBy(viewRef.current, 0, 0, aspect));
  }, [aspect, initialBox, apply]);

  const reset = useCallback(() => {
    touched.current = false;
    apply(fitView(initialBox, aspectRef.current));
  }, [apply, initialBox]);

  const zoomBy = useCallback(
    (factor: number) => {
      touched.current = true;
      const v = viewRef.current;
      apply(zoomAt(v, factor, v.cx, v.cy, aspectRef.current));
    },
    [apply],
  );

  // 안내: 지도가 절반 이상 보이면 세션당 한 번
  useEffect(() => {
    const el = boxRef.current;
    if (!world || !el || hintSeen() || typeof IntersectionObserver === 'undefined') return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.5)) return;
        io.disconnect();
        markHintSeen();
        setShowHint(true);
        timer = setTimeout(() => setShowHint(false), HINT_MS);
      },
      { threshold: [0.5] },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [world]);

  // 조작: 두 손가락(확대·이동) / 마우스 끌기 / 트랙패드 핀치
  useEffect(() => {
    const el = boxRef.current;
    if (!world || !el) return;

    const toMap = (clientX: number, clientY: number) => {
      const r = el.getBoundingClientRect();
      const rw = r.width || 1;
      const rh = r.height || 1;
      const v = viewRef.current;
      const h = v.w / aspectRef.current;
      return {
        mx: v.cx - v.w / 2 + ((clientX - r.left) / rw) * v.w,
        my: v.cy - h / 2 + ((clientY - r.top) / rh) * h,
        unit: v.w / rw, // 화면 1px = 지도 몇 칸
      };
    };

    let pinch: { dist: number; x: number; y: number } | null = null;
    const pinchState = (e: TouchEvent) => {
      const a = e.touches[0];
      const b = e.touches[1];
      return {
        dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1,
        x: (a.clientX + b.clientX) / 2,
        y: (a.clientY + b.clientY) / 2,
      };
    };

    const onTouchStart = (e: TouchEvent) => {
      pinch = e.touches.length === 2 ? pinchState(e) : null;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !pinch) return;
      // 한 손가락 스크롤이 이미 시작됐으면 브라우저가 취소를 막는다 — 그때는 스크롤에 맡긴다
      if (!e.cancelable) return;
      e.preventDefault();
      touched.current = true;
      setShowHint(false);
      const next = pinchState(e);
      const { mx, my, unit } = toMap(next.x, next.y);
      let v = zoomAt(viewRef.current, next.dist / pinch.dist, mx, my, aspectRef.current);
      v = panBy(v, -(next.x - pinch.x) * unit, -(next.y - pinch.y) * unit, aspectRef.current);
      pinch = next;
      apply(v);
    };
    const onTouchEnd = (e: TouchEvent) => {
      pinch = e.touches.length === 2 ? pinchState(e) : null;
    };

    // iOS 사파리의 페이지 확대 제스처가 지도 위에서 끼어들지 않게
    const onGesture = (e: Event) => e.preventDefault();

    let drag: { x: number; y: number; id: number } | null = null;
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY, id: e.pointerId };
      el.setPointerCapture?.(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      const { unit } = toMap(e.clientX, e.clientY);
      touched.current = true;
      apply(panBy(viewRef.current, -(e.clientX - drag.x) * unit, -(e.clientY - drag.y) * unit, aspectRef.current));
      drag = { ...drag, x: e.clientX, y: e.clientY };
    };
    const onPointerUp = (e: PointerEvent) => {
      if (drag && e.pointerId === drag.id) drag = null;
    };
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return; // 그냥 휠은 페이지 스크롤
      e.preventDefault();
      touched.current = true;
      const { mx, my } = toMap(e.clientX, e.clientY);
      apply(zoomAt(viewRef.current, Math.exp(-e.deltaY * 0.01), mx, my, aspectRef.current));
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });
    el.addEventListener('gesturestart', onGesture);
    el.addEventListener('gesturechange', onGesture);
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
      el.removeEventListener('gesturestart', onGesture);
      el.removeEventListener('gesturechange', onGesture);
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
      el.removeEventListener('wheel', onWheel);
    };
  }, [world, apply]);

  if (!world) return <div className={styles.mapSkeleton} aria-hidden="true" />;

  // 확대해도 점·고리의 화면 크기는 그대로: 지도 1칸이 화면 몇 px인지로 나눈다
  const pxPerUnit = size.w / view.w;
  const r = DOT_PX / pxPerUnit;
  const ring = r * 2;

  return (
    <div className={styles.mapBox} ref={boxRef}>
      <svg
        className={styles.map}
        viewBox={viewBoxOf(view, aspect)}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={t('map.aria')}
      >
        <g>
          {Object.entries(world.paths).map(([code, d]) => (
            <path
              key={code}
              d={d}
              className={visited.has(code) ? styles.landVisited : styles.land}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>
        <g>
          {places.map((p) => {
            // 도시 점은 찍지 않는다 — 칠한 나라 모양으로 충분하다.
            // 다만 지도 데이터에 모양이 없는 나라(싱가포르 등)는 칠할 곳이 없어서 그 나라만 브랜드색 점과 고리로 보여 준다
            const noShape = p.country !== null && visited.has(p.country) && !world.paths[p.country];
            if (!noShape) return null;
            return (
              <g key={p.key}>
                <circle cx={x(p.lng)} cy={y(p.lat)} r={ring} className={styles.dotRing} vectorEffect="non-scaling-stroke" />
                <circle cx={x(p.lng)} cy={y(p.lat)} r={r} className={styles.dot} vectorEffect="non-scaling-stroke" />
              </g>
            );
          })}
        </g>
      </svg>
      <div className={styles.mapControls}>
        <button type="button" className={styles.mapBtn} onClick={() => zoomBy(1.6)} aria-label={t('map.zoomIn')}>
          <Plus size={16} />
        </button>
        <button type="button" className={styles.mapBtn} onClick={() => zoomBy(1 / 1.6)} aria-label={t('map.zoomOut')}>
          <Minus size={16} />
        </button>
        <button type="button" className={styles.mapBtn} onClick={reset} aria-label={t('map.reset')}>
          <RotateCcw size={16} />
        </button>
      </div>
      {showHint ? (
        <div className={styles.mapHint} role="status">
          {touch ? (
            <>
              <span className={styles.pinch} aria-hidden="true">
                <i />
                <i />
              </span>
              <span>{t('map.hintTouch')}</span>
            </>
          ) : (
            <span>{t('map.hintMouse')}</span>
          )}
        </div>
      ) : null}
    </div>
  );
}
