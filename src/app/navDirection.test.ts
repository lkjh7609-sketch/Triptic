import { describe, expect, it } from 'vitest';
import { navDirection } from './navDirection';

describe('navDirection', () => {
  it('탭끼리 이동은 페이드', () => {
    expect(navDirection('/', '/plan', 'PUSH')).toBe('fade');
    expect(navDirection('/community', '/settings', 'POP')).toBe('fade');
  });

  it('다른 섹션 깊은 화면에서 탭을 누르면 페이드', () => {
    expect(navDirection('/community/post/1', '/plan', 'PUSH')).toBe('fade');
  });

  it('더 깊이 들어가면 forward, 같은 섹션 상위로 나오면 back', () => {
    expect(navDirection('/community', '/community/post/1', 'PUSH')).toBe('forward');
    expect(navDirection('/community/post/1', '/community', 'REPLACE')).toBe('back');
    expect(navDirection('/community/companion/1', '/community/companion/1/chat', 'PUSH')).toBe('forward');
  });

  it('뒤로가기(POP)는 깊이가 얕아지면 back, 앞으로가기로 깊어지면 forward', () => {
    expect(navDirection('/plan/abc', '/plan', 'POP')).toBe('back');
    expect(navDirection('/community/companion/1/chat', '/community/companion/1/match', 'POP')).toBe('back');
    expect(navDirection('/plan', '/plan/abc', 'POP')).toBe('forward');
  });

  it('같은 깊이 옆 화면으로 PUSH하면 forward', () => {
    expect(navDirection('/community/companion/1/chat', '/community/companion/1/match', 'PUSH')).toBe('forward');
  });
});
