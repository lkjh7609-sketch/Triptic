import { describe, expect, it } from 'vitest';
import { balanceColumns, cityRuns, packColumns, ellipsize, hasCoord, hotelStays, mercatorFit, nearCluster, niceScale, placeLabels, project, rowBudget, spreadOverlaps } from './pdfLayout';

describe('표지', () => {
  it('일차별 도시는 이어지는 같은 도시를 묶는다', () => {
    const cities = ['도쿄', '도쿄', '도쿄', '교토', '오사카', '오사카'];
    expect(cityRuns((d) => cities[d - 1], 6)).toEqual([
      { city: '도쿄', from: 1, to: 3 },
      { city: '교토', from: 4, to: 4 },
      { city: '오사카', from: 5, to: 6 },
    ]);
  });

  it('숙소는 같은 숙소가 이어지는 밤을 한 번의 숙박으로(체크아웃은 다음 날)', () => {
    const stays = hotelStays({ 1: { name: 'A 호텔' }, 2: { name: 'A 호텔' }, 3: { name: 'B 료칸' }, 5: { name: 'A 호텔' } }, 6);
    expect(stays).toEqual([
      { name: 'A 호텔', address: undefined, fromDay: 1, toDay: 3, nights: 2 },
      { name: 'B 료칸', address: undefined, fromDay: 3, toDay: 4, nights: 1 },
      { name: 'A 호텔', address: undefined, fromDay: 5, toDay: 6, nights: 1 },
    ]);
  });
});

describe('동선 지도', () => {
  const box = { x: 10, y: 20, w: 180, h: 100 };
  const tokyo = [
    { lat: 35.7556, lng: 139.6286 }, // 해리포터(네리마)
    { lat: 35.6896, lng: 139.7006 }, // 신주쿠
    { lat: 35.658, lng: 139.7016 }, // 시부야
    { lat: 35.6605, lng: 139.7292 }, // 롯폰기
    { lat: 35.6717, lng: 139.765 }, // 긴자
  ];

  it('모든 점이 칸 안(여백 포함)에 들어가고, 북쪽이 위·동쪽이 오른쪽', () => {
    const { toXY } = project(tokyo, box, { x: 12, y: 10 });
    const xy = tokyo.map(toXY);
    for (const p of xy) {
      expect(p.x).toBeGreaterThanOrEqual(box.x + 12 - 1e-6);
      expect(p.x).toBeLessThanOrEqual(box.x + box.w - 12 + 1e-6);
      expect(p.y).toBeGreaterThanOrEqual(box.y + 10 - 1e-6);
      expect(p.y).toBeLessThanOrEqual(box.y + box.h - 10 + 1e-6);
    }
    expect(xy[0].y).toBeLessThan(xy[2].y); // 네리마가 시부야보다 북쪽 → 위
    expect(xy[4].x).toBeGreaterThan(xy[1].x); // 긴자가 신주쿠보다 동쪽 → 오른쪽
  });

  it('점이 하나면 최소 폭으로 — 가운데에 놓이고 축척이 너무 커지지 않는다', () => {
    const one = project([tokyo[1]], box, { x: 12, y: 10 });
    expect(one.toXY(tokyo[1])).toEqual({ x: 100, y: 70 });
    expect(one.mmPerKm).toBeLessThan(100);
  });

  it('공항처럼 혼자 멀리 떨어진 점은 지도에서 뺀다 — 절대 거리와, 나머지가 모여 있으면 상대 거리로도', () => {
    const narita = { lat: 35.772, lng: 140.3929 };
    expect(nearCluster([...tokyo, narita])).toHaveLength(5);
    // 신주쿠 근처 셋 + 하네다(약 16km) → 하네다만 빠진다
    const shinjuku = [
      { lat: 35.6948, lng: 139.7016 },
      { lat: 35.6852, lng: 139.71 },
      { lat: 35.6938, lng: 139.7034 },
    ];
    const haneda = { lat: 35.5494, lng: 139.7798 };
    expect(nearCluster([haneda, ...shinjuku])).toEqual(shinjuku);
    // 고르게 흩어진 하루(해리포터~긴자 약 15km)는 다 남는다
    expect(nearCluster(tokyo)).toHaveLength(5);
  });

  it('같은 자리 핀은 나선으로 비켜 놓는다', () => {
    const out = spreadOverlaps([{ x: 50, y: 50 }, { x: 50, y: 50 }, { x: 50.5, y: 50 }], 5);
    for (let i = 0; i < out.length; i += 1) for (let j = i + 1; j < out.length; j += 1) expect(Math.hypot(out[i].x - out[j].x, out[i].y - out[j].y)).toBeGreaterThanOrEqual(4.9);
  });

  it('이름표는 서로 겹치지 않고 칸 안에 놓인다', () => {
    const { toXY } = project(tokyo, box, { x: 30, y: 16 });
    const pins = tokyo.map(toXY);
    const rects = placeLabels(pins, pins.map(() => ({ w: 34, h: 9 })), box);
    expect(rects.every((r) => r.clear)).toBe(true);
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(box.x);
      expect(r.x + r.w).toBeLessThanOrEqual(box.x + box.w);
    }
    for (let i = 0; i < rects.length; i += 1)
      for (let j = i + 1; j < rects.length; j += 1) {
        const a = rects[i];
        const b = rects[j];
        expect(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h).toBe(false);
      }
  });

  it('축척 막대는 보기 좋은 거리로', () => {
    expect(niceScale(20, 180)).toEqual({ km: 2, mm: 40 });
    expect(niceScale(300, 180).km).toBe(0.1);
  });

  it('0,0·빈 좌표는 지도에 못 놓는다', () => {
    expect(hasCoord({ lat: 0, lng: 0 })).toBe(false);
    expect(hasCoord({ lat: null, lng: 139 })).toBe(false);
    expect(hasCoord({ lat: 35.6, lng: 139.7 })).toBe(true);
  });
});

describe('하루 한 쪽', () => {
  it('줄이 적으면 넉넉히, 많으면 줄이고, 그래도 넘치면 앞에서부터 + 마지막 줄은 더보기', () => {
    expect(rowBudget(5, 120)).toMatchObject({ rowH: 9.5, shown: 5 });
    const many = rowBudget(18, 120);
    expect(many.rowH).toBeCloseTo(120 / 18);
    expect(many.shown).toBe(18);
    const tooMany = rowBudget(30, 120);
    expect(tooMany.rowH).toBe(5.6);
    expect(tooMany.shown).toBe(20); // 21줄 들어가고 마지막 한 줄은 '+n곳 더'
    expect(tooMany.shown * tooMany.rowH + tooMany.rowH).toBeLessThanOrEqual(120);
  });

  it('말줄임', () => {
    expect(ellipsize('짧은 메모', () => true)).toBe('짧은 메모');
    expect(ellipsize('아주 긴 메모 내용입니다', (s) => s.length <= 6)).toBe('아주 긴…');
  });

  it('배경 지도(Web Mercator)에 맞춘 투영 — 정수 줌, 모든 점이 여백 안, 가운데가 중심', () => {
    const tokyo = [
      { lat: 35.7556, lng: 139.6286 },
      { lat: 35.6896, lng: 139.7006 },
      { lat: 35.658, lng: 139.7016 },
      { lat: 35.6717, lng: 139.765 },
    ];
    const fit = mercatorFit(tokyo, 640, 288, { x: 70, y: 40 });
    expect(Number.isInteger(fit.zoom)).toBe(true);
    for (const p of tokyo) {
      const q = fit.toPx(p);
      expect(q.x).toBeGreaterThanOrEqual(70 - 1e-6);
      expect(q.x).toBeLessThanOrEqual(570 + 1e-6);
      expect(q.y).toBeGreaterThanOrEqual(40 - 1e-6);
      expect(q.y).toBeLessThanOrEqual(248 + 1e-6);
    }
    const c = fit.toPx(fit.center);
    expect(c.x).toBeCloseTo(320, 3);
    expect(c.y).toBeCloseTo(144, 3);
    // 한 단계 더 확대하면 안 들어간다(가장 큰 줌)
    const tighter = mercatorFit(tokyo, 640, 288, { x: 70, y: 40 }, fit.zoom + 1, fit.zoom + 1);
    const xs = tokyo.map((p) => tighter.toPx(p).x);
    const ys = tokyo.map((p) => tighter.toPx(p).y);
    expect(Math.max(...xs) - Math.min(...xs) > 500 || Math.max(...ys) - Math.min(...ys) > 208).toBe(true);
  });
});

describe('체크리스트 두 칸', () => {
  it('묶음을 자르지 않고, 두 칸 높이 차가 가장 작은 자리에서 가른다', () => {
    // 서류 110 · 전자기기 62 · 통신 20 · 의류 45 · 위생 40 · 약 36 · 꿀템 38 (실제와 비슷한 높이)
    const h = [110, 62, 20, 45, 40, 36, 38];
    const [left, right] = balanceColumns(h, 250)!;
    expect(left.concat(right)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    const sum = (ids: number[]) => ids.reduce((a, i) => a + h[i], 0);
    expect(Math.max(sum(left), sum(right))).toBeLessThanOrEqual(250);
    expect(Math.abs(sum(left) - sum(right))).toBeLessThanOrEqual(40);
    expect(right[0]).toBe(2); // 서류·전자기기가 왼쪽, 통신 준비부터 오른쪽 맨 위
  });

  it('한 쪽에 안 들어가면 null, 여러 쪽으로 나누면 각 쪽이 넘치지 않는다', () => {
    expect(balanceColumns([200, 200, 200], 250)).toBeNull();
    const pages = packColumns([200, 200, 200, 100], 250);
    expect(pages.flat(2)).toEqual([0, 1, 2, 3]);
    for (const [l, r] of pages) {
      expect(l.reduce((a, i) => a + [200, 200, 200, 100][i], 0)).toBeLessThanOrEqual(250);
      expect(r.reduce((a, i) => a + [200, 200, 200, 100][i], 0)).toBeLessThanOrEqual(250);
    }
  });
});
