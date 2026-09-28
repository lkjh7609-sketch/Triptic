import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Outlet, ScrollRestoration, useLocation, useNavigate, useNavigation, useNavigationType } from 'react-router';
import { TabBar } from './TabBar';
import { HeaderDesktop } from './HeaderDesktop';
import { GuestBanner } from './GuestBanner';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import { useSession } from '@/shared/hooks/useSession';
import { GlobalAuthModal } from '@/features/auth/GlobalAuthModal';
import { SAMPLE_TRIP_ID } from '@/features/plan/sampleTrip';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import { useTranslation } from 'react-i18next';
import { FlightsWidgetHost } from '@/features/home/FlightsWidgetHost';
import { flightsProviderFor } from '@/features/plan/flightsSearchLink';
import { navDirection } from './navDirection';
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
 * 비로그인: 로그인 화면으로 막는다. 예외는 샘플 여행 하나(/plan/sample-…) —
 * 로그인 없이 실제 편집 화면을 체험할 수 있고(저장 안 됨), 상단 배너로 로그인할 수 있다.
 */
export function AppShell() {
  const navigation = useNavigation();
  const { pathname } = useLocation();
  const showRouteSkeleton = useDelayedFlag(navigation.state === 'loading', 150);
  const { user, loading } = useSession();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [authOpen, setAuthOpen] = useState(false);

  const isGuestSample = !user && pathname === `/plan/${SAMPLE_TRIP_ID}`;
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

  if (!user && !isGuestSample) {
    return <GlobalAuthModal />;
  }

  return (
    <div className={`app-shell ${styles.shell}`}>
      {isGuestSample ? <GuestBanner onLogin={() => setAuthOpen(true)} /> : isDesktop && <HeaderDesktop />}
      <main className={styles.content}>
        {showRouteSkeleton ? <RouteSkeleton /> : <Outlet />}
        {flightsWidgetMounted ? <FlightsWidgetHost visible={onFlights && !showRouteSkeleton} /> : null}
      </main>
      {!isGuestSample && !isDesktop && <TabBar />}
      {isGuestSample && authOpen ? <GlobalAuthModal onClose={() => setAuthOpen(false)} /> : null}
      {/* 새 화면은 맨 위에서, 뒤로가기/탭 복귀는 보던 위치에서 — 키를 경로로 잡아
          검색 파라미터만 바뀌는 이동(필터 등)에서는 스크롤이 튀지 않는다 */}
      <ScrollRestoration getKey={(location) => location.pathname} />
    </div>
  );
}
