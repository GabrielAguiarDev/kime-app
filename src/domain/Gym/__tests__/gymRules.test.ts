import { CODE_LENGTH, isCodeComplete, normalizeCode } from '../gymRules';

describe('normalizeCode', () => {
  it('upper-cases and drops spaces, dashes and other symbols', () => {
    expect(normalizeCode(' kmjj-2526 ')).toBe('KMJJ2526');
  });
  it('drops look-alikes that never appear in a code (0/O, 1/I/L)', () => {
    expect(normalizeCode('O0I1Labc')).toBe('ABC');
  });
  it('keeps at most 8 characters (pasted text with extra words)', () => {
    expect(normalizeCode('KMJJ2526 obrigado')).toHaveLength(CODE_LENGTH);
  });
});

describe('isCodeComplete', () => {
  it('needs 8 code characters', () => {
    expect(isCodeComplete('KMJJ252')).toBe(false);
    expect(isCodeComplete('kmjj 2526')).toBe(true);
  });
});
