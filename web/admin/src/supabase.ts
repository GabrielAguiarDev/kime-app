import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error('Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (veja .env.example).');

// Only the public key: every admin permission is checked in the database (admin_* RPCs).
// Own storage key: the admin session never mixes with the TV's anonymous one on the same origin.
export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // E-mail + password only: no OAuth redirect to read from the URL.
    detectSessionInUrl: false,
    storageKey: 'kimi-admin-auth',
  },
});

/** The academy-logos bucket is public. */
export const logoUrl = (path: string | null) =>
  path ? supabase.storage.from('academy-logos').getPublicUrl(path).data.publicUrl : null;
