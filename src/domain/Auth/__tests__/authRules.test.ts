import { isValidEmail, isValidPassword, normalizeEmail, isValidOtp } from '../authRules';

describe('authRules', () => {
  it('validates e-mail', () => {
    expect(isValidEmail(' ana@kimi.app ')).toBe(true);
    expect(isValidEmail('ana@kimi')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });

  it('requires 8+ char passwords (matches Supabase config)', () => {
    expect(isValidPassword('1234567')).toBe(false);
    expect(isValidPassword('12345678')).toBe(true);
  });

  it('normalizes e-mail', () => {
    expect(normalizeEmail('  Ana@Kimi.App ')).toBe('ana@kimi.app');
  });
});

describe('isValidOtp', () => {
  it('accepts exactly 6 digits', () => {
    expect(isValidOtp(' 123456 ')).toBe(true);
    expect(isValidOtp('12345')).toBe(false);
    expect(isValidOtp('1234567')).toBe(false);
    expect(isValidOtp('12a456')).toBe(false);
  });
});
