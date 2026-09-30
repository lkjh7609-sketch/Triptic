import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSun, Snowflake, Sun, type LucideIcon } from 'lucide-react';

/** Open-Meteo의 날씨 코드(WMO)를 아이콘 하나로 — 맑음·구름·안개·이슬비·비·눈·천둥. 모르는 코드는 구름 */
export function weatherIcon(code: number | null | undefined): LucideIcon {
  if (code == null) return Cloud;
  if (code === 0) return Sun;
  if (code === 1 || code === 2) return CloudSun;
  if (code === 3) return Cloud;
  if (code === 45 || code === 48) return CloudFog;
  if (code >= 51 && code <= 57) return CloudDrizzle;
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return CloudRain;
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return Snowflake;
  if (code >= 95) return CloudLightning;
  return Cloud;
}
