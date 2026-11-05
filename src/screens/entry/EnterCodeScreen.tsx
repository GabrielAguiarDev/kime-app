import { router, useLocalSearchParams, usePathname } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, BackHandler } from 'react-native';

import { Box, Button, CodeField, FeedbackSheet, Screen, Text, TextButton } from '@components';
import { canCreateAcademy, CODE_LENGTH, normalizeCode, useCodeLookup, useJoinWithCode } from '@domain/Gym';
import { errorMessage } from '@infra';
import { useActiveGym } from '@services/activeGym';
import { entryPath, joinOutcome, joinOutcomeText, pendingCode, type JoinOutcome } from '@services/entry';
import { useSession } from '@services/session';
import { haptics } from '@utils/haptics';

import { SignedInFooter } from '../onboarding/SignedInFooter';
import { AcademyCard } from './AcademyCard';
import { backToStart } from './StartScreen';

/**
 * "Código de convite" — ONE screen for every invite code: the lookup tells the
 * academy and the kind of the code (student or professor), and the
 * confirmation card says "Você vai entrar como aluno / professor".
 *
 * Routes that render it:
 *  - /codigo (inside (auth)): signed out ("Sou aluno" and "Sou professor"), so
 *    the whole flow lives in one stack (the guard drops it after sign-in);
 *  - /entrar (outside the guards): signed in with an academy ("Entrar em outra
 *    academia") and every deep link;
 *  - /codigo-academia: signed in without any academy (`home` mode): back to the
 *    choice screen and "Sair da conta" instead of "Já tenho conta? Entrar".
 *
 * The code flow:
 *   1. code (big field, upper case);
 *   2. "É essa a sua academia?" with logo, name and the role.
 * Signed out, "Sim" saves the code and goes to sign-up; the request is sent
 * right after (useConsumePendingCode). Signed in, it is sent here.
 * Deep link kimi://entrar?codigo=XXXXXXXX opens straight on step 2.
 */
export function EnterCodeScreen() {
  const params = useLocalSearchParams<{ codigo?: string }>();
  // A new deep link while this screen is open starts the flow over.
  return <EnterCode key={params.codigo ?? ''} initialCode={params.codigo} />;
}

/** Signed in without any academy (/codigo-academia). */
export interface EnterCodeHome {
  /** Back from the code step: to the choice screen. */
  onBack?: () => void;
  /** Feedback sheet over the code step (e.g. "Seu pedido não foi aceito"). */
  notice?: ReactNode;
}

export function EnterCode({ initialCode, home }: { initialCode?: string; home?: EnterCodeHome }) {
  const { session } = useSession();
  const signedIn = !!session;
  const { active, selectGym, refetch } = useActiveGym();
  const join = useJoinWithCode();
  const inAuthStack = usePathname() === '/codigo';

  const startCode = normalizeCode(initialCode ?? '');
  const fromDeepLink = startCode.length === CODE_LENGTH;
  const [code, setCode] = useState(startCode);
  const [step, setStep] = useState<'code' | 'confirm'>(fromDeepLink ? 'confirm' : 'code');
  // What happened after "Sim, continuar" (signed in): a new request, or nothing new.
  const [outcome, setOutcome] = useState<JoinOutcome | null>(null);
  const [joinedGymId, setJoinedGymId] = useState<string | null>(null);

  const complete = code.length === CODE_LENGTH;
  const lookup = useCodeLookup(complete ? code : undefined);
  const academy = complete ? lookup.data : undefined;

  // Signed in, /entrar sits on top of the tabs or the onboarding screens: close it
  // and let the guard / memberships decide what shows (never replace('/'),
  // which would stack a second copy of that group).
  // Home mode: nothing to close; fresh memberships move the guard (→ /aguardando).
  const close = () => (home ? refetch() : router.canGoBack() ? router.back() : router.replace('/'));

  const typeAnother = () => {
    setCode('');
    setStep('code');
    setOutcome(null);
    join.reset();
  };

  // Home mode: Android back on step 2 returns to step 1 (like the header
  // arrow) instead of leaving the code screen.
  const isHome = !!home;
  useEffect(() => {
    if (!isHome || step !== 'confirm') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      typeAnother();
      return true;
    });
    return () => sub.remove();
    // typeAnother only resets local state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHome, step]);

  // Typing goes back to step 1; the 8th character opens step 2 (the lookup
  // runs by itself and the card shows once it answers).
  const editCode = (next: string) => {
    setCode(next);
    setStep('code');
  };
  const onComplete = () => setStep('confirm');

  // Signed out only: "Já tenho conta" (and, on the professor path, sign-up to
  // register an academy). Inside (auth) they stay in the same stack.
  const goToSignIn = () => (inAuthStack ? router.push('/sign-in') : router.replace('/sign-in'));
  const goToSignUp = () => (inAuthStack ? router.push('/sign-up') : router.replace('/sign-up'));

  const continueWithCode = () => {
    if (!academy) return;
    if (!signedIn) {
      pendingCode.set(code);
      entryPath.set(academy.codeType);
      // TODO(motion): transition from the academy card into the account screen.
      // New account by default (sign-up has "Já tenho conta"). Inside (auth):
      // push (back returns here). From a deep link (/entrar): replace.
      if (inAuthStack) router.push('/sign-up');
      else router.replace('/sign-up');
      return;
    }
    join.mutate(code, {
      onSuccess: (result) => {
        setJoinedGymId(result.gymId);
        const next = joinOutcome(result);
        if (next !== 'sent') {
          // Nothing new was created: say why.
          setOutcome(next);
          return;
        }
        haptics.success();
        // Without an active academy, the waiting screen takes over.
        if (!active) close();
        else setOutcome('sent');
      },
    });
  };

  const codeStep = (error?: string, onRetry?: () => void) => (
    <CodeStep
      code={code}
      setCode={editCode}
      onComplete={onComplete}
      signedIn={signedIn}
      onSignIn={goToSignIn}
      onSignUp={goToSignUp}
      home={home}
      errorMessage={error}
      onRetry={onRetry}
      onClose={close}
    />
  );

  // ------------------------------------------------------------ step 1 ---
  if (step === 'code') return codeStep();

  // ------------------------------------------------------------ step 2 ---
  const loading = complete && lookup.isLoading;
  const notFound = !complete || lookup.isError || (lookup.isSuccess && !academy);
  if (notFound && !loading) {
    // Deep link or typed code that does not exist (or was replaced).
    return codeStep(
      lookup.isError ? errorMessage(lookup.error) : 'Código não encontrado. Confira as letras ou peça o código atual à academia.',
      lookup.isError ? () => void lookup.refetch() : undefined,
    );
  }

  const text = outcome ? joinOutcomeText(outcome, academy?.gymName) : null;
  const feedback =
    outcome === 'sent' && text ? (
      <FeedbackSheet tone="success" title={text.title} message={text.message} actionLabel="Continuar" onAction={close} />
    ) : outcome === 'alreadyMember' && text ? (
      <FeedbackSheet
        tone="accent"
        icon="check"
        title={text.title}
        message={text.message}
        actionLabel={joinedGymId && joinedGymId !== active?.gymId ? 'Abrir academia' : 'Continuar'}
        onAction={() => {
          if (joinedGymId) selectGym(joinedGymId);
          close();
        }}
      />
    ) : outcome === 'alreadyPending' && text ? (
      <FeedbackSheet tone="warning" icon="clock" title={text.title} message={text.message} actionLabel="Continuar" onAction={close} />
    ) : undefined;

  return (
    <Screen
      title="É essa a sua academia?"
      onBack={typeAnother}
      feedback={feedback}
      footer={
        academy ? (
          <>
            <Button title="Sim, continuar" loading={join.isPending} onPress={continueWithCode} />
            <Button title="Não, digitar outro" variant="secondary" disabled={join.isPending} onPress={typeAnother} />
          </>
        ) : undefined
      }
    >
      {loading ? <ActivityIndicator accessibilityLabel="Buscando academia" /> : null}
      {academy ? (
        // TODO(motion): academy card entering once the code is recognized.
        <Box gap="s16">
          <AcademyCard gymName={academy.gymName} logoUrl={academy.logoUrl} codeType={academy.codeType} />
          <Text variant="body" color="textMuted">
            {academy.codeType === 'instructor'
              ? 'Seu pedido vai para o proprietário da academia, que precisa aprovar sua entrada como professor.'
              : 'Seu pedido vai para os professores da academia, que precisam aprovar sua entrada.'}
          </Text>
          {join.error ? (
            <Text variant="caption" color="danger">
              {errorMessage(join.error)}
            </Text>
          ) : null}
        </Box>
      ) : null}
    </Screen>
  );
}

function CodeStep({
  code,
  setCode,
  onComplete,
  signedIn,
  errorMessage: error,
  onRetry,
  onSignIn,
  onSignUp,
  onClose,
  home,
}: {
  code: string;
  setCode: (code: string) => void;
  onComplete: () => void;
  signedIn: boolean;
  errorMessage?: string;
  /** Network/server failure on the lookup: try the same code again. */
  onRetry?: () => void;
  onSignIn: () => void;
  onSignUp: () => void;
  onClose: () => void;
  home?: EnterCodeHome;
}) {
  return (
    <Screen
      title="Código de convite"
      // Home: back to the choice. Signed in: close the flow. Signed out: the first screen.
      onBack={home ? home.onBack : signedIn ? onClose : backToStart}
      feedback={home?.notice}
      footer={
        home ? (
          <SignedInFooter />
        ) : !signedIn ? (
          <>
            <TextButton title="Já tenho conta? Entrar" onPress={onSignIn} />
            {/* "Sou professor" also covers owners without a code: create the account, then the academy. */}
            {entryPath.get() === 'instructor' && canCreateAcademy() ? (
              <TextButton title="Quero cadastrar minha academia" onPress={onSignUp} />
            ) : null}
          </>
        ) : undefined
      }
    >
      <Box gap="s16">
        <Text variant="body" color="textMuted">
          Digite o código que sua academia te enviou.
        </Text>
        <CodeField
          kind="invite"
          label="Código de convite"
          length={CODE_LENGTH}
          value={code}
          normalize={normalizeCode}
          onChangeText={setCode}
          onComplete={onComplete}
          errorMessage={error}
          autoFocus
        />
        {onRetry ? <Button title="Tentar de novo" variant="secondary" icon="refresh" onPress={onRetry} /> : null}
      </Box>
    </Screen>
  );
}
