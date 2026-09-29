/**
 * 첫 접속 인트로의 두 번째 절반 — index.html의 정적 스플래시(가운데 로고)를 받아서
 * 화면 안 로고 자리(data-intro-anchor, PC 상단 바)로 날려 보내고 걷어낸다.
 * 앵커가 없으면(모바일 홈·로그인 화면 등) 비행기처럼 우측 상단으로 날아가 사라진다.
 */

const MIN_HOLD_MS = 1900; // 로고 등장 + 빛 스침이 끝날 때까지
const ANCHOR_GRACE_MS = 700; // 앱이 그려진 뒤 앵커가 나타나길 기다리는 시간 — 이후엔 앵커 없는 화면으로 본다
const MAX_WAIT_MS = 6000; // 앱이 끝내 안 그려져도 이 시간이 지나면 그냥 걷는다
const FLIGHT_MS = 820;
const TAKEOFF_MS = 1100;
const HARD_CLEANUP_MS = 9000;

type IntroState = 'playing' | 'reveal' | 'done' | 'skip';

function setState(state: IntroState) {
  document.documentElement.dataset.intro = state;
}

/** 화면 안에 실제로 보이는 로고 자리. 숨은 것(PC의 모바일 로고 등)·화면 밖은 제외 */
function findAnchor(): HTMLElement | null {
  const anchors = document.querySelectorAll<HTMLElement>('[data-intro-anchor]');
  for (const el of anchors) {
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) continue;
    if (r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) continue;
    if (el instanceof HTMLImageElement && !el.complete) continue;
    return el;
  }
  return null;
}

function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

/** 살짝 웅크렸다가 우측 상단 화면 밖으로 날아가며 작아지고 사라진다 */
async function takeOff(stage: HTMLElement) {
  const from = stage.getBoundingClientRect();
  const dx = window.innerWidth - from.left + from.width * 0.2;
  const dy = -(from.bottom + from.height * 0.2);
  stage.style.transformOrigin = '50% 50%';
  const flight = stage.animate(
    [
      { offset: 0, transform: 'translate(0, 0) rotate(0deg) scale(1)', opacity: 1, easing: 'cubic-bezier(0.3, 0, 0.4, 1)' },
      {
        offset: 0.2,
        transform: `translate(${-from.width * 0.05}px, ${from.height * 0.07}px) rotate(3deg) scale(0.96)`,
        opacity: 1,
        easing: 'cubic-bezier(0.55, 0, 0.9, 0.55)',
      },
      {
        offset: 0.62,
        transform: `translate(${dx * 0.4}px, ${dy * 0.2}px) rotate(-5deg) scale(0.82)`,
        opacity: 1,
        easing: 'cubic-bezier(0.4, 0, 0.9, 0.7)',
      },
      { offset: 1, transform: `translate(${dx}px, ${dy}px) rotate(-11deg) scale(0.45)`, opacity: 0 },
    ],
    { duration: TAKEOFF_MS, fill: 'forwards' },
  );
  await flight.finished;
}

export async function finishIntro(): Promise<void> {
  const root = document.documentElement;
  const splash = document.getElementById('intro-splash');
  if (!splash || root.dataset.intro !== 'playing') return;

  const stage = splash.querySelector<HTMLElement>('.intro-stage');
  const cleanup = () => {
    splash.remove();
    setState('done');
  };
  const hardTimer = window.setTimeout(cleanup, HARD_CLEANUP_MS);
  if (!stage) {
    cleanup();
    window.clearTimeout(hardTimer);
    return;
  }

  const t0 = Number(splash.dataset.t0) || 0;
  let anchor: HTMLElement | null = null;
  let mountedAt = 0;
  for (;;) {
    const now = performance.now();
    const elapsed = now - t0;
    anchor = findAnchor();
    // #root엔 앱이 뜨기 전부터 검색 로봇용 소개(#seo-intro, index.html)가 있다 — 그게 바뀌어야 뜬 것
    const rootFirst = document.getElementById('root')?.firstElementChild;
    if (!mountedAt && rootFirst && rootFirst.id !== 'seo-intro') mountedAt = now;
    const settled = mountedAt > 0 && now - mountedAt >= ANCHOR_GRACE_MS;
    if (elapsed >= MIN_HOLD_MS && (anchor || settled || elapsed >= MAX_WAIT_MS)) break;
    await nextFrame();
  }

  try {
    setState('reveal');
    splash.classList.add('is-leaving');

    if (anchor) {
      const to = anchor.getBoundingClientRect();
      const from = stage.getBoundingClientRect();
      const scale = to.width / from.width;
      const flight = stage.animate(
        [
          { transform: 'translate(0, 0) scale(1)' },
          { transform: `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${scale})` },
        ],
        { duration: FLIGHT_MS, easing: 'cubic-bezier(0.7, 0, 0.2, 1)', fill: 'forwards' },
      );
      await flight.finished;
      // 진짜 로고를 켜는 것과 스플래시를 걷는 것을 같은 프레임에 — 사이에 빈 프레임이 없게
      setState('done');
      await nextFrame();
    } else {
      await takeOff(stage);
    }
  } catch {
    // 애니메이션을 못 돌려도(오래된 웹뷰 등) 화면은 반드시 열어 준다
  } finally {
    window.clearTimeout(hardTimer);
    cleanup();
  }
}
