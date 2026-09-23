/**
 * 도메인 타입 (03-data-model.md §2)
 * Zod 스키마가 단일 진실 공급원이다. TS 타입은 z.infer로 뽑고,
 * 서버·클라이언트가 같은 스키마로 검증한다 (03-data-model.md §1.5).
 */
import { z } from 'zod';

export const Locale = z.enum(['ko', 'en', 'zh-CN', 'ja']);
export type Locale = z.infer<typeof Locale>;

export const Currency = z.enum([
  'KRW',
  'JPY',
  'USD',
  'EUR',
  'CNY',
  'TWD',
  'THB',
  'VND',
  'GBP',
  'AUD',
]);
export type Currency = z.infer<typeof Currency>;

export const ItemType = z.enum([
  'place', // 관광지·명소
  'meal', // 식사
  'lodging', // 숙소 체크인/아웃
  'transport', // 지상 이동 (기차·버스·렌터카)
  'flight', // 항공
  'activity', // 투어·액티비티
  'note', // 좌표 없는 메모
]);
export type ItemType = z.infer<typeof ItemType>;

export const BookingType = z.enum([
  'flight',
  'lodging',
  'rail',
  'car_rental',
  'activity',
  'restaurant',
  'insurance',
  'other',
]);
export type BookingType = z.infer<typeof BookingType>;

export const GeoPoint = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type GeoPoint = z.infer<typeof GeoPoint>;

export const ItineraryItem = z.object({
  id: z.string().uuid(),
  tripId: z.string().uuid(),
  dayId: z.string().uuid(),
  position: z.number().int().nonnegative(),
  type: ItemType,
  title: z.string().min(1).max(200),
  subtitle: z.string().max(200).nullable(), // "4성급 호텔", "일본라면 전문식당"
  category: z.string().max(64).nullable(), // Places type에서 추론
  googlePlaceId: z.string().nullable(),
  location: GeoPoint.nullable(), // note 타입만 null 허용
  address: z.string().nullable(),
  countryCode: z.string().length(2).nullable(),
  /** 현지 시각 — 사용자에게 보여주는 값 */
  startLocal: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    .nullable(),
  endLocal: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    .nullable(),
  /** IANA 타임존. 예: 'Asia/Tokyo' */
  timezone: z.string().nullable(),
  /** 정렬·알림용 절대 시각 (startLocal + timezone에서 파생) */
  startAt: z.string().datetime().nullable(),
  memo: z.string().max(1000).nullable(),
  estimatedCost: z.number().nonnegative().nullable(),
  bookingId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ItineraryItem = z.infer<typeof ItineraryItem>;

export const Leg = z.object({
  id: z.string().uuid(),
  tripId: z.string().uuid(),
  fromItemId: z.string().uuid(),
  toItemId: z.string().uuid(),
  mode: z.enum(['transit', 'driving', 'walking', 'bicycling', 'flight', 'unknown']),
  distanceM: z.number().int().nonnegative().nullable(),
  durationS: z.number().int().nonnegative().nullable(),
  /** 실패 시 Haversine 직선거리를 쓰고 이 값을 true로 둔다 → UI에 '≈' 표시 */
  isEstimate: z.boolean(),
  encodedPolyline: z.string().nullable(),
  provider: z.enum(['google_directions', 'haversine']),
  fetchedAt: z.string().datetime(),
});
export type Leg = z.infer<typeof Leg>;

export const Trip = z.object({
  id: z.string().uuid(),
  ownerId: z.string().uuid(),
  title: z.string().min(1).max(100),
  coverUrl: z.string().nullable(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  baseCurrency: Currency,
  status: z.enum(['planning', 'ongoing', 'completed', 'archived']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
});
export type Trip = z.infer<typeof Trip>;

export const TripDay = z.object({
  id: z.string().uuid(),
  tripId: z.string().uuid(),
  dayIndex: z.number().int().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  cityName: z.string().nullable(),
  cityLat: z.number().nullable(),
  cityLng: z.number().nullable(),
  timezone: z.string().nullable(),
  note: z.string().nullable(),
});
export type TripDay = z.infer<typeof TripDay>;

export const Profile = z.object({
  id: z.string().uuid(),
  handle: z
    .string()
    .regex(/^[a-z0-9_]{3,20}$/)
    .nullable(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  bio: z.string().max(200).nullable(),
  locale: Locale,
  tempUnit: z.enum(['c', 'f']),
  distanceUnit: z.enum(['km', 'mi']),
  baseCurrency: Currency,
  homeCountry: z.string().length(2).nullable(),
  statsPublic: z.boolean(),
  deletionRequestedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Profile = z.infer<typeof Profile>;
