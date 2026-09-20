/**
 * 항공편 조회 API 호출 (index.html에서 이식 — ADR-001)
 * 원본: index.html flightApiUrl/fetchAirportCoords/lookupFlight
 * (2026-09-20 기준 라인 6157~6227). /api/flight는 aviationstack을 프록시하는
 * Vercel 서버리스 함수(api/flight.js)로, 이번 이식에서 손대지 않았다.
 */
import { extractLocalTime } from './flights';
import type { FlightInfo } from './types';

function flightApiUrl(): string {
  const isNativeApp = window.location.protocol === 'capacitor:' || window.location.hostname === 'localhost';
  return isNativeApp ? 'https://triptic-ten.vercel.app/api/flight' : '/api/flight';
}

interface AirportCoords {
  name: string;
  lat: number | null;
  lng: number | null;
}

export async function fetchAirportCoords(iataCode: string | undefined): Promise<AirportCoords | null> {
  if (!iataCode) return null;
  try {
    const url = `${flightApiUrl()}?type=airport&iata=${encodeURIComponent(iataCode)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const a = json.data && json.data[0];
    if (!a) return null;
    return {
      name: a.airport_name || iataCode,
      lat: a.latitude != null ? Number(a.latitude) : null,
      lng: a.longitude != null ? Number(a.longitude) : null,
    };
  } catch {
    return null;
  }
}

export async function lookupFlight(flightNo: string, dateStr: string): Promise<FlightInfo | null> {
  if (!flightNo || !dateStr) return null;

  try {
    const url = `${flightApiUrl()}?type=flight&flightNo=${encodeURIComponent(flightNo.trim())}&date=${encodeURIComponent(dateStr)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    if (json.error || !Array.isArray(json.data) || json.data.length === 0) return null;

    const f = json.data[0];
    const dep = f.departure || {};
    const arr = f.arrival || {};

    const [depCoords, arrCoords] = await Promise.all([
      fetchAirportCoords(dep.iata),
      fetchAirportCoords(arr.iata),
    ]);

    return {
      flightNo: flightNo.trim().toUpperCase(),
      date: dateStr,
      dep: {
        iata: dep.iata || '',
        name: (depCoords && depCoords.name) || dep.airport || dep.iata || '',
        lat: depCoords ? depCoords.lat : null,
        lng: depCoords ? depCoords.lng : null,
        time: extractLocalTime(dep.scheduled),
      },
      arr: {
        iata: arr.iata || '',
        name: (arrCoords && arrCoords.name) || arr.airport || arr.iata || '',
        lat: arrCoords ? arrCoords.lat : null,
        lng: arrCoords ? arrCoords.lng : null,
        time: extractLocalTime(arr.scheduled),
      },
    };
  } catch {
    return null;
  }
}
