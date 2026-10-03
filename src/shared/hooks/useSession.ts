import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getCurrentUser, onAuthStateChange, readStoredSessionUser } from '@/shared/api/authService';

interface SessionState {
  user: User | null;
  loading: boolean;
}

/** 저장된 로그인이 없는데 로그인 확인(OAuth 코드 교환 등)이 이보다 오래 걸리면 비로그인으로 먼저 그린다 */
export const SESSION_WAIT_LIMIT_MS = 3000;

/** 현재 로그인 사용자를 구독한다. 비로그인 상태에서도 앱은 정상 동작해야 한다 (샘플 여행 둘러보기 등). */
export function useSession(): SessionState {
  // 이 기기에 저장된 로그인이 있으면 그 사용자로 바로 그린다. 세션이 만료됐으면 갱신은 뒤에서 이어지고 끝나면
  // onAuthStateChange가 맞춘다(갱신 실패로 로그아웃되면 SIGNED_OUT → 비로그인 화면). 예전엔 갱신 요청이 끝날 때까지
  // 셸 전체가 스켈레톤이라, 요청이 멈추면 흰 화면에서 새로고침 전까지 못 벗어났다(2026-10-04)
  const [state, setState] = useState<SessionState>(() => {
    const stored = readStoredSessionUser();
    return stored ? { user: stored, loading: false } : { user: null, loading: true };
  });

  useEffect(() => {
    let mounted = true;

    getCurrentUser().then((user) => {
      if (mounted) setState({ user, loading: false });
    });

    const sub = onAuthStateChange((_event, session) => {
      if (mounted) setState({ user: session?.user ?? null, loading: false });
    });

    const timer = window.setTimeout(() => {
      if (mounted) setState((prev) => (prev.loading ? { user: null, loading: false } : prev));
    }, SESSION_WAIT_LIMIT_MS);

    return () => {
      mounted = false;
      window.clearTimeout(timer);
      sub.unsubscribe();
    };
  }, []);

  return state;
}
