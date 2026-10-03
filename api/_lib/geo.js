/**
 * 접속 국가 — 요청 헤더에서 읽는다(IP 자체는 쓰지 않는다).
 *
 * triptic.my는 Cloudflare 프록시 뒤에 있어서, Vercel이 붙이는 x-vercel-ip-country는 사용자가 아니라
 * Cloudflare 서버 위치(홍콩·도쿄 등)가 된다 — 한국에서 처음 들어온 사람이 번체·일본어 화면을 받던 원인(2026-10-04).
 * 그래서 Cloudflare가 실제 접속 IP로 정해 주는 cf-ipcountry를 먼저 보고, 없으면(프록시를 끄거나 Vercel 주소로 직접 접속)
 * x-vercel-ip-country를 쓴다. Cloudflare는 모르는 곳을 XX, Tor를 T1로 준다 — 둘 다 국가가 아니라 버린다.
 */
const COUNTRY = /^[A-Z]{2}$/;

function pick(headers, name) {
  const raw = headers?.[name];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string') return null;
  const code = value.trim().toUpperCase();
  return COUNTRY.test(code) && code !== 'XX' ? code : null;
}

export function countryFromHeaders(headers) {
  return pick(headers, 'cf-ipcountry') ?? pick(headers, 'x-vercel-ip-country');
}
