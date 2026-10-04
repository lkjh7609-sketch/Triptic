import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Outlet, ScrollRestoration, useLocation, useNavigate, useNavigation, useNavigationType } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { TabBar } from './TabBar';
import { HeaderDesktop } from './HeaderDesktop';
import { GuestBanner } from './GuestBanner';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import { BootShell } from './BootShell';
import { useSession } from '@/shared/hooks/useSession';
import { GlobalAuthModal } from '@/features/auth/GlobalAuthModal';
import { closeLoginPrompt, openLoginPrompt, setSignedIn, useLoginPromptOpen } from '@/features/auth/loginPrompt';
import { SAMPLE_TRIP_ID } from '@/features/plan/sampleTrip';
import { forgetGuestImportAttempts, importGuestTripsOncePerSession, isGuestTripId } from '@/features/plan/guestTrips';
import { tripsQueryKey } from '@/features/plan/hooks/useTrips';
import { showToast } from '@/shared/ui/toast';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import { useTranslation } from 'react-i18next';
import { navDirection } from './navDirection';
import { requiresLogin } from './guestAccess';
import { useActivityPing } from '@/shared/hooks/useActivityPing';
import { DemographicsPrompt } from '@/features/community/DemographicsPrompt';
import { useTripRealtimeSync } from '@/features/plan/hooks/useTripRealtimeSync';
import { takePendingShare } from '@/features/shared/pendingShare';
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
 * 비로그인(PC·모바일 같음): 로그인 없이 둘러본다. 샘플 여행(/plan/sample-…)은 실제 편집 화면을 체험할 수
 *   있다(저장 안 됨, 상단 배너로 로그인). 모바일에는 헤더가 없어 하단 탭의 마지막 칸이 '설정' 대신
 *   '로그인'이 된다(TabBar). 헤더 "로그인"이나 로그인이 필요한 동작(계획 만들기·글쓰기 등,
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

  const guestTripId = /^\/plan\/([^/]+)$/.exec(pathname)?.[1];
  const isGuestDraft = !user && isGuestTripId(guestTripId);
  // 비로그인 샘플·임시 여행 화면: 헤더·탭바 대신 상단 안내 배너(전체 화면)
  const isGuestSample = !user && (pathname === `/plan/${SAMPLE_TRIP_ID}` || isGuestDraft);
  const routeNeedsLogin = !user && requiresLogin(pathname);
  // 로그인 여부를 로그인 창 모듈(requireLogin)에 알린다 — 자식 화면이 그려지는 같은 커밋 안에서.
  // 로그인에 성공하면 창도 닫힌다(로그인 필요 화면이었으면 그 화면이 바로 이어서 뜬다)
  useLayoutEffect(() => {
    setSignedIn(!!user);
  }, [user]);
  useNavDirectionAttr();
  // 함께 편집하는 여행·동행 인원을 실시간으로 맞춘다
  useTripRealtimeSync(user?.id ?? null);
  // 최근 접속·접속 국가를 서버에 남긴다(운영자 회원 관리용, 30분에 한 번)
  useActivityPing(user?.id ?? null);
  // 로그인하면 로그인 전에 이 기기에 만든 임시 여행을 계정으로 옮긴다(guestTrips.ts)
  const queryClient = useQueryClient();
  const { t } = useTranslation('common');
  const userId = user?.id;
  useEffect(() => {
    if (!userId) {
      forgetGuestImportAttempts();
      return;
    }
    void importGuestTripsOncePerSession(userId)?.then((result) => {
      if (result.imported.length > 0) {
        void queryClient.invalidateQueries({ queryKey: tripsQueryKey });
        showToast(t('guest.importedToast', { count: result.imported.length }), { tone: 'success' });
        // 옮기던 임시 여행 화면을 보고 있었으면 옮겨진 여행으로 이어 준다
        const current = result.imported.find((r) => `/plan/${r.guestId}` === window.location.pathname);
        if (current) navigate(`/plan/${current.tripId}`, { replace: true });
      }
      if (result.limitReached) showToast(t('guest.importLimit'));
      else if (result.failed) showToast(t('guest.importFailed'), { tone: 'error' });
    });
  }, [userId, queryClient, navigate, t]);
  // 공유 링크로 들어와 로그인했는데 첫 화면으로 돌아왔으면 그 링크로 이어서 참여한다
  useEffect(() => {
    if (!userId) return;
    const code = takePendingShare();
    if (code) navigate(`/shared/${code}`, { replace: true });
  }, [userId, navigate]);
  if (loading) {
    // 첫 화면 뼈대 그대로(저장된 로그인이 없을 때 최대 3초, useSession). data-boot-pending: index.html 부팅 안전망이
    // 이 화면을 아직 '안 뜬 것'으로 본다(여기서 멈추면 새로고침·안내)
    return (
      <div className={`app-shell ${styles.shell}`} data-boot-pending="">
        <BootShell fallback={<RouteSkeleton />} />
      </div>
    );
  }

  /** 로그인 필요 화면에서 창을 닫으면 온 곳으로(바로 들어온 주소면 홈으로) */
  const leaveGatedRoute = () => {
    closeLoginPrompt();
    if (((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0) navigate(-1);
    else navigate('/', { replace: true });
  };

  return (
    <div className={`app-shell ${styles.shell}`}>
      {isGuestSample ? <GuestBanner onLogin={openLoginPrompt} draft={isGuestDraft} /> : isDesktop && <HeaderDesktop />}
      <main className={styles.content}>
        {routeNeedsLogin ? null : showRouteSkeleton ? <RouteSkeleton /> : <Outlet />}
      </main>
      {!isGuestSample && !isDesktop && <TabBar guest={!user} />}
      {/* 커뮤니티에 처음 들어온 회원에게 성별·나잇대(선택)를 한 번 묻는다 */}
      {user && pathname.startsWith('/community') ? <DemographicsPrompt /> : null}
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
