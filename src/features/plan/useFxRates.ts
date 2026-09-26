import { useQuery } from '@tanstack/react-query';
import { fetchFxRates, fxRatesQueryKey, ONE_HOUR_MS } from './fxRates';

/** 1시간 동안 같은 값을 쓰고, 1시간이 지나면 다시 읽는다 */
export function useFxRates() {
  return useQuery({
    queryKey: fxRatesQueryKey,
    queryFn: fetchFxRates,
    staleTime: ONE_HOUR_MS,
    refetchInterval: ONE_HOUR_MS,
    gcTime: 7 * 24 * ONE_HOUR_MS,
  });
}
