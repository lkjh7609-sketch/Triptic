/**
 * 첫 접속 인트로의 두 번째 절반 — index.html의 정적 스플래시(가운데 로고)를 받아서
 * 화면 안 로고 자리(data-intro-anchor)로 날려 보내고 걷어낸다.
 * 앵커가 끝내 없으면(로그인 화면·깊은 주소 등) 그 자리에서 부드럽게 사라진다.
 */

const MIN_HOLD_MS = 1900; // 로고 등장 + 빛 스침이 끝날 때까지
const MAX_WAIT_MS = 3000; // 앵커가 안 나타나도 이 시간이 지나면 그냥 걷는다
const FLIGHT_MS = 820;
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
  for (;;) {
    const elapsed = performance.now() - t0;
    anchor = findAnchor();
    if (elapsed >= MIN_HOLD_MS && (anchor || elapsed >= MAX_WAIT_MS)) break;
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
      const fade = splash.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, easing: 'ease', fill: 'forwards' });
      stage.animate(
        [{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }],
        { duration: 500, easing: 'ease', fill: 'forwards' },
      );
      await fade.finished;
    }
  } catch {
    // 애니메이션을 못 돌려도(오래된 웹뷰 등) 화면은 반드시 열어 준다
  } finally {
    window.clearTimeout(hardTimer);
    cleanup();
  }
}
