import { useQuery } from '@tanstack/react-query';
import { listAirports } from './airportService';

export const airportsQueryKey = ['airports'] as const;

/**
 * 공항 목록. 표가 아직 없거나(마이그레이션 전) 받지 못하면 오류/빈 목록이 되고, 항공편 입력은 예전처럼 Google 검색으로 돌아간다.
 * 공항은 거의 안 바뀌어서 하루 동안 다시 묻지 않는다.
 */
export function useAirports() {
  return useQuery({
    queryKey: airportsQueryKey,
    queryFn: listAirports,
    staleTime: 24 * 60 * 60 * 1000,
    retry: 1,
  });
}
