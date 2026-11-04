import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Alert } from 'react-native';

import { AcademyLogo, Box, Button, Card, EmptyState, Mascot, Screen, StatusBadge, Text, TextButton } from '@components';
import { useSignOut } from '@domain/Auth';
import { canCreateAcademy } from '@domain/Gym';
import type { Membership } from '@domain/Membership';
import { errorMessage } from '@infra';
import { useActiveGym } from '@services/activeGym';
import { SIGN_OUT_CONFIRM, useConfirm } from '@services/confirm';
import { entryPath, useIsConsumingCode } from '@services/entry';

/** While waiting, check the request every so often (and on every return to the app). */
const WAITING_REFRESH_MS = 15_000;

/**
 * Signed in without an active academy. What shows comes from the memberships:
 *  - a pending request → waiting screen (refreshes by itself; approval flips
 *    the root guard to the tabs);
 *  - only a rejected one → notice + type another code;
 *  - nothing → professor options (create academy / professor code), or the
 *    academy code for someone who came in as a student.
 */
export function WelcomeScreen() {
  const { memberships, pending, isError, refetch, isLoading } = useActiveGym();
  const consumingCode = useIsConsumingCode();

  // Right after sign-in: memberships still loading or the saved code is being sent.
  if (isLoading || consumingCode) {
    return (
      <Screen scrollable={false}>
        <Box flex={1} alignItems="center" justifyContent="center">
          <ActivityIndicator accessibilityLabel="Carregando" />
        </Box>
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen scrollable={false} footer={<SignOutButton />}>
        <Box flex={1} justifyContent="center">
          <EmptyState
            title="Não foi possível carregar suas academias"
            description="Verifique sua conexão."
            action={<Button title="Tentar de novo" variant="secondary" onPress={refetch} />}
          />
        </Box>
      </Screen>
    );
  }

  if (pending.length > 0) return <Waiting pending={pending} />;
  if (memberships.some((m) => m.status === 'rejected')) return <Rejected />;
  return <NoAcademy />;
}

function Waiting({ pending }: { pending: Membership[] }) {
  const { refetch } = useActiveGym();
  const [first, ...others] = pending;

  useEffect(() => {
    const id = setInterval(refetch, WAITING_REFRESH_MS);
    return () => clearInterval(id);
  }, [refetch]);

  if (!first) return null;
  const approver = first.role === 'student' ? 'do professor' : 'do proprietário';

  return (
    <Screen scrollable={false} footer={<SignOutButton />}>
      <Box flex={1} justifyContent="center" alignItems="center" gap="s16">
        <AcademyLogo name={first.gymName} url={first.gymLogoUrl} />
        <Text variant="title" textAlign="center">
          {first.gymName}
        </Text>
        <Mascot size="empty" />
        <Text variant="body" color="textMuted" textAlign="center">
          Pedido enviado. Aguardando aprovação {approver}.
        </Text>
        {others.map((m) => (
          <Card key={m.id} flexDirection="row" alignItems="center" gap="s12" alignSelf="stretch">
            <AcademyLogo name={m.gymName} url={m.gymLogoUrl} size="small" />
            <Text variant="bodyStrong" flex={1}>
              {m.gymName}
            </Text>
            <StatusBadge status="pending" />
          </Card>
        ))}
      </Box>
    </Screen>
  );
}

function Rejected() {
  return (
    <Screen
      scrollable={false}
      footer={
        <>
          <Button title="Digitar outro código" onPress={() => router.push('/entrar')} />
          {entryPath.get() === 'professor' && canCreateAcademy() ? (
            <TextButton title="Criar academia" onPress={() => router.push('/create-gym')} />
          ) : null}
          <SignOutButton />
        </>
      }
    >
      <Box flex={1} justifyContent="center">
        <EmptyState
          title="Seu pedido não foi aceito."
          description="A academia recusou o pedido de entrada. Confira o código com seu professor ou digite outro."
        />
      </Box>
    </Screen>
  );
}

function NoAcademy() {
  // The first-screen choice only orders the options; it is not a role.
  const asProfessor = entryPath.get() === 'professor';
  const create = canCreateAcademy();

  const footer = asProfessor ? (
    <>
      {create ? <Button title="Criar academia" onPress={() => router.push('/create-gym')} /> : null}
      <Button
        title="Tenho um código de professor"
        variant={create ? 'secondary' : 'primary'}
        onPress={() => router.push({ pathname: '/entrar', params: { path: 'professor' } })}
      />
      <SignOutButton />
    </>
  ) : (
    <>
      <Button
        title="Digitar código da academia"
        onPress={() => router.push({ pathname: '/entrar', params: { path: 'student' } })}
      />
      {create ? <TextButton title="Quero cadastrar minha academia" onPress={() => router.push('/create-gym')} /> : null}
      <SignOutButton />
    </>
  );

  return (
    <Screen scrollable={false} footer={footer}>
      <Box flex={1} justifyContent="center" gap="s12">
        <Mascot size="hero" />
        <Text variant="title">Bem-vindo ao Kimi</Text>
        <Text variant="body" color="textMuted">
          {asProfessor
            ? 'Cadastre sua academia ou entre numa academia com o código de professor que o proprietário te enviou.'
            : 'Você ainda não está em nenhuma academia. Digite o código que seu professor te passou.'}
        </Text>
      </Box>
    </Screen>
  );
}

function SignOutButton() {
  const signOut = useSignOut();
  const confirm = useConfirm();
  return (
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
  );
}
