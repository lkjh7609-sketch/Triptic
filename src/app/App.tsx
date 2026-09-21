import { Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router';
import { LocaleSync } from '@/shared/i18n/useSyncLocale';
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
      <QueryClientProvider client={queryClient}>
        <Suspense fallback={null}>
          <LocaleSync />
          <RouterProvider router={router} />
        </Suspense>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
