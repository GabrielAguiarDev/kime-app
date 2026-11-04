import { authApi } from '../authApi';
import { authService } from '../authService';

// jest.mock calls are hoisted above the imports.
jest.mock('../authApi', () => ({
  authApi: {
    signUp: jest.fn(),
    signIn: jest.fn(),
    resendSignUpCode: jest.fn(),
  },
}));
jest.mock('@domain/Profile', () => ({ profileService: {} }));
jest.mock('@infra/supabase', () => jest.requireActual('../../../infra/supabase/supabaseError'));
jest.mock('expo-apple-authentication', () => ({}));
jest.mock('expo-crypto', () => ({}));


const api = authApi as jest.Mocked<typeof authApi>;
const input = { fullName: 'Ana', email: ' Ana@Kimi.dev ', password: 'segredo123' };
const authError = (code: string, message = code) => Object.assign(new Error(message), { code });

beforeEach(() => jest.resetAllMocks());

test('new account without session needs confirmation', async () => {
  api.signUp.mockResolvedValue({ session: null, user: { identities: [{}] } } as never);
  await expect(authService.signUp(input)).resolves.toBe('needs_confirmation');
  expect(api.signUp).toHaveBeenCalledWith(expect.objectContaining({ email: 'ana@kimi.dev' }));
});

test('existing unconfirmed account with the right password goes back to the code screen', async () => {
  api.signUp.mockRejectedValue(authError('user_already_exists'));
  api.signIn.mockRejectedValue(authError('email_not_confirmed'));
  api.resendSignUpCode.mockResolvedValue();
  await expect(authService.signUp(input)).resolves.toBe('needs_confirmation');
  expect(api.resendSignUpCode).toHaveBeenCalledWith('ana@kimi.dev');
});

test('anti-enumeration placeholder user is treated as an existing account', async () => {
  api.signUp.mockResolvedValue({ session: null, user: { identities: [] } } as never);
  api.signIn.mockRejectedValue(authError('email_not_confirmed'));
  api.resendSignUpCode.mockResolvedValue();
  await expect(authService.signUp(input)).resolves.toBe('needs_confirmation');
});

test('existing confirmed account with the right password just signs in', async () => {
  api.signUp.mockRejectedValue(authError('user_already_exists'));
  api.signIn.mockResolvedValue();
  await expect(authService.signUp(input)).resolves.toBe('signed_in');
});

test('existing account with a wrong password stays "e-mail taken"', async () => {
  api.signUp.mockRejectedValue(authError('user_already_exists'));
  api.signIn.mockRejectedValue(authError('invalid_credentials'));
  await expect(authService.signUp(input)).rejects.toMatchObject({ code: 'email_taken' });
  expect(api.resendSignUpCode).not.toHaveBeenCalled();
});
