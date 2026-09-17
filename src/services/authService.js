// Supabase Auth Service for Triptic
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.3/+esm';

const SUPABASE_URL = 'https://mfwfqfzdgcgfnnmnlrxu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1md2ZxZnpkZ2NnZm5ubW5scnh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzcxNTE2NzAsImV4cCI6MjA1MjcyNzY3MH0.kXP5vVkp4ND0xEU5VXvGQ_qZy2fWJlG4KqYgBqCTkXc';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function signInWithProvider(provider) {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: provider,
        options: {
            redirectTo: window.location.origin
        }
    });

    if (error) {
        console.error('OAuth sign-in error:', error);
        throw error;
    }

    return data;
}

export async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
        console.error('Sign-out error:', error);
        throw error;
    }
}

export async function getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
        console.error('Get user error:', error);
        return null;
    }
    return user;
}

export function onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChanged((event, session) => {
        callback(event, session);
    });
}
