import { Suspense } from 'react';
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
