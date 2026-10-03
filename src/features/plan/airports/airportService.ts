import { getSupabaseClient } from '@/shared/api/supabaseClient';
import type { Airport } from './airportData';

/** 항공편 입력용 공항 목록 전체(약 300곳) — 한 번 받아 오래 쓴다 */
export async function listAirports(): Promise<Airport[]> {
  const { data, error } = await getSupabaseClient()
    .from('airports')
    .select('iata, country_code, name, city, lat, lng, timezone')
    .order('iata');
  if (error) throw error;
  return (data as Airport[]) ?? [];
}
