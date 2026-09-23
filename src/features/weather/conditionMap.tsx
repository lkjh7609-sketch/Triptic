/**
 * WeatherKit 기상 코드 매핑 (05-weather.md §4)
 * WeatherKit의 conditionCode는 40종이 넘지만 UI에서는 9종으로 압축한다.
 * 매핑 테이블은 이 파일 한 곳에만 둔다.
 */
import { captureError } from '@/shared/monitoring';

export type InternalConditionCode =
  | 'clear'
  | 'partly_cloudy'
  | 'cloudy'
  | 'fog'
  | 'rain'
  | 'thunderstorm'
  | 'snow'
  | 'wind'
  | 'unknown';

/** Apple WeatherKit REST가 실제로 내려주는 conditionCode 전체 목록 기준 매핑 */
const WEATHERKIT_CONDITION_MAP: Record<string, InternalConditionCode> = {
  Clear: 'clear',
  MostlyClear: 'clear',
  Hot: 'clear',
  PartlyCloudy: 'partly_cloudy',
  Cloudy: 'cloudy',
  MostlyCloudy: 'cloudy',
  Frigid: 'cloudy',
  Foggy: 'fog',
  Haze: 'fog',
  Smoky: 'fog',
  BlowingDust: 'fog',
  Drizzle: 'rain',
  FreezingDrizzle: 'rain',
  FreezingRain: 'rain',
  HeavyRain: 'rain',
  Rain: 'rain',
  Showers: 'rain',
  ScatteredShowers: 'rain',
  SunShowers: 'rain',
  Hail: 'rain',
  Hurricane: 'thunderstorm',
  IsolatedThunderstorms: 'thunderstorm',
  ScatteredThunderstorms: 'thunderstorm',
  SevereThunderstorm: 'thunderstorm',
  Thunderstorm: 'thunderstorm',
  Tornado: 'thunderstorm',
  TropicalStorm: 'thunderstorm',
  Blizzard: 'snow',
  BlowingSnow: 'snow',
  Flurries: 'snow',
  HeavySnow: 'snow',
  MixedRainAndSleet: 'snow',
  MixedRainAndSnow: 'snow',
  MixedRainfall: 'snow',
  MixedSnowAndSleet: 'snow',
  ScatteredSnowShowers: 'snow',
  Sleet: 'snow',
  Snow: 'snow',
  SnowShowers: 'snow',
  WintryMix: 'snow',
  Breezy: 'wind',
  Windy: 'wind',
};

const ICONS_DAY: Record<InternalConditionCode, ReactNode> = {
  clear: <Sun size={16} />,
  partly_cloudy: <CloudSun size={16} />,
  cloudy: <Cloud size={16} />,
  fog: <CloudFog size={16} />,
  rain: <CloudRain size={16} />,
  thunderstorm: <CloudLightning size={16} />,
  snow: <Snowflake size={16} />,
  wind: <Wind size={16} />,
  unknown: <Sun size={16} />, // fallback
};

const ICONS_NIGHT: Record<InternalConditionCode, ReactNode> = {
  ...ICONS_DAY,
  clear: <Moon size={16} />,
  partly_cloudy: <CloudMoon size={16} />,
};

/** 매핑 없는 코드는 unknown으로 처리하고 Sentry에 경고를 보낸다(Apple이 코드를 추가할 수 있다) */
export function mapConditionCode(rawCode: string): InternalConditionCode {
  const mapped = WEATHERKIT_CONDITION_MAP[rawCode];
  if (mapped) return mapped;
  captureError(new Error(`Unmapped WeatherKit conditionCode: ${rawCode}`), {
    context: 'weather_condition_map',
    rawCode,
  });
  return 'unknown';
}

/** 야간(isDaylight=false)에는 달 아이콘 변형을 쓴다 (§4 "☀️→🌙, 🌤→☁️🌙") */
import { ReactNode } from 'react';
import { Sun, CloudSun, Cloud, CloudFog, CloudRain, CloudLightning, Snowflake, Wind, Moon, CloudMoon } from 'lucide-react';

export function weatherIcon(code: InternalConditionCode, isDaylight: boolean): ReactNode {
  return isDaylight ? ICONS_DAY[code] : ICONS_NIGHT[code];
}
