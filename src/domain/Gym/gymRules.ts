/** Student and professor codes: 8 characters without look-alikes (0/O, 1/I/L). */
export const CODE_LENGTH = 8;

const CODE_CHARS = /[^A-HJKMNP-Z2-9]/g;

/**
 * What the user typed or pasted → code characters only, upper case. Letters
 * that never appear in a code are dropped (the server ignores them anyway).
 */
export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(CODE_CHARS, '').slice(0, CODE_LENGTH);
}

export function isCodeComplete(code: string): boolean {
  return normalizeCode(code).length === CODE_LENGTH;
}

/**
 * Whether this account may create an academy. Free for everyone for now;
 * later it will require a subscription. Every "Criar academia" entry point
 * asks this, so the rule changes here (and in create_academy on the server).
 */
export function canCreateAcademy(): boolean {
  return true;
}
