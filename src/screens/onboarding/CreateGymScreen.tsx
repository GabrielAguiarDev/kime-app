import { router, Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, Share } from 'react-native';

import { BigCounter, Box, Button, Card, KimiMascot, ProgressBar, Screen, Text, TextButton, Spinner } from '@components';
import {
  DEFAULT_PLAN,
  isValidAcademyName,
  isValidModalitySelection,
  useCreateGymWithSetup,
  useStudentCode,
  type BillingPeriod,
  type PlanTier,
} from '@domain/Gym';
import { errorMessage } from '@infra';
import { academySignup } from '@services/access';
import { useActiveGym } from '@services/activeGym';
import { joinCodeMessage } from '@utils/deepLinks';
import { haptics } from '@utils/haptics';

import { LogoStep, ModalitiesStep, NameStep, PlanStep, toSignupModalities, type ModalityChoice } from './CreateGymSteps';

const STEPS = ['plan', 'name', 'logo', 'modalities'] as const;
type Step = (typeof STEPS)[number];

const TITLES: Record<Step, string> = {
  plan: 'Escolha seu plano',
  name: 'Qual é o nome da sua academia?',
  logo: 'Adicione a logo',
  modalities: 'Quais modalidades vocês ensinam?',
};

/**
 * /create-gym — academy sign-up, one question per screen (Duolingo style):
 * progress on top, back, primary action fixed at the bottom, "Pular" on the
 * optional step. Plans (visual only, no billing) → name → logo (optional) →
 * modalities → "Sua academia está pronta".
 *
 * Everything lives in this screen's state: the academy is created only when
 * the modalities step is confirmed, in ONE call (academy, owner, modalities,
 * suggested belts, plan). Giving up or closing the app before that creates
 * nothing, and reopening starts over on the choice screen (/academia).
 * From "Criar academia" until "Ir para o app", services/access academySignup
 * keeps this route open even once the new owner membership arrives (memberships
 * refresh on success and whenever the app returns to the foreground, e.g. from
 * the share sheet), so the done step is never skipped.
 */
export function CreateGymScreen() {
  const [step, setStep] = useState<Step | 'done'>('plan');
  const [tier, setTier] = useState<PlanTier>(DEFAULT_PLAN);
  const [period, setPeriod] = useState<BillingPeriod>('monthly');
  const [name, setName] = useState('');
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [choices, setChoices] = useState<ModalityChoice[]>([]);
  const [otherName, setOtherName] = useState('');
  const create = useCreateGymWithSetup();
  // Synchronous lock: a fast double tap must not create two academies.
  const submitting = useRef(false);

  // Leaving the flow in any way ends the "finishing" state.
  useEffect(() => () => academySignup.finish(), []);

  const index = step === 'done' ? STEPS.length : STEPS.indexOf(step);
  const back = () => {
    if (step === 'done' || create.isPending) return;
    if (index === 0) router.back();
    // TODO(motion): step sliding back.
    else setStep(STEPS[index - 1]!);
  };
  // TODO(motion): step sliding forward.
  const next = () => setStep(STEPS[index + 1]!);

  // Android back walks the steps (and is ignored on the done step).
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 'done' || create.isPending) return true;
      if (index === 0) return false;
      setStep(STEPS[index - 1]!);
      return true;
    });
    return () => sub.remove();
  }, [step, index, create.isPending]);

  if (step === 'done' && create.data) {
    return <Done gymId={create.data.gymId} name={name.trim()} logoSaved={create.data.logoSaved} />;
  }

  const modalities = toSignupModalities(choices, otherName);
  const modalitiesOk = isValidModalitySelection(modalities);
  const nameOk = isValidAcademyName(name);

  const submit = () => {
    if (submitting.current) return;
    submitting.current = true;
    academySignup.start();
    create.mutate(
      { name, planTier: tier, modalities, logoUri },
      {
        onSuccess: () => {
          haptics.success();
          setStep('done');
        },
        onError: () => {
          submitting.current = false;
          academySignup.finish();
        },
      },
    );
  };

  const footer =
    step === 'plan' ? (
      <>
        <Button title="Começar teste grátis" onPress={next} />
        <Text variant="caption" textAlign="center">
          Cobrança ainda não ativa nesta versão
        </Text>
      </>
    ) : step === 'name' ? (
      <Button title="Continuar" disabled={!nameOk} onPress={next} />
    ) : step === 'logo' ? (
      <>
        <Button title="Continuar" disabled={!logoUri} onPress={next} />
        <TextButton
          title="Pular"
          onPress={() => {
            setLogoUri(null);
            next();
          }}
        />
      </>
    ) : (
      <Button title="Criar academia" disabled={!modalitiesOk} loading={create.isPending} onPress={submit} />
    );

  return (
    <>
      {/* Steps are local state: the swipe back would drop the whole flow. */}
      <Stack.Screen options={{ gestureEnabled: false }} />
      <Screen
        onBack={back}
        header={<ProgressBar value={index + 1} max={STEPS.length} unit="etapas" animated />}
        title={TITLES[step as Step]}
        footer={footer}
      >
        {step === 'plan' ? <PlanStep tier={tier} onTier={setTier} period={period} onPeriod={setPeriod} /> : null}
        {step === 'name' ? <NameStep name={name} onName={setName} onSubmit={() => nameOk && next()} /> : null}
        {step === 'logo' ? <LogoStep name={name.trim()} logoUri={logoUri} onLogo={setLogoUri} /> : null}
        {step === 'modalities' ? (
          <Box gap="s16">
            <ModalitiesStep choices={choices} onChoices={setChoices} otherName={otherName} onOtherName={setOtherName} />
            {create.error ? (
              <Text variant="caption" color="danger">
                {errorMessage(create.error)}
              </Text>
            ) : null}
          </Box>
        ) : null}
      </Screen>
    </>
  );
}

/** Achievement screen: the academy exists; share the student code and go to the app. */
function Done({ gymId, name, logoSaved }: { gymId: string; name: string; logoSaved: boolean }) {
  const code = useStudentCode(gymId);
  const { memberships, selectGym, refetch, isFetching, isError } = useActiveGym();
  const [leaving, setLeaving] = useState(false);
  const ready = memberships.some((m) => m.gymId === gymId && m.status === 'active');

  // The guard moves to the tabs once the owner membership is loaded.
  useEffect(() => {
    if (leaving && ready) academySignup.finish();
  }, [leaving, ready]);

  const share = () => {
    if (code.data) void Share.share({ message: joinCodeMessage(name, code.data, 'student') });
  };
  const goToApp = () => {
    selectGym(gymId);
    setLeaving(true);
    if (!ready) refetch();
  };

  return (
    // TODO(motion): achievement entrance (mascot celebrating, code appearing).
    <Screen
      scrollable={false}
      footer={
        <>
          <Button title="Compartilhar código" icon="share" variant="secondary" disabled={!code.data} onPress={share} />
          {leaving && !ready && isError && !isFetching ? (
            <Text variant="caption" color="danger" textAlign="center">
              Não foi possível abrir a academia. Verifique sua conexão e tente de novo.
            </Text>
          ) : null}
          <Button title="Ir para o app" loading={leaving && !ready && isFetching} onPress={goToApp} />
        </>
      }
    >
      <Stack.Screen options={{ gestureEnabled: false }} />
      <Box flex={1} alignItems="center" justifyContent="center" gap="s24">
        <KimiMascot size="hero" animated />
        <Text variant="title" textAlign="center" accessibilityRole="header">
          Sua academia está pronta
        </Text>
        <Card alignSelf="stretch" alignItems="center" gap="s8">
          {code.isLoading ? <Spinner accessibilityLabel="Carregando código" /> : null}
          {code.data ? <BigCounter value={code.data} label="Código de aluno" /> : null}
          {code.isError ? (
            <>
              <Text variant="caption" color="danger" textAlign="center">
                {errorMessage(code.error)}
              </Text>
              <TextButton title="Tentar de novo" fullWidth={false} onPress={() => void code.refetch()} />
            </>
          ) : null}
          <Text variant="caption" textAlign="center">
            Quem entrar com este código pede para fazer parte da {name}.
          </Text>
        </Card>
        {!logoSaved ? (
          <Text variant="caption" color="warning" textAlign="center">
            Não foi possível enviar a logo. Envie depois em Configurações da academia.
          </Text>
        ) : null}
      </Box>
    </Screen>
  );
}
