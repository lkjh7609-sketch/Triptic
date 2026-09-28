import { haversineKm } from '@/features/plan/map/geo';

/**
 * Klook 도시 번호 ↔ 우리 여행지(destinations 100곳) 좌표.
 * Klook 위젯 데이터 API(affiliate.klook.com/v1/affadsrv/widget/dynamic/auto?cid=)에 번호를
 * 넣으면 그 도시 이름이 돌아오는 걸 이용해 2026-09-28에 1~700번을 한 번 조사하고, 영어
 * 도시 이름으로 여행지와 짝지었다. 목록에 없는 여행지는 기본 도시로 대신한다.
 */
export const DEFAULT_KLOOK_CITY_ID = 2; // 홍콩 — Travelpayouts 위젯 설정 기본값

const KLOOK_CITIES: ReadonlyArray<{ id: number; lat: number; lng: number }> = [
  { id: 131, lat: 24.4539, lng: 54.3773 }, // abudhabi (Abu Dhabi region)
  { id: 90, lat: 52.3676, lng: 4.9041 }, // amsterdam (Amsterdam)
  { id: 154, lat: 37.9838, lng: 23.7275 }, // athens (Athens)
  { id: 80, lat: -36.8485, lng: 174.7633 }, // auckland (Auckland)
  { id: 8, lat: -8.3405, lng: 115.092 }, // bali (Bali region)
  { id: 4, lat: 13.7563, lng: 100.5018 }, // bangkok (Bangkok)
  { id: 108, lat: 41.3874, lng: 2.1686 }, // barcelona (Barcelona)
  { id: 57, lat: 39.9042, lng: 116.4074 }, // beijing (Beijing)
  { id: 36, lat: 33.2846, lng: 131.4913 }, // beppu (Kyushu/Okinawa region)
  { id: 103, lat: 52.52, lng: 13.405 }, // berlin (Berlin)
  { id: 70, lat: -27.4698, lng: 153.0251 }, // brisbane (Brisbane)
  { id: 306, lat: 50.8503, lng: 4.3517 }, // brussels (Brussels)
  { id: 307, lat: 47.4979, lng: 19.0402 }, // budapest (Budapest)
  { id: 46, lat: 35.1796, lng: 129.0756 }, // busan (Busan)
  { id: 540, lat: 21.1619, lng: -86.8515 }, // cancun (Cancún)
  { id: 272, lat: -33.9249, lng: 18.4241 }, // capetown (Cape Town)
  { id: 97, lat: 10.3157, lng: 123.8854 }, // cebu (Cebu City)
  { id: 5, lat: 18.7883, lng: 98.9853 }, // chiangmai (Chiang Mai region)
  { id: 141, lat: 55.6761, lng: 12.5683 }, // copenhagen (Copenhagen)
  { id: 74, lat: 16.0544, lng: 108.2022 }, // danang (Da Nang)
  { id: 145, lat: 28.6139, lng: 77.209 }, // delhi (New Delhi)
  { id: 162, lat: 25.2854, lng: 51.531 }, // doha (Doha)
  { id: 78, lat: 25.2048, lng: 55.2708 }, // dubai (Dubai)
  { id: 281, lat: 53.3498, lng: -6.2603 }, // dublin (County Dublin)
  { id: 376, lat: 42.6507, lng: 18.0944 }, // dubrovnik (Dubrovnik)
  { id: 189, lat: -17.7134, lng: 178.065 }, // fiji (Fiji)
  { id: 115, lat: 43.7696, lng: 11.2558 }, // florence (Florence)
  { id: 36, lat: 33.5904, lng: 130.4017 }, // fukuoka (Kyushu/Okinawa region)
  { id: 286, lat: 13.4443, lng: 144.7937 }, // guam (Guam)
  { id: 34, lat: 21.0278, lng: 105.8342 }, // hanoi (Hanoi)
  { id: 169, lat: 21.3069, lng: -157.8583 }, // hawaii (Oahu region)
  { id: 33, lat: 10.8231, lng: 106.6297 }, // hochiminh (Ho Chi Minh)
  { id: 2, lat: 22.3193, lng: 114.1694 }, // hongkong (Hong Kong)
  { id: 186, lat: 41.0082, lng: 28.9784 }, // istanbul (Istanbul)
  { id: 149, lat: 26.9124, lng: 75.7873 }, // jaipur (Jaipur)
  { id: 18, lat: 33.4996, lng: 126.5312 }, // jeju (Jeju region)
  { id: 22, lat: 22.6273, lng: 120.3014 }, // kaohsiung (Kaohsiung)
  { id: 9, lat: 27.7172, lng: 85.324 }, // kathmandu (Kathmandu)
  { id: 49, lat: 3.139, lng: 101.6869 }, // kualalumpur (Kuala Lumpur)
  { id: 30, lat: 35.0116, lng: 135.7681 }, // kyoto (Kyoto)
  { id: 136, lat: 36.1699, lng: -115.1398 }, // lasvegas (Las Vegas)
  { id: 308, lat: 38.7223, lng: -9.1393 }, // lisbon (Lisbon)
  { id: 106, lat: 51.5072, lng: -0.1276 }, // london (London)
  { id: 124, lat: 34.0522, lng: -118.2437 }, // losangeles (Los Angeles)
  { id: 3, lat: 22.1987, lng: 113.5439 }, // macau (Macau)
  { id: 109, lat: 40.4168, lng: -3.7038 }, // madrid (Madrid)
  { id: 527, lat: 4.1755, lng: 73.5093 }, // male (Malé)
  { id: 289, lat: 31.6295, lng: -7.9811 }, // marrakech (Marrakech)
  { id: 69, lat: -37.8136, lng: 144.9631 }, // melbourne (Melbourne)
  { id: 198, lat: 25.7617, lng: -80.1918 }, // miami (Miami)
  { id: 116, lat: 45.4642, lng: 9.19 }, // milan (Milan)
  { id: 132, lat: 19.076, lng: 72.8777 }, // mumbai (Maharashtra region)
  { id: 118, lat: 48.1351, lng: 11.582 }, // munich (Munich)
  { id: 71, lat: 35.1815, lng: 136.9066 }, // nagoya (Nagoya)
  { id: 93, lat: 40.7128, lng: -74.006 }, // newyork (New York)
  { id: 208, lat: 12.2388, lng: 109.1967 }, // nhatrang (Nha Trang)
  { id: 36, lat: 26.2124, lng: 127.6809 }, // okinawa (Kyushu/Okinawa region)
  { id: 29, lat: 34.6937, lng: 135.5023 }, // osaka (Osaka)
  { id: 107, lat: 48.8566, lng: 2.3522 }, // paris (Paris)
  { id: 7, lat: 7.8804, lng: 98.3923 }, // phuket (Phuket)
  { id: 333, lat: 50.0755, lng: 14.4378 }, // prague (Prague)
  { id: 83, lat: -45.0312, lng: 168.6626 }, // queenstown (Queenstown)
  { id: 92, lat: 41.9028, lng: 12.4964 }, // rome (Rome)
  { id: 129, lat: 37.7749, lng: -122.4194 }, // sanfrancisco (San Francisco)
  { id: 32, lat: 43.0618, lng: 141.3545 }, // sapporo (Hokkaido region)
  { id: 13, lat: 37.5665, lng: 126.978 }, // seoul (Seoul)
  { id: 59, lat: 31.2304, lng: 121.4737 }, // shanghai (Shanghai)
  { id: 10, lat: 13.3633, lng: 103.8564 }, // siemreap (Siem Reap)
  { id: 6, lat: 1.3521, lng: 103.8198 }, // singapore (Singapore)
  { id: 140, lat: 59.3293, lng: 18.0686 }, // stockholm (Stockholm)
  { id: 68, lat: -33.8688, lng: 151.2093 }, // sydney (Sydney)
  { id: 19, lat: 25.033, lng: 121.5654 }, // taipei (Taipei)
  { id: 28, lat: 35.6762, lng: 139.6503 }, // tokyo (Tokyo)
  { id: 535, lat: 43.6532, lng: -79.3832 }, // toronto (Toronto)
  { id: 534, lat: 49.2827, lng: -123.1207 }, // vancouver (Vancouver)
  { id: 117, lat: 45.4408, lng: 12.3155 }, // venice (Venice)
  { id: 91, lat: 48.2082, lng: 16.3738 }, // vienna (Vienna)
  { id: 351, lat: 52.2297, lng: 21.0122 }, // warsaw (Warsaw)
  { id: 138, lat: 47.3769, lng: 8.5417 }, // zurich (Zurich)
];

/** 여행 도시 좌표에서 가장 가까운 Klook 도시(너무 멀면 null) */
export function nearestKlookCityId(lat: number, lng: number, maxKm = 150): number | null {
  let best: { id: number; km: number } | null = null;
  for (const c of KLOOK_CITIES) {
    const km = haversineKm(lat, lng, c.lat, c.lng);
    if (km <= maxKm && (!best || km < best.km)) best = { id: c.id, km };
  }
  return best?.id ?? null;
}
