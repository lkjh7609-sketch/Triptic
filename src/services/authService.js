// Supabase Auth Service for Triptic
import { getSupabaseClient } from './supabaseClient.js';

export async function signInWithProvider(provider) {
    const client = await getSupabaseClient();
    const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const isNativeApp = typeof window !== 'undefined' && (window.location.protocol === 'capacitor:' || typeof window.Capacitor !== 'undefined');
    // Vercel Preview URL의 Deployment Protection(SSO 로그인) 우회를 위해 프로덕션 도메인 우선 적용
    const redirectUrl = (isLocal && !isNativeApp) ? window.location.origin : 'https://triptic-ten.vercel.app';

    const result = await client.auth.signInWithOAuth({
        provider: provider,
        options: { redirectTo: redirectUrl }
    });

    if (result?.error) {
        throw result.error;
    }

    return result.data;
}

export async function signOut() {
    const client = await getSupabaseClient();
    const { error } = await client.auth.signOut();
    if (error) {
        console.error('Sign-out error:', error);
        throw error;
    }
}

export async function getCurrentUser() {
    const client = await getSupabaseClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error) {
        console.error('Get user error:', error);
        return null;
    }
    return user;
}

export function onAuthStateChange(callback) {
    // Supabase 클라이언트 로딩이 비동기이므로, 준비되는 즉시 구독을 건다.
    // 구독 해제 함수도 준비 완료 후에만 유효하므로 래핑해서 반환한다.
    let subscription = null;
    let unsubscribed = false;

    getSupabaseClient().then((client) => {
        if (unsubscribed) return;
        const { data } = client.auth.onAuthStateChange((event, session) => {
            callback(event, session);
        });
        subscription = data?.subscription;
    });

    return {
        unsubscribe() {
            unsubscribed = true;
            subscription?.unsubscribe();
        }
    };
}
