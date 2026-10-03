import { getSupabaseClient } from '@/shared/api/supabaseClient';
import type { CityCoord, TravelAlertRow } from './alertInfo';

/** 현재 여행경보 전체(약 200줄) */
export async function listTravelAlerts(): Promise<TravelAlertRow[]> {
  const { data, error } = await getSupabaseClient()
    .from('travel_alerts')
    .select(
      'country_code, country_name_ko, country_name_en, alarm_lvl, region_scope, remark, is_base',
    );
  if (error) throw error;
  return (data ?? []) as TravelAlertRow[];
}

/** 여행의 나라를 짐작하는 데 쓰는 우리 여행지 좌표(이름 조인 없이 가볍게) */
export async function listDestinationCoords(): Promise<CityCoord[]> {
  const { data, error } = await getSupabaseClient()
    .from('destinations')
    .select('country_code, lat, lng');
  if (error) throw error;
  return (data ?? []) as CityCoord[];
}
