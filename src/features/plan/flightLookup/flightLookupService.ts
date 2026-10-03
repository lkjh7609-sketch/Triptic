import { getSupabaseClient } from '@/shared/api/supabaseClient';
import type { LookupResponse } from './schedule';

export type FlightLookupErrorCode = 'unauthorized' | 'not_ready' | 'upstream' | 'unknown';

export class FlightLookupError extends Error {
  constructor(readonly code: FlightLookupErrorCode) {
    super(`flight lookup failed: ${code}`);
  }
}

/** 편명+날짜로 항공편 찾기(Edge Function flight-lookup, 로그인 필요). 못 찾은 것은 오류가 아니라 found:false로 돌아온다 */
export async function lookupFlightSchedule(
  flightNo: string,
  date: string,
): Promise<LookupResponse> {
  const { data, error } = await getSupabaseClient().functions.invoke<LookupResponse>(
    'flight-lookup',
    {
      body: { flightNo, date },
    },
  );
  if (error) {
    let status = 0;
    const ctx = (error as { context?: unknown }).context;
    if (ctx instanceof Response) status = ctx.status;
    if (status === 401) throw new FlightLookupError('unauthorized');
    if (status === 503) throw new FlightLookupError('not_ready');
    if (status === 502) throw new FlightLookupError('upstream');
    throw new FlightLookupError('unknown');
  }
  if (!data || typeof data !== 'object' || !('found' in data))
    throw new FlightLookupError('unknown');
  return data;
}
