import { Alert } from 'react-native';

import { TextButton } from '@components';
import { useSignOut } from '@domain/Auth';
import { errorMessage } from '@infra';
import { SIGN_OUT_CONFIRM, useConfirm } from '@services/confirm';

/**
 * Bottom of the signed-in screens without an academy (choice, code, waiting):
 * "Sair da conta" (ghost, with confirmation). Who is signed in shows on top
 * (AccountHeader). Signing out clears the user's local data (SessionProvider)
 * and the guard goes back to the first screen.
 */
export function SignedInFooter() {
  const signOut = useSignOut();
  const confirm = useConfirm();
  return (
    <>
      <TextButton
        title="Sair da conta"
        color="danger"
        disabled={signOut.isPending}
        onPress={async () => {
          if (await confirm(SIGN_OUT_CONFIRM)) {
            signOut.mutate(undefined, { onError: (e) => Alert.alert('Sair', errorMessage(e)) });
          }
        }}
      />
    </>
  );
}
