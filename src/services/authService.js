// Supabase Auth Service for Triptic
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.3/+esm';

const DEFAULT_SUPABASE_URL = 'https://mfwfqfzdgcgfnnmnlrxu.supabase.co';
const DEFAULT_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1md2ZxZnpkZ2NnZm5ubW5scnh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzcxNTE2NzAsImV4cCI6MjA1MjcyNzY3MH0.kXP5vVkp4ND0xEU5VXvGQ_qZy2fWJlG4KqYgBqCTkXc';

const SUPABASE_URL = (typeof window !== 'undefined' && window.ENV?.SUPABASE_URL) || DEFAULT_SUPABASE_URL;
const SUPABASE_ANON_KEY = (typeof window !== 'undefined' && window.ENV?.SUPABASE_ANON_KEY) || DEFAULT_ANON_KEY;

export const supabase = (typeof window !== 'undefined' && window.supabaseClient) || createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function signInWithProvider(provider) {
    const client = (typeof window !== 'undefined' && window.supabaseClient) || supabase;
    const redirectUrl = typeof window !== 'undefined' ? window.location.origin : '';

    let result;
    if (provider === 'naver') {
        try {
            result = await client.auth.signInWithOAuth({
                provider: 'naver',
                options: { redirectTo: redirectUrl }
            });
        } catch (e) {
            result = await client.auth.signInWithOAuth({
                provider: 'custom:naver',
                options: { redirectTo: redirectUrl }
            });
        }
    } else {
        result = await client.auth.signInWithOAuth({
            provider: provider,
            options: { redirectTo: redirectUrl }
        });
    }

    if (result?.error) {
        if (provider === 'naver') {
            const customResult = await client.auth.signInWithOAuth({
                provider: 'custom:naver',
                options: { redirectTo: redirectUrl }
            });
            if (customResult?.error) throw customResult.error;
            return customResult.data;
        }
        throw result.error;
    }

    return result.data;
}

export async function signOut() {
    const client = (typeof window !== 'undefined' && window.supabaseClient) || supabase;
    const { error } = await client.auth.signOut();
    if (error) {
        console.error('Sign-out error:', error);
        throw error;
    }
}

export async function getCurrentUser() {
    const client = (typeof window !== 'undefined' && window.supabaseClient) || supabase;
    const { data: { user }, error } = await client.auth.getUser();
    if (error) {
        console.error('Get user error:', error);
        return null;
    }
    return user;
}

export function onAuthStateChange(callback) {
    const client = (typeof window !== 'undefined' && window.supabaseClient) || supabase;
    return client.auth.onAuthStateChanged((event, session) => {
        callback(event, session);
    });
}
