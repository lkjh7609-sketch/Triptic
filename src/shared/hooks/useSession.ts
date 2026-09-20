import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getCurrentUser, onAuthStateChange } from '@/shared/api/authService';

interface SessionState {
  user: User | null;
  loading: boolean;
}

/** 현재 로그인 사용자를 구독한다. 비로그인 상태에서도 앱은 정상 동작해야 한다 (샘플 여행 둘러보기 등). */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ user: null, loading: true });

  useEffect(() => {
    let mounted = true;

    getCurrentUser().then((user) => {
      if (mounted) setState({ user, loading: false });
    });

    const sub = onAuthStateChange((_event, session) => {
      if (mounted) setState({ user: session?.user ?? null, loading: false });
    });

    return () => {
      mounted = false;
      sub.unsubscribe();
    };
  }, []);

  return state;
}
