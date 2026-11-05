import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator } from 'react-native';

import { Box, Button, Card, EmptyState, FeedbackSheet, Icon, Mascot, Screen, Text, type IconName } from '@components';
import { canCreateAcademy } from '@domain/Gym';
import { useActiveGym } from '@services/activeGym';
import { useIsConsumingCode } from '@services/entry';
import { useJoinRequestNotices } from '@services/joinRequests';
import { useSession } from '@services/session';

import { EnterCode } from '../entry/EnterCodeScreen';
import { AccountHeader } from './AccountHeader';
import { SignedInFooter } from './SignedInFooter';

/**
 * /academia — signed in, no approved membership and no pending request
 * (after sign-in, sign-up, reopening the app, a cancelled or rejected
 * request). It is the home of that state: no back button on the choice.
 *  - "Como você quer usar o Kimi?": join an academy (the invite-code screen,
 *    student or professor code alike) or register one (/create-gym).
 *  - The code screen is its own route (/codigo-academia), pushed like
 *    /create-gym, without the account row (user decision). Sending a request moves the guard to /aguardando.
 * Someone who confirmed a code before signing up skips all this: the request
 * is sent right after sign-in (spinner) and the guard goes to /aguardando.
 * A rejection shows once, as a notice over this screen.
 */
export function NoAcademyScreen() {
  const { userId } = useSession();
  const { memberships, isLoading, isError, refetch } = useActiveGym();
  const consumingCode = useIsConsumingCode();
  const { notice, dismissAll } = useJoinRequestNotices(userId, memberships);

  // Right after sign-in: memberships still loading or the saved code being sent.
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
      <Screen scrollable={false} footer={<SignedInFooter />}>
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

  const rejection = notice ? (
    <FeedbackSheet
      tone="danger"
      icon="rejected"
      title="Seu pedido não foi aceito."
      message={`${notice.gymName ? `A ${notice.gymName}` : 'A academia'} recusou o pedido de entrada. Confira o código e tente de novo.`}
      actionLabel="Entendi"
      onAction={dismissAll}
    />
  ) : undefined;

  // Pushed like /create-gym: same native transition and swipe back.
  return <Choice onJoin={() => router.push('/codigo-academia')} notice={rejection} />;
}

/**
 * /codigo-academia — invite code (student or professor), signed in without any
 * academy. Pushed over the choice screen; sending the request moves the guard
 * to /aguardando.
 */
export function NoAcademyCodeScreen() {
  return <EnterCode home={{ onBack: () => router.back() }} />;
}

function Choice({ onJoin, notice }: { onJoin: () => void; notice?: ReactNode }) {
  return (
    <Screen header={<AccountHeader />} feedback={notice} footer={<SignedInFooter />}>
      <Box gap="s24">
        <Box alignItems="center" gap="s16">
          <Mascot size="empty" />
          <Text variant="title" textAlign="center" accessibilityRole="header">
            Como você quer usar o Kimi?
          </Text>
        </Box>
        <Box gap="cardGap">
          <ChoiceCard icon="users" title="Entrar em uma academia" description="Tenho o código da minha academia" onPress={onJoin} />
          {canCreateAcademy() ? (
            <ChoiceCard
              icon="owner"
              title="Cadastrar minha academia"
              description="Sou dono ou professor e quero usar o Kimi"
              // TODO(motion): transition into the sign-up flow.
              onPress={() => router.push('/create-gym')}
            />
          ) : null}
        </Box>
      </Box>
    </Screen>
  );
}

/** Big selection card (3.2, tappable): icon, title and one line. */
function ChoiceCard({ icon, title, description, onPress }: { icon: IconName; title: string; description: string; onPress: () => void }) {
  return (
    <Card onPress={onPress} accessibilityLabel={`${title}. ${description}`} flexDirection="row" alignItems="center" gap="s16" paddingVertical="s24">
      <Icon name={icon} color="accent" active />
      <Box flex={1} gap="s4">
        <Text variant="heading">{title}</Text>
        <Text variant="body" color="textMuted">
          {description}
        </Text>
      </Box>
      <Icon name="chevronRight" color="textMuted" />
    </Card>
  );
}
