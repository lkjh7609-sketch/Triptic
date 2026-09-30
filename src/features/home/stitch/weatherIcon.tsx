import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSun, Snowflake, Sun } from 'lucide-react';

/** Open-Meteo의 날씨 코드(WMO)를 아이콘으로 — 맑음·구름·안개·이슬비·비·눈·천둥. 코드가 없거나 모르면 구름 */
export function WeatherIcon({ code, size = 14 }: { code: number | null | undefined; size?: number }) {
  const props = { size, 'aria-hidden': true as const };
  if (code == null) return <Cloud {...props} />;
  if (code === 0) return <Sun {...props} />;
  if (code === 1 || code === 2) return <CloudSun {...props} />;
  if (code === 3) return <Cloud {...props} />;
  if (code === 45 || code === 48) return <CloudFog {...props} />;
  if (code >= 51 && code <= 57) return <CloudDrizzle {...props} />;
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return <CloudRain {...props} />;
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return <Snowflake {...props} />;
  if (code >= 95) return <CloudLightning {...props} />;
  return <Cloud {...props} />;
}
