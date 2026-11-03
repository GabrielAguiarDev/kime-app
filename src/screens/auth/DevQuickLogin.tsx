import { Box, Button, Text } from '@components';
import { useSignIn } from '@domain/Auth';
import { errorMessage } from '@infra';
import { DEV_PASSWORD, devAccounts } from '@dev/devAccounts';

/**
 * DEV ONLY quick login for the seeded test accounts (same gym).
 * Rendered behind `__DEV__` in SignInScreen.
 */
export function DevQuickLogin() {
  const { mutate, isPending, variables, error } = useSignIn();

  return (
    <Box gap="s8" borderTopWidth={1} borderColor="border" paddingTop="s16">
      <Text variant="label">Atalhos de teste</Text>
      {devAccounts.map((account) => (
        <Button
          key={account.email}
          title={account.label}
          icon={account.icon}
          variant="secondary"
          disabled={isPending && variables?.email !== account.email}
          loading={isPending && variables?.email === account.email}
          onPress={() => mutate({ email: account.email, password: DEV_PASSWORD })}
        />
      ))}
      {error ? (
        <Text variant="caption" color="danger">
          {errorMessage(error)} Rode `npm run db:reset` para recriar as contas de teste.
        </Text>
      ) : null}
    </Box>
  );
}
