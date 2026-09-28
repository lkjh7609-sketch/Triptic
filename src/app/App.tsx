import { Suspense } from 'react';
import i18next from '@/shared/i18n';
import { onAuthStateChange } from '@/shared/api/authService';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { RouterProvider } from 'react-router';
import { LocaleSync } from '@/shared/i18n/useSyncLocale';
import { offlinePersister, OFFLINE_CACHE_MAX_AGE_MS } from '@/shared/offline/persister';
import { ToastHost } from '@/shared/ui/toast';
import { ErrorBoundary } from './ErrorBoundary';
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
  if (event === 'SIGNED_OUT') queryClient.clear();
  refetchIfUserChanged(session?.user?.id ?? null);
});

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

export function App() {
  return (
    <ErrorBoundary>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister: offlinePersister, maxAge: OFFLINE_CACHE_MAX_AGE_MS }}
        onSuccess={() => {
          if (refetchAfterRestore) void queryClient.invalidateQueries();
        }}
      >
        <Suspense fallback={null}>
          <LocaleSync />
          <RouterProvider router={router} />
          <ToastHost />
        </Suspense>
      </PersistQueryClientProvider>
    </ErrorBoundary>
  );
}
