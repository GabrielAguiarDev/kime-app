/**
 * DEV ONLY — fixed test accounts created by supabase/seed.sql (local DB).
 * Only referenced behind `__DEV__`, so production bundles drop it.
 */
export const DEV_PASSWORD = 'kimi12345';

export const devAccounts = [
  { label: 'Entrar como aluno', email: 'aluno@kimi.dev', icon: 'person-outline' },
  { label: 'Entrar como professor', email: 'professor@kimi.dev', icon: 'ribbon-outline' },
] as const;
