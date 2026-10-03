import { describe, expect, it } from 'vitest';
import { countryFromHeaders } from './geo.js';

describe('countryFromHeaders', () => {
  it('Cloudflare 헤더(실제 접속 국가)를 Vercel 헤더(Cloudflare 서버 위치)보다 먼저 본다', () => {
    expect(countryFromHeaders({ 'cf-ipcountry': 'KR', 'x-vercel-ip-country': 'HK' })).toBe('KR');
  });

  it('Cloudflare 헤더가 없으면 Vercel 헤더를 쓴다', () => {
    expect(countryFromHeaders({ 'x-vercel-ip-country': 'JP' })).toBe('JP');
  });

  it('Cloudflare의 모름(XX)·Tor(T1)는 국가가 아니라 Vercel 헤더로 넘어간다', () => {
    expect(countryFromHeaders({ 'cf-ipcountry': 'XX', 'x-vercel-ip-country': 'KR' })).toBe('KR');
    expect(countryFromHeaders({ 'cf-ipcountry': 'T1' })).toBeNull();
  });

  it('소문자·공백은 맞춰 읽고, 형식이 다르면 버린다', () => {
    expect(countryFromHeaders({ 'cf-ipcountry': ' kr ' })).toBe('KR');
    expect(countryFromHeaders({ 'cf-ipcountry': 'KOR' })).toBeNull();
    expect(countryFromHeaders({})).toBeNull();
    expect(countryFromHeaders(undefined)).toBeNull();
  });
});
