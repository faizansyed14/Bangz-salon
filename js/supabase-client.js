// Supabase Client Configuration
// Credentials are injected at build time via js/supabase-config.js (from env vars).
const config = window.__SUPABASE_CONFIG__ || {};
const SUPABASE_URL = config.url;
const SUPABASE_ANON_KEY = config.anonKey;

// Initialize Supabase client only if not already initialized
if (!window.supabaseClient) {
    try {
        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            throw new Error(
                'Supabase config missing. Run: node scripts/generate-supabase-config.js (local) or deploy via Netlify with SUPABASE_URL and SUPABASE_ANON_KEY set.'
            );
        }

        if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
            window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        } else {
            console.error('Supabase library not loaded. Make sure @supabase/supabase-js is included before this script.');
            alert('Supabase library not found. Please check your script includes.');
        }
    } catch (error) {
        console.error('Error initializing Supabase client:', error);
        alert('Supabase configuration error. Check env vars and rebuild.');
    }
}
