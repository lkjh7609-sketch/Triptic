import { Suspense } from 'react';
import i18next from '@/shared/i18n';
import { onAuthStateChange } from '@/shared/api/authService';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { RouterProvider } from 'react-router';
import { LocaleSync } from '@/shared/i18n/useSyncLocale';
import { offlinePersister, OFFLINE_CACHE_MAX_AGE_MS } from '@/shared/offline/persister';
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
onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') queryClient.clear();
});

export function App() {
  return (
    <ErrorBoundary>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister: offlinePersister, maxAge: OFFLINE_CACHE_MAX_AGE_MS }}
      >
        <Suspense fallback={null}>
          <LocaleSync />
          <RouterProvider router={router} />
        </Suspense>
      </PersistQueryClientProvider>
    </ErrorBoundary>
  );
}
