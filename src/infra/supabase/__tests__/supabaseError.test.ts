import { AppError, errorMessage, toAppError } from '../supabaseError';

describe('toAppError', () => {
  it('maps RPC exception messages to codes', () => {
    expect(toAppError({ message: 'invite_invalid', code: 'P0002' }).code).toBe('invite_invalid');
  });

  it('maps auth error codes', () => {
    expect(toAppError({ code: 'invalid_credentials', message: 'x' }).code).toBe('invalid_credentials');
    expect(toAppError({ code: 'user_already_exists' }).code).toBe('email_taken');
  });

  it('maps permission denied to forbidden', () => {
    expect(toAppError({ code: '42501', message: 'permission denied' }).code).toBe('forbidden');
  });

  it('keeps AppError instances and falls back to unknown', () => {
    const err = new AppError('network');
    expect(toAppError(err)).toBe(err);
    expect(toAppError(new Error('boom')).code).toBe('unknown');
  });

  it('returns pt-BR messages', () => {
    expect(errorMessage({ message: 'invite_invalid' })).toMatch(/código/i);
  });
});

test('SMTP failure on sign-up is not reported as a network error', () => {
  const e = Object.assign(new Error('Error sending confirmation email'), { status: 500, code: 'unexpected_failure' });
  expect(toAppError(e).code).toBe('email_send_failed');
});
