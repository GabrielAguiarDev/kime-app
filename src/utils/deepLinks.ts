import * as Linking from 'expo-linking';

/** Route that receives a code: kimi://entrar?codigo=XXXXXXXX */
export const ENTRY_PATH = 'entrar';

/** Deep link that opens the app on the academy confirmation with the code filled in. */
export function joinCodeUrl(code: string): string {
  return Linking.createURL(ENTRY_PATH, { queryParams: { codigo: code } });
}

/** Message the owner shares: readable without the app (the code is spelled out). */
export function joinCodeMessage(gymName: string, code: string, kind: 'student' | 'professor'): string {
  const who = kind === 'professor' ? 'como professor' : '';
  return [
    `Entre na ${gymName} ${who} pelo app Kimi.`.replace(/\s+/g, ' ').replace(' .', '.'),
    `Código: ${code}`,
    `Já tem o app? Toque para abrir: ${joinCodeUrl(code)}`,
  ].join('\n');
}
