import { Redirect, router } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { Modal } from 'react-native';

import { Box, Button, Card, EmptyState, FeedbackSheet, KimiMascot, MascotBalloon, Screen, Text } from '@components';
import { AppIntro } from '@screens/intro/AppIntro';
import { CheckinConfirmedSheet } from '@screens/student/CheckinConfirmedSheet';
import { WaterGoalSheet } from '@screens/water/WaterGoalSheet';

const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

type Sheet = 'team' | 'streak' | 'record' | 'water' | null;
type Inline = 'empty' | 'emptyError' | 'balloon' | 'thirsty' | null;

/**
 * DEV ONLY (__DEV__, button on Início): replays the moments where the mascot poses show,
 * with sample data. Nothing is written.
 */
export function DebugScreen() {
  const [sheet, setSheet] = useState<Sheet>(null);
  const [inline, setInline] = useState<Inline>(null);
  const [checkin, setCheckin] = useState<number | null>(null);
  const [intro, setIntro] = useState(false);
  const endIntro = useCallback(() => setIntro(false), []);

  if (!__DEV__) return <Redirect href="/" />;

  const close = () => setSheet(null);
  const feedback =
    sheet === 'team' ? (
      <FeedbackSheet
        tone="success"
        title="Bem-vindo à equipe."
        mascot={<KimiMascot size="feedback" pose="team" />}
        actionLabel="Continuar"
        onAction={close}
      />
    ) : sheet === 'streak' || sheet === 'record' ? (
      <FeedbackSheet
        key={sheet}
        tone="accent"
        title={sheet === 'record' ? 'Novo recorde.' : 'Nada mal.'}
        mascot={<KimiMascot size="feedback" pose="streak" />}
        message="4 semanas seguidas treinando."
        actionLabel={sheet === 'record' ? 'Ver disciplina' : 'Continuar'}
        onAction={close}
      />
    ) : sheet === 'water' ? (
      <WaterGoalSheet isLimit={false} totalMl={2500} streak={3} onAction={close} />
    ) : undefined;

  const toggle = (value: Exclude<Inline, null>) => setInline((current) => (current === value ? null : value));

  return (
    <Screen nativeHeader title="Debug" onBack={back} feedback={feedback}>
      <Box gap="s24">
        <Section title="Abertura do app" pose="guard animado">
          <Button title="Ver splash" variant="secondary" onPress={() => setIntro(true)} />
        </Section>

        <Section title="Folhas de feedback" pose="team, streak">
          <Button title="Entrar na equipe" variant="secondary" onPress={() => setSheet('team')} />
          <Button title="Disciplina aumentou" variant="secondary" onPress={() => setSheet('streak')} />
          <Button title="Novo recorde" variant="secondary" onPress={() => setSheet('record')} />
          <Button title="Meta de água batida" variant="secondary" onPress={() => setSheet('water')} />
          <Button title="Check-in confirmado" variant="secondary" onPress={() => setCheckin(1)} />
        </Section>

        <Section title="Telas de conquista" pose="graduation, guard">
          <Button
            title="Nova faixa"
            variant="secondary"
            onPress={() => router.push({ pathname: '/achievement', params: { kind: 'belt', beltPrimary: 'blue' } })}
          />
          <Button
            title="Marco de aulas"
            variant="secondary"
            onPress={() => router.push({ pathname: '/achievement', params: { kind: 'milestone', value: '100' } })}
          />
        </Section>

        <Section title="Na tela" pose="guard animado, thirsty">
          <Button title="Estado vazio" variant="secondary" onPress={() => toggle('empty')} />
          <Button title="Estado vazio de erro" variant="secondary" onPress={() => toggle('emptyError')} />
          <Button title="Balão do mascote" variant="secondary" onPress={() => toggle('balloon')} />
          <Button title="Widget de água às 18h" variant="secondary" onPress={() => toggle('thirsty')} />
        </Section>

        {inline === 'empty' ? (
          <Card>
            <EmptyState title="Nenhum horário cadastrado." description="Toque no mascote para ele ficar bravo." />
          </Card>
        ) : inline === 'emptyError' ? (
          <Card>
            <EmptyState error title="Não foi possível carregar." description="Verifique sua conexão." />
          </Card>
        ) : inline === 'balloon' ? (
          <MascotBalloon message="Faltam 1.200 ml para a sua meta de hoje." />
        ) : inline === 'thirsty' ? (
          // The real one is the native widget; this only previews the pose it uses.
          <Card flexDirection="row" alignItems="center" gap="s16">
            <KimiMascot size="feedback" pose="thirsty" />
            <Box flex={1} gap="s4">
              <Text variant="displayLg">0 ml</Text>
              <Text variant="caption" color="textMuted">
                Meta de hoje: 2.500 ml
              </Text>
            </Box>
          </Card>
        ) : null}
      </Box>

      <CheckinConfirmedSheet count={checkin} total={42} onClose={() => setCheckin(null)} />

      <Modal visible={intro} animationType="none" transparent statusBarTranslucent onRequestClose={() => setIntro(false)}>
        {intro ? <AppIntro ready onDone={endIntro} /> : null}
      </Modal>
    </Screen>
  );
}

function Section({ title, pose, children }: { title: string; pose: string; children: ReactNode }) {
  return (
    <Box gap="s12">
      <Box gap="s4">
        <Text variant="heading">{title}</Text>
        <Text variant="caption" color="textMuted">
          Pose: {pose}
        </Text>
      </Box>
      {children}
    </Box>
  );
}
