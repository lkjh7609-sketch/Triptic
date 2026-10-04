import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Car, X } from 'lucide-react';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import shared from '../stitch/shared.module.css';
import { congestionByRate, occupancyPct, remaining, type Congestion, type ParkingLot } from './parkingParse';
import { PARKING_PLANS, knownLotNames, type LotGroup, type ParkingPlan, type Shape } from './parkingLayouts';
import { useAirportParking } from './useAirportParking';
import styles from './ParkingMap.module.css';

/** 평면도 블록 하나에 그릴 값 — 묶음의 주차장을 합친다(층별 인천 단기주차장 등) */
interface GroupView {
  group: LotGroup;
  parts: { tag?: string; lot: ParkingLot }[];
  total: number;
  occupied: number;
  left: number;
  pct: number;
  congestion: Congestion | null;
  updatedAt: string | null;
}

function buildView(group: LotGroup, byName: Map<string, ParkingLot>): GroupView {
  const parts = group.parts.flatMap((p) => {
    const lot = byName.get(p.lot);
    return lot ? [{ tag: p.tag, lot }] : [];
  });
  const total = parts.reduce((n, p) => n + p.lot.total, 0);
  const occupied = parts.reduce((n, p) => n + p.lot.occupied, 0);
  // 남은 자리는 칸마다 0 아래로 내려가지 않게 자른 뒤 더한다(한 층이 넘쳐도 다른 층 빈자리를 깎지 않게)
  const left = parts.reduce((n, p) => n + remaining(p.lot), 0);
  const congestion = parts.length === 0 ? null : parts.length === 1 ? parts[0].lot.congestion : congestionByRate(total - left, total);
  const updatedAt = parts.map((p) => p.lot.updatedAt).filter((v): v is string => !!v).sort().at(-1) ?? null;
  return { group, parts, total, occupied, left, pct: occupancyPct({ total, occupied: total - left }), congestion, updatedAt };
}

const KST_CLOCK = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** 'HH:mm'(한국 시각) — 시각대가 붙은 ISO면 무엇이든 */
function kstClock(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : KST_CLOCK.format(d);
}

function ShapeEl({ shape, className }: { shape: Shape; className?: string }) {
  if (shape.kind === 'rect') return <rect className={className} x={shape.x} y={shape.y} width={shape.w} height={shape.h} rx={shape.r ?? 0} />;
  if (shape.kind === 'poly') return <polygon className={className} points={shape.points} />;
  return <path className={className} d={shape.d} />;
}

/** 숫자가 바뀌면(처음 그릴 때 포함) 0.6초 동안 세어 올라간다. 움직임 줄이기 설정이면 바로 */
function useCountUp(target: number, reduced: boolean): number {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    if (reduced) return;
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 600);
      const eased = 1 - (1 - t) ** 3;
      const v = Math.round(from + (target - from) * eased);
      setValue(v);
      fromRef.current = v;
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, reduced]);
  return reduced ? target : value;
}

function CongestionChip({ value }: { value: Congestion | null }) {
  const { t } = useTranslation('home');
  if (!value) return null;
  return <span className={`${styles.chip} ${styles[`chip_${value}`]}`}>{t(`airportPage.parking.congestion.${value}`)}</span>;
}

function Detail({ view, onClose, reduced, scrollIntoView }: { view: GroupView; onClose: () => void; reduced: boolean; scrollIntoView: boolean }) {
  const { t } = useTranslation('home');
  const count = useCountUp(view.left, reduced);
  const ref = useRef<HTMLDivElement>(null);
  // 휴대폰에서는 상세가 평면도 아래에 열려 화면 밖일 수 있다 — 보이는 곳까지만 살짝 내려 준다
  useEffect(() => {
    if (scrollIntoView) ref.current?.scrollIntoView?.({ behavior: reduced ? 'auto' : 'smooth', block: 'nearest' });
  }, [scrollIntoView, reduced]);
  const [grown, setGrown] = useState(reduced);
  useEffect(() => {
    if (reduced) return;
    const id = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(id);
  }, [reduced]);
  const name = t(`airportPage.parking.lot.${view.group.label}`);
  return (
    <div ref={ref} className={styles.detail} role="region" aria-label={name}>
      <div className={styles.detailHead}>
        <h3 className={styles.detailName}>{name}</h3>
        <button type="button" className={styles.closeBtn} onClick={onClose} aria-label={t('airportPage.parking.close')}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <div className={styles.bigRow}>
        <span className={`${styles.big} ${view.congestion ? styles[`text_${view.congestion}`] : ''}`} aria-hidden="true">
          {count.toLocaleString()}
        </span>
        <span className={styles.bigUnit}>{t('airportPage.parking.leftLabel')}</span>
        <CongestionChip value={view.congestion} />
      </div>
      <span className={styles.srOnly}>{t('airportPage.parking.left', { count: view.left })}</span>
      <div className={styles.bar} aria-hidden="true">
        <div className={`${styles.barFill} ${view.congestion ? styles[`fill_${view.congestion}`] : ''}`} style={{ width: `${grown ? view.pct : 0}%` }} />
      </div>
      <p className={styles.detailMeta}>
        {t('airportPage.parking.occupancy', { pct: Math.round(view.pct) })}
        {view.updatedAt ? ` · ${t('airportPage.parking.updated', { time: kstClock(view.updatedAt) })}` : ''}
      </p>
      {view.parts.length > 1 ? (
        <div className={styles.stack}>
          <h4 className={styles.stackTitle}>{t('airportPage.parking.floors')}</h4>
          <ul className={styles.stackList}>
            {view.parts.map(({ tag, lot }, i) => {
              const pct = occupancyPct(lot);
              return (
                <li key={lot.name} className={styles.floor} style={{ animationDelay: reduced ? undefined : `${i * 70}ms` }}>
                  <span className={styles.floorTag}>{tag ?? lot.name}</span>
                  <span className={styles.floorBar} aria-hidden="true">
                    <span className={`${styles.floorFill} ${styles[`fill_${lot.congestion}`]}`} style={{ width: `${grown ? pct : 0}%`, transitionDelay: reduced ? undefined : `${i * 70}ms` }} />
                  </span>
                  <span className={styles.floorLeft}>{t('airportPage.parking.left', { count: remaining(lot) })}</span>
                  <CongestionChip value={lot.congestion} />
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** 선택한 블록이 화면 가운데로 오도록 확대 — 블록 크기의 1.8배 칸을 채우되 최대 2.4배 */
function zoomFor(box: { x: number; y: number; width: number; height: number } | null, plan: ParkingPlan): string {
  if (!box) return 'translate(0px, 0px) scale(1)';
  const s = Math.max(1, Math.min(2.4, (plan.width * 0.55) / box.width, (plan.height * 0.55) / box.height));
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  // 확대해도 평면도 밖(빈 곳)이 보이지 않게 이동량을 자른다
  const tx = Math.min(0, Math.max(plan.width - plan.width * s, plan.width / 2 - cx * s));
  const ty = Math.min(0, Math.max(plan.height - plan.height * s, plan.height / 2 - cy * s));
  return `translate(${tx}px, ${ty}px) scale(${s})`;
}

/**
 * 공항 주차장 평면도 — 공식 안내도를 따라 그린 도식 위에 주차장마다 혼잡도 색과 남은 자리를 그린다(인터랙티브 데이터 시각화).
 * 블록을 누르면(키보드 Enter·Space도) 그 주차장으로 확대되고 상세(남은 자리 세어 올라가기·점유율 막대·층별 스택)가 펼쳐진다(마이크로인터랙션).
 * 아래 목록도 같은 선택을 한다 — 휴대폰에서 작은 평면도 대신 이름으로 고르기 쉽게.
 */
export function ParkingMap({ airport }: { airport: string }) {
  const { t } = useTranslation('home');
  const desktop = useMediaQuery('(min-width: 1024px)');
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const plans = PARKING_PLANS[airport];
  const { data, isLoading } = useAirportParking();
  const [planIdx, setPlanIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [box, setBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const groupRefs = useRef(new Map<string, SVGGElement>());
  const hatchId = `hatch-${useId().replace(/:/g, '')}`;

  const plan = plans?.[planIdx] ?? plans?.[0];
  const airportLots = useMemo(() => (plan ? (data?.lots ?? []).filter((l) => l.airport === plan.airport) : []), [data, plan]);
  const byName = useMemo(() => new Map(airportLots.map((l) => [l.name, l])), [airportLots]);
  const views = useMemo(() => (plan ? plan.groups.map((g) => buildView(g, byName)) : []), [plan, byName]);
  const allViews = useMemo(() => (plans ?? []).flatMap((p) => p.groups.map((g) => buildView(g, byName))), [plans, byName]);
  const others = useMemo(() => {
    if (!plans) return [];
    const known = knownLotNames(plans);
    return airportLots.filter((l) => !known.has(l.name));
  }, [plans, airportLots]);
  const selectedView = views.find((v) => v.group.id === selected) ?? null;

  // 선택한 블록의 실제 크기(getBBox)로 확대 위치를 잡는다 — 그리기가 끝난 뒤에 재야 해서 layout effect
  useLayoutEffect(() => {
    const el = selected ? groupRefs.current.get(selected) : undefined;
    if (!el || typeof el.getBBox !== 'function') {
      setBox(null);
      return;
    }
    try {
      const b = el.getBBox();
      setBox({ x: b.x, y: b.y, width: b.width, height: b.height });
    } catch {
      setBox(null);
    }
  }, [selected, planIdx]);

  if (!plans || !plan) return null;

  const isIcn = plan.airport === 'ICN';
  const source = isIcn ? 'icn' : 'kac';
  const fetchedAt = data?.fetchedAt[source] ?? null;
  const latest = airportLots.map((l) => l.updatedAt).filter((v): v is string => !!v).sort().at(-1) ?? null;
  const totalLeft = allViews.reduce((n, v) => n + v.left, 0);
  const fontSize = plan.width / 52;

  const select = (id: string) => setSelected((cur) => (cur === id ? null : id));
  const onKey = (e: KeyboardEvent, id: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      select(id);
    } else if (e.key === 'Escape') setSelected(null);
  };

  return (
    <section className={`${shared.section} ${styles.section}`} aria-labelledby={`parking-title-${airport}`}>
      <div className={`${shared.head} ${styles.head}`}>
        <div className={shared.headText}>
          <div className={styles.titleRow}>
            <Car size={desktop ? 22 : 20} aria-hidden="true" className={styles.titleIcon} />
            <h2 id={`parking-title-${airport}`} className={shared.title}>
              {t('airportPage.parking.title')}
            </h2>
          </div>
          <p className={shared.sub}>
            {latest ? `${t('airportPage.parking.sub', { time: kstClock(latest) })} · ` : ''}
            {t(`airportPage.parking.source.${source}`)}
          </p>
        </div>
        {plans.length > 1 ? (
          <div className={styles.planTabs} role="group" aria-label={t('airportPage.parking.planLabel')}>
            {plans.map((p, i) => (
              <button
                key={p.id}
                type="button"
                className={i === planIdx ? styles.planOn : styles.planOff}
                aria-pressed={i === planIdx}
                onClick={() => {
                  setPlanIdx(i);
                  setSelected(null);
                }}
              >
                {t(`airportPage.parking.plan.${p.planLabel}`)}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {isLoading ? (
        <div className={styles.skeleton} aria-hidden="true" />
      ) : airportLots.length === 0 ? (
        <p className={styles.empty}>{t('airportPage.parking.empty')}</p>
      ) : (
        <>
          {data?.stale[source] && fetchedAt ? (
            <p className={styles.notice}>{t('airportPage.parking.stale', { time: kstClock(fetchedAt) })}</p>
          ) : null}
          <p className={styles.total}>{t('airportPage.parking.total', { count: totalLeft })}</p>

          <div className={styles.layout}>
            <div className={styles.mapCard}>
              <svg
                className={styles.map}
                viewBox={`0 0 ${plan.width} ${plan.height}`}
                role="group"
                aria-label={t('airportPage.parking.map', { airport: isIcn ? t(`airportPage.parking.plan.${plan.planLabel}`) : t(`airportPage.full.${airport}`) })}
                onClick={(e) => {
                  if (e.target === e.currentTarget) setSelected(null);
                }}
              >
                <defs>
                  <pattern id={hatchId} width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <line x1="0" y1="0" x2="0" y2="14" className={styles.hatchLine} />
                  </pattern>
                </defs>
                <g
                  className={reduced ? styles.zoomStill : styles.zoom}
                  style={{ transform: zoomFor(selectedView ? box : null, plan) }}
                >
                  {plan.roads.map((d, i) => (
                    <path key={i} d={d} className={styles.road} />
                  ))}
                  {plan.context.map((c, i) => (
                    <g key={i} className={c.tone === 'terminal' ? styles.terminal : styles.muted}>
                      <ShapeEl shape={c.shape} />
                      {/* 휴대폰에선 평면도가 작아 회색 구역 이름은 읽을 수 없는 크기라 빼고, 터미널 이름만 크게 */}
                      {c.label && c.labelAt && (desktop || c.tone === 'terminal') ? (
                        <text
                          x={c.labelAt.x}
                          y={c.labelAt.y}
                          fontSize={fontSize * (desktop ? 0.8 : 1.5)}
                          className={styles.contextText}
                          transform={c.labelAt.rotate ? `rotate(${c.labelAt.rotate} ${c.labelAt.x} ${c.labelAt.y})` : undefined}
                        >
                          {t(`airportPage.parking.place.${c.label}`)}
                        </text>
                      ) : null}
                    </g>
                  ))}
                  {views.map((v) => {
                    const id = v.group.id;
                    const on = selected === id;
                    const tone = v.congestion ?? 'none';
                    const name = t(`airportPage.parking.lot.${v.group.label}`);
                    return (
                      <g
                        key={id}
                        ref={(el) => {
                          if (el) groupRefs.current.set(id, el);
                          else groupRefs.current.delete(id);
                        }}
                        className={`${styles.block} ${styles[`tone_${tone}`]} ${on ? styles.blockOn : ''} ${selected && !on ? styles.blockDim : ''}`}
                        role="button"
                        tabIndex={0}
                        aria-pressed={on}
                        aria-label={t('airportPage.parking.aria', {
                          name,
                          count: v.left,
                          status: v.congestion ? t(`airportPage.parking.congestion.${v.congestion}`) : '',
                        })}
                        onClick={() => select(id)}
                        onKeyDown={(e) => onKey(e, id)}
                      >
                        {v.group.shapes.map((s, i) => (
                          <ShapeEl key={i} shape={s} className={styles.shape} />
                        ))}
                        {v.congestion === 'full'
                          ? v.group.shapes.map((s, i) => (
                              <g key={`h${i}`} style={{ fill: `url(#${hatchId})` }} className={styles.hatch}>
                                <ShapeEl shape={s} />
                              </g>
                            ))
                          : null}
                        {on ? v.group.shapes.map((s, i) => <ShapeEl key={`p${i}`} shape={s} className={reduced ? styles.ringStill : styles.ring} />) : null}
                        {desktop && v.group.inline ? (
                          <text x={v.group.labelAt.x} y={v.group.labelAt.y} fontSize={fontSize * 0.66} className={styles.blockName}>
                            {name}{' '}
                            <tspan className={styles.blockCountInline} fontSize={fontSize * 0.95}>
                              {v.parts.length ? v.left.toLocaleString() : '–'}
                            </tspan>
                          </text>
                        ) : (
                          <>
                            {desktop ? (
                              <text x={v.group.labelAt.x} y={v.group.labelAt.y - fontSize * 0.62} fontSize={fontSize * 0.9} className={styles.blockName}>
                                {name}
                              </text>
                            ) : null}
                            <text
                              x={v.group.labelAt.x}
                              y={v.group.labelAt.y + (desktop ? fontSize * 0.8 : fontSize * 0.45)}
                              fontSize={desktop ? fontSize * 1.35 : fontSize * (v.group.inline ? 1.4 : 1.9)}
                              className={styles.blockCount}
                            >
                              {v.parts.length ? v.left.toLocaleString() : '–'}
                            </text>
                          </>
                        )}
                      </g>
                    );
                  })}
                  {plan.compass ? (
                    <>
                      <text x={fontSize * 1.2} y={plan.height - fontSize} fontSize={fontSize * 1.4} className={styles.compass}>
                        {plan.compass.left}
                      </text>
                      <text x={plan.width - fontSize * 1.2} y={plan.height - fontSize} fontSize={fontSize * 1.4} className={styles.compass}>
                        {plan.compass.right}
                      </text>
                    </>
                  ) : null}
                </g>
              </svg>
              <div className={styles.legend} aria-label={t('airportPage.parking.legend')}>
                {(['smooth', 'busy', 'full'] as const).map((c) => (
                  <span key={c} className={styles.legendItem}>
                    <span className={`${styles.swatch} ${styles[`tone_${c}`]}`} aria-hidden="true" />
                    {t(`airportPage.parking.congestion.${c}`)}
                  </span>
                ))}
                <span className={styles.hint}>{t('airportPage.parking.hint')}</span>
              </div>
            </div>

            <div className={styles.side}>
              {selectedView ? <Detail key={selectedView.group.id} view={selectedView} onClose={() => setSelected(null)} reduced={reduced} scrollIntoView={!desktop} /> : null}
              <ul className={styles.list}>
                {views.map((v) => (
                  <li key={v.group.id}>
                    <button
                      type="button"
                      className={`${styles.row} ${selected === v.group.id ? styles.rowOn : ''}`}
                      aria-pressed={selected === v.group.id}
                      onClick={() => select(v.group.id)}
                    >
                      <span className={`${styles.dot} ${styles[`tone_${v.congestion ?? 'none'}`]}`} aria-hidden="true" />
                      <span className={styles.rowName}>{t(`airportPage.parking.lot.${v.group.label}`)}</span>
                      <span className={styles.rowLeft}>{v.parts.length ? t('airportPage.parking.left', { count: v.left }) : '–'}</span>
                      <CongestionChip value={v.congestion} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {others.length > 0 ? (
            <div className={styles.others}>
              <h3 className={styles.othersTitle}>{t('airportPage.parking.others')}</h3>
              <ul className={styles.list}>
                {others.map((lot) => (
                  <li key={lot.name} className={styles.row}>
                    <span className={`${styles.dot} ${styles[`tone_${lot.congestion}`]}`} aria-hidden="true" />
                    {/* i18n-exempt: API가 주는 주차장 이름(새로 생긴 곳이라 번역이 없다) */}
                    <span className={styles.rowName}>{lot.name}</span>
                    <span className={styles.rowLeft}>{t('airportPage.parking.left', { count: remaining(lot) })}</span>
                    <CongestionChip value={lot.congestion} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
