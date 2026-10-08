import { Suspense, useEffect } from 'react';
import i18next from '@/shared/i18n';
import { onAuthStateChange } from '@/shared/api/authService';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { RouterProvider } from 'react-router';
import { LocaleSync } from '@/shared/i18n/useSyncLocale';
import { offlinePersister, OFFLINE_CACHE_MAX_AGE_MS } from '@/shared/offline/persister';
import { ToastHost } from '@/shared/ui/toast';
import { installExternalLinkHandler } from '@/shared/externalLink';
import { installNativeAuthListener } from '@/shared/api/nativeAuth';
import { useSession } from '@/shared/hooks/useSession';
import { installPushTapHandler, registerPushNotifications } from '@/shared/push/registerPush';
import { identifyUser, resetIdentity, track } from '@/shared/monitoring';
import { SuspensionGate } from '@/features/auth/SuspensionGate';
import { LoginConflictGate } from '@/features/auth/LoginConflictGate';
import { ErrorBoundary } from './ErrorBoundary';
import { BootShell } from './BootShell';
import { router } from './router';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

// 여행지 이름·샘플 여행처럼 표시 언어로 가져오는 데이터는 언어가 바뀌면 다시 읽는다
i18next.on('languageChanged', () => {
  void queryClient.invalidateQueries({ queryKey: ['community'] });
});

// 로그아웃하면 메모리의 쿼리 캐시도 비운다. ['trips'] 같은 키는 사용자 id를 포함하지 않아서,
// 같은 탭에서 다른 계정으로 로그인하면 이전 계정의 여행 목록이 staleTime 동안 보일 수 있었다.
onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') {
    queryClient.clear();
    resetIdentity();
  }
  const user = session?.user;
  if (user) {
    identifyUser(user.id);
    trackSignupOnce(event, user);
  }
  refetchIfUserChanged(user?.id ?? null);
});

/** 가입 직후 첫 로그인이면 가입 완료 이벤트를 한 번만 — 계정을 만든 시각과 로그인 시각이 거의 같으면 신규다 */
function trackSignupOnce(event: string, user: { id: string; created_at: string; last_sign_in_at?: string; app_metadata?: { provider?: string } }) {
  if (event !== 'SIGNED_IN' || !user.last_sign_in_at) return;
  const gap = Math.abs(new Date(user.last_sign_in_at).getTime() - new Date(user.created_at).getTime());
  if (gap > 2 * 60_000) return;
  const key = `triptic-signup-tracked:${user.id}`;
  try {
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, '1');
  } catch {
    return;
  }
  track('signup_completed', { provider: user.app_metadata?.provider ?? 'unknown' });
}

// PC는 로그인 없이 둘러볼 수 있어서, 비로그인으로 받아 둔 목록(여행 0개 등)이 캐시·IndexedDB에
// 남는다. 로그인(소셜 로그인은 페이지를 새로 연다)으로 사용자가 바뀌면 전부 다시 읽는다.
// 저장된 캐시 복원이 인증 이벤트보다 늦을 수 있어, 복원이 끝난 뒤(onSuccess)에도 한 번 더.
const LAST_USER_KEY = 'triptic-last-user';
let refetchAfterRestore = false;
function refetchIfUserChanged(userId: string | null) {
  let last: string | null = null;
  try {
    last = localStorage.getItem(LAST_USER_KEY);
    localStorage.setItem(LAST_USER_KEY, userId ?? '');
  } catch {
    return;
  }
  if (userId && last !== userId) {
    refetchAfterRestore = true;
    void queryClient.invalidateQueries();
  }
}

/** 앱(iOS)에서만: 로그인하면 알림 권한을 묻고 기기를 등록하고, 알림을 누르면 그 화면으로 연다(웹에서는 아무것도 하지 않는다) */
function PushBootstrap() {
  const { user } = useSession();
  const userId = user?.id;
  useEffect(() => {
    if (userId) void registerPushNotifications(userId);
  }, [userId]);
  useEffect(() => installPushTapHandler((path) => void router.navigate(path)), []);
  return null;
}

export function App() {
  // 앱에서는 호텔·항공·액티비티 등 바깥 사이트 링크를 인앱 브라우저로 연다(웹에서는 아무 일도 하지 않는다)
  useEffect(() => installExternalLinkHandler(), []);
  // 앱에서 소셜 로그인이 끝나 앱 전용 주소로 돌아오면 그 코드로 로그인을 마친다(웹에서는 아무것도 하지 않는다)
  useEffect(() => installNativeAuthListener(), []);
  return (
    <ErrorBoundary>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister: offlinePersister, maxAge: OFFLINE_CACHE_MAX_AGE_MS }}
        onSuccess={() => {
          if (refetchAfterRestore) void queryClient.invalidateQueries();
        }}
      >
        {/* 번역 파일을 기다리는 동안 첫 화면 뼈대 — null이면 index.html의 뼈대가 지워진 뒤 흰 화면이 끼었다 */}
        <Suspense fallback={<BootShell />}>
          <LocaleSync />
          <RouterProvider router={router} />
          <ToastHost />
          <SuspensionGate />
          <LoginConflictGate />
          <PushBootstrap />
        </Suspense>
      </PersistQueryClientProvider>
    </ErrorBoundary>
  );
}
