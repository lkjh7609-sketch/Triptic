import { afterEach, describe, expect, it } from 'vitest';
import { isNativeApp } from './platform';

type W = { Capacitor?: unknown };
const w = window as unknown as W;

afterEach(() => {
  delete w.Capacitor;
});

describe('isNativeApp — 웹 브라우저를 앱으로 착각하지 않는다', () => {
  it('Capacitor 전역이 없으면 웹', () => {
    expect(isNativeApp()).toBe(false);
  });

  it('웹에서도 @capacitor/core가 만드는 전역(isNativePlatform=false)은 웹', () => {
    w.Capacitor = { isNativePlatform: () => false, getPlatform: () => 'web' };
    expect(isNativeApp()).toBe(false);
  });

  it('앱(isNativePlatform=true)은 앱', () => {
    w.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios' };
    expect(isNativeApp()).toBe(true);
  });

  it('전역에 isNativePlatform 함수가 없으면 웹으로 본다', () => {
    w.Capacitor = {};
    expect(isNativeApp()).toBe(false);
  });
});
