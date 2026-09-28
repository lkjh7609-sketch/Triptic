import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Outlet, ScrollRestoration, useLocation, useNavigate, useNavigation, useNavigationType } from 'react-router';
import { TabBar } from './TabBar';
import { HeaderDesktop } from './HeaderDesktop';
import { GuestBanner } from './GuestBanner';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import { useSession } from '@/shared/hooks/useSession';
import { GlobalAuthModal } from '@/features/auth/GlobalAuthModal';
import { closeLoginPrompt, openLoginPrompt, setSignedIn, useLoginPromptOpen } from '@/features/auth/loginPrompt';
import { SAMPLE_TRIP_ID } from '@/features/plan/sampleTrip';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import { useTranslation } from 'react-i18next';
import { FlightsWidgetHost } from '@/features/home/FlightsWidgetHost';
import { flightsProviderFor } from '@/features/plan/flightsSearchLink';
import { navDirection } from './navDirection';
import { requiresLogin } from './guestAccess';
import styles from './AppShell.module.css';

function RouteSkeleton() {
  return (
    <div style={{ padding: 16 }}>
      <Skeleton height="24px" width="50%" />
      <div style={{ height: 12 }} />
      <Skeleton height="88px" />
    </div>
  );
}

/** 청크가 금방 오면 스켈레톤을 건너뛰고 이전 화면 → 새 화면으로 바로 전환되게 조금 늦게 띄운다 */
function useDelayedFlag(flag: boolean, delayMs: number) {
  const [elapsed, setElapsed] = useState(false);
  useEffect(() => {
    if (!flag) return;
    const id = window.setTimeout(() => setElapsed(true), delayMs);
    return () => {
      window.clearTimeout(id);
      setElapsed(false);
    };
  }, [flag, delayMs]);
  return flag && elapsed;
}

/**
 * 항공 위젯(Travelpayouts White Label)은 결과 페이지를 대시보드에 등록된 주소(지금 사이트
 * 루트)로 연다 — 특히 "호텔도 보기"가 켜진 왕복 검색은 새 탭을 루트?flightSearch=…로 열어
 * 홈 화면이 떴다. 루트로 들어온 항공 검색 주소는 쿼리를 그대로 들고 /flights로 넘긴다.
 */
const FLIGHTS_WIDGET_PARAMS = ['flightSearch', 'ticketId'];
function useRedirectFlightsWidgetResults() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (pathname !== '/') return;
    const params = new URLSearchParams(search);
    if (FLIGHTS_WIDGET_PARAMS.some((key) => params.has(key))) navigate(`/flights${search}`, { replace: true });
  }, [pathname, search, navigate]);
}

/** 새 화면이 그려지는 순간(View Transition 스냅샷 직전) 방향을 html[data-nav]에 적는다 */
function useNavDirectionAttr() {
  const { pathname } = useLocation();
  const navType = useNavigationType();
  const prevPathname = useRef(pathname);
  useLayoutEffect(() => {
    if (prevPathname.current === pathname) return;
    document.documentElement.dataset.nav = navDirection(prevPathname.current, pathname, navType);
    prevPathname.current = pathname;
  }, [pathname, navType]);
}

/**
 * 4탭 셸 (DEVELOPMENT_PLAN.md §6, §7.1~7.5)
 * 스크롤 컨테이너 하단 여백은 각 화면에서 tab-bar 높이만큼 확보한다
 * (01-design-system.md §5.1).
 * lazy 라우트(router.tsx) 코드가 로드되는 동안 스켈레톤을 보여준다 —
 * 스피너 금지 원칙(01-design-system.md §6.7)을 탭 전환에도 그대로 적용.
 *
 * 비로그인:
 * - 모바일: 로그인 화면으로 막는다. 예외는 샘플 여행 하나(/plan/sample-…) — 로그인 없이 실제
 *   편집 화면을 체험할 수 있고(저장 안 됨), 상단 배너로 로그인할 수 있다.
 * - PC: 로그인 없이 둘러본다. 헤더 "로그인"이나 로그인이 필요한 동작(계획 만들기·글쓰기 등,
 *   loginPrompt.ts)에서 로그인 창을 띄우고, 로그인해야 하는 화면(guestAccess.ts)은 창부터 띄운다.
 */
export function AppShell() {
  const navigation = useNavigation();
  const { pathname } = useLocation();
  const showRouteSkeleton = useDelayedFlag(navigation.state === 'loading', 150);
  const { user, loading } = useSession();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const navigate = useNavigate();
  const loginPromptOpen = useLoginPromptOpen();

  const isGuestSample = !user && pathname === `/plan/${SAMPLE_TRIP_ID}`;
  const routeNeedsLogin = !user && requiresLogin(pathname);
  // 로그인 여부를 로그인 창 모듈(requireLogin)에 알린다 — 자식 화면이 그려지는 같은 커밋 안에서.
  // 로그인에 성공하면 창도 닫힌다(로그인 필요 화면이었으면 그 화면이 바로 이어서 뜬다)
  useLayoutEffect(() => {
    setSignedIn(!!user);
  }, [user]);
  useNavDirectionAttr();
  useRedirectFlightsWidgetResults();
  // 항공 위젯은 처음 들어올 때 만들고 그 뒤로는 숨기기만 한다(FlightsWidgetHost 참고).
  // 한국어는 마이리얼트립 검색 폼을 쓰므로 위젯을 만들지 않는다
  const { i18n } = useTranslation();
  const onFlights = pathname === '/flights' && flightsProviderFor(i18n.language) === 'travelpayouts';
  const [flightsWidgetMounted, setFlightsWidgetMounted] = useState(onFlights);
  if (onFlights && !flightsWidgetMounted) setFlightsWidgetMounted(true);

  if (loading) {
    return (
      <div className={`app-shell ${styles.shell}`}>
        <RouteSkeleton />
      </div>
    );
  }

  if (!user && !isGuestSample && !isDesktop) {
    return <GlobalAuthModal />;
  }

  /** 로그인 필요 화면에서 창을 닫으면 온 곳으로(바로 들어온 주소면 홈으로) */
  const leaveGatedRoute = () => {
    closeLoginPrompt();
    if (((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0) navigate(-1);
    else navigate('/', { replace: true });
  };

  return (
    <div className={`app-shell ${styles.shell}`}>
      {isGuestSample ? <GuestBanner onLogin={openLoginPrompt} /> : isDesktop && <HeaderDesktop />}
      <main className={styles.content}>
        {routeNeedsLogin ? null : showRouteSkeleton ? <RouteSkeleton /> : <Outlet />}
        {flightsWidgetMounted ? <FlightsWidgetHost visible={onFlights && !showRouteSkeleton} /> : null}
      </main>
      {!isGuestSample && !isDesktop && <TabBar />}
      {!user && (routeNeedsLogin || loginPromptOpen) ? (
        <GlobalAuthModal onClose={routeNeedsLogin ? leaveGatedRoute : closeLoginPrompt} />
      ) : null}
      {/* 이동(탭·링크)은 항상 맨 위에서, 뒤로·앞으로 가기만 보던 위치로 — 기본 키(기록 항목마다
          다름). 예전엔 키를 경로로 잡아 한 번 가 본 탭으로 다시 가면 예전 위치(페이지 중간)로 떴다.
          검색 파라미터만 바꾸는 이동은 preventScrollReset으로 위치를 유지한다 */}
      <ScrollRestoration />
    </div>
  );
}
