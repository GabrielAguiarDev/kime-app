/**
 * Public env validated at boot. EXPO_PUBLIC_* vars are inlined at build time,
 * so they must be read with static property access.
 */
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`[env] Variável ${name} ausente. Preencha o arquivo .env.`);
  }
  return value;
}

export const env = {
  supabaseUrl: required('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL),
  supabasePublishableKey: required(
    'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ),
} as const;
