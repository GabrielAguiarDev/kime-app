import { router, useLocalSearchParams, usePathname } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { Box, Button, Card, CodeField, FeedbackSheet, Screen, Text, TextButton } from '@components';
import { CODE_LENGTH, normalizeCode, useCodeLookup, useJoinWithCode, type CodeType } from '@domain/Gym';
import { errorMessage } from '@infra';
import { useActiveGym } from '@services/activeGym';
import { entryPath, joinOutcome, joinOutcomeText, pendingCode, type JoinOutcome } from '@services/entry';
import { useSession } from '@services/session';
import { haptics } from '@utils/haptics';

import { AcademyCard } from './AcademyCard';
import { backToStart } from './StartScreen';

const TYPE_LABEL: Record<CodeType, string> = { student: 'aluno', instructor: 'professor' };

/**
 * Two routes render this screen:
 *  - /codigo (inside (auth)): the signed-out student path, so the whole flow
 *    lives in one stack (back works, and the guard drops it after sign-in);
 *  - /entrar (outside the guards): signed in ("Entrar em outra academia",
 *    "Tenho um código de professor") and every deep link.
 *
 * The code flow:
 *   1. code (big field, upper case);
 *   2. "É essa a sua academia?" with logo and name.
 * Signed out, "Sim" saves the code and goes to sign-up/sign-in; the request is
 * sent right after (useConsumePendingCode). Signed in, it is sent here.
 *
 * Deep link kimi://entrar?codigo=XXXXXXXX opens straight on step 2, on the
 * path that matches the code. `path` (student | professor) is the way the user
 * came in; when the code is of the other kind we say so and offer to switch,
 * keeping the code.
 */
export function EnterCodeScreen() {
  const params = useLocalSearchParams<{ codigo?: string; path?: string }>();
  // A new deep link while this screen is open starts the flow over.
  return <EnterCode key={params.codigo ?? ''} initialCode={params.codigo} pathParam={params.path} />;
}

function EnterCode({ initialCode, pathParam }: { initialCode?: string; pathParam?: string }) {
  const { session } = useSession();
  const signedIn = !!session;
  const { active, selectGym } = useActiveGym();
  const join = useJoinWithCode();
  const inAuthStack = usePathname() === '/codigo';

  const startCode = normalizeCode(initialCode ?? '');
  const fromDeepLink = startCode.length === CODE_LENGTH;
  const [code, setCode] = useState(startCode);
  const [step, setStep] = useState<'code' | 'confirm'>(fromDeepLink ? 'confirm' : 'code');
  // Path the user is on. A deep link follows the code's own kind.
  const [path, setPath] = useState<CodeType | null>(() => {
    if (fromDeepLink) return null;
    if (pathParam === 'professor') return 'instructor';
    if (pathParam === 'student' || pathParam === 'instructor') return pathParam;
    return signedIn ? null : (entryPath.get() ?? 'student');
  });
  // What happened after "Sim, continuar" (signed in): a new request, or nothing new.
  const [outcome, setOutcome] = useState<JoinOutcome | null>(null);
  const [joinedGymId, setJoinedGymId] = useState<string | null>(null);

  const complete = code.length === CODE_LENGTH;
  const lookup = useCodeLookup(complete ? code : undefined);
  const academy = complete ? lookup.data : undefined;
  const mismatch = !!academy && !!path && academy.codeType !== path;

  // Signed in, /entrar sits on top of the tabs or the welcome screen: close it
  // and let the guard / memberships decide what shows (never replace('/'),
  // which would stack a second copy of that group).
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const typeAnother = () => {
    setCode('');
    setStep('code');
    setOutcome(null);
    join.reset();
  };

  const switchPath = (to: CodeType) => {
    setPath(to);
    if (!signedIn) entryPath.set(to);
    setStep('confirm');
  };

  // Typing goes back to step 1; the 8th character opens step 2 (the lookup
  // runs by itself and the card shows once it answers).
  const editCode = (next: string) => {
    setCode(next);
    setStep('code');
  };
  const onComplete = () => setStep('confirm');

  // Signed out only: the discreet "Sou professor / Sou aluno" switch and
  // "Já tenho conta". Inside (auth) they stay in the same stack.
  const goToSignIn = () => (inAuthStack ? router.push('/sign-in') : router.replace('/sign-in'));
  const switchEntryPath = (to: CodeType) => {
    entryPath.set(to);
    if (to === 'instructor') goToSignIn();
    else setPath('student');
  };

  const continueWithCode = () => {
    if (!academy) return;
    if (!signedIn) {
      pendingCode.set(code);
      entryPath.set(academy.codeType);
      // TODO(motion): transition from the academy card into the account screen.
      const next = academy.codeType === 'student' ? '/sign-up' : '/sign-in';
      // Inside (auth): push (same stack, back returns here). From a deep link
      // (/entrar): replace, so nothing of the flow is left behind the app.
      if (inAuthStack) router.push(next);
      else router.replace(next);
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
        // Without an active academy, the waiting screen underneath takes over.
        if (!active) close();
        else setOutcome('sent');
      },
    });
  };

  // ------------------------------------------------------------ step 2 ---
  if (step === 'confirm') {
    const loading = complete && lookup.isLoading;
    const notFound = !complete || lookup.isError || (lookup.isSuccess && !academy);

    if (notFound && !loading) {
      // Deep link or typed code that does not exist (or no longer does).
      return (
        <CodeStep
          code={code}
          setCode={editCode}
          onComplete={onComplete}
          signedIn={signedIn}
          path={path}
          onSignIn={goToSignIn}
          onSwitchPath={switchEntryPath}
          errorMessage={lookup.isError ? errorMessage(lookup.error) : 'Código não encontrado. Confira as letras.'}
          onRetry={lookup.isError ? () => lookup.refetch() : undefined}
          onClose={close}
        />
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
        <FeedbackSheet
          tone="warning"
          icon="clock"
          title={text.title}
          message={text.message}
          actionLabel="Continuar"
          onAction={close}
        />
      ) : undefined;

    return (
      <Screen
        title={mismatch ? undefined : 'É essa a sua academia?'}
        onBack={typeAnother}
        feedback={feedback}
        footer={
          academy && !mismatch ? (
            <>
              <Button title="Sim, continuar" loading={join.isPending} onPress={continueWithCode} />
              <Button title="Não, digitar outro" variant="secondary" disabled={join.isPending} onPress={typeAnother} />
            </>
          ) : undefined
        }
      >
        {loading ? <ActivityIndicator accessibilityLabel="Buscando academia" /> : null}
        {academy && mismatch && path ? (
          <MismatchNotice
            codeType={academy.codeType}
            onSwitch={() => switchPath(academy.codeType)}
            onTypeAnother={typeAnother}
          />
        ) : null}
        {academy && !mismatch ? (
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

  // ------------------------------------------------------------ step 1 ---
  return (
    <CodeStep
      code={code}
      setCode={editCode}
      onComplete={onComplete}
      signedIn={signedIn}
      path={path}
      onSignIn={goToSignIn}
      onSwitchPath={switchEntryPath}
      onClose={close}
    />
  );
}

function CodeStep({
  code,
  setCode,
  onComplete,
  signedIn,
  path,
  errorMessage: error,
  onRetry,
  onSignIn,
  onSwitchPath,
  onClose,
}: {
  code: string;
  setCode: (code: string) => void;
  onComplete: () => void;
  signedIn: boolean;
  path: CodeType | null;
  errorMessage?: string;
  /** Network/server failure on the lookup: try the same code again. */
  onRetry?: () => void;
  onSignIn: () => void;
  onSwitchPath: (to: CodeType) => void;
  onClose: () => void;
}) {
  const isProfessor = path === 'instructor';

  return (
    <Screen
      title={isProfessor ? 'Código de professor' : 'Código da academia'}
      // Signed in: close the flow. Signed out: previous step or the first screen.
      onBack={signedIn ? onClose : backToStart}
      footer={
        !signedIn ? (
          <>
            <TextButton title="Já tenho conta? Entrar" onPress={onSignIn} />
            <TextButton
              title={isProfessor ? 'Sou aluno' : 'Sou professor'}
              onPress={() => onSwitchPath(isProfessor ? 'student' : 'instructor')}
            />
          </>
        ) : undefined
      }
    >
      <Box gap="s16">
        <Text variant="body" color="textMuted">
          {isProfessor
            ? 'Digite o código de professor que o proprietário da academia te enviou.'
            : 'Digite o código que seu professor te passou. São 8 letras e números.'}
        </Text>
        <CodeField
          kind="invite"
          label={isProfessor ? 'Código de professor' : 'Código da academia'}
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

function MismatchNotice({
  codeType,
  onSwitch,
  onTypeAnother,
}: {
  codeType: CodeType;
  onSwitch: () => void;
  onTypeAnother: () => void;
}) {
  return (
    <Card gap="s12" accessibilityRole="alert">
      <Text variant="heading">Este é um código de {TYPE_LABEL[codeType]}.</Text>
      <Text variant="body" color="textMuted">
        {codeType === 'instructor'
          ? 'Ele serve para entrar na academia como professor.'
          : 'Ele serve para entrar na academia como aluno.'}
      </Text>
      <Button title={`Continuar como ${TYPE_LABEL[codeType]}`} onPress={onSwitch} />
      <TextButton title="Digitar outro código" onPress={onTypeAnother} />
    </Card>
  );
}
