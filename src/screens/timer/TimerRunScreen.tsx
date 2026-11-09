import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigCounter, Box, Button, ConfirmSheet, Icon, KimiMascot, Text, type IconName } from '@components';
import { formatClock, roundsDone, type TimerState } from '@domain/Timer';
import { pauseTimer, resumeTimer, skipTimer, stopTimer, useTimerSession } from '@services/timer';
import { useAppTheme, type ColorToken } from '@theme';
import { haptics } from '@utils/haptics';

interface Look {
  bg: ColorToken;
  fg: ColorToken;
}

/**
 * Colors by state, readable across the room (tokens only): round accent,
 * rest water, final warning warning. Preparation and pause stay neutral.
 */
function lookOf(state: TimerState, paused: boolean): Look {
  if (paused || state.phase === 'prep') return { bg: 'surfaceRaised', fg: 'text' };
  if (state.warning) return { bg: 'warning', fg: 'onWarning' };
  if (state.phase === 'rest') return { bg: 'water', fg: 'onWater' };
  return { bg: 'accent', fg: 'onAccent' };
}

function phaseLabel(state: TimerState, paused: boolean): string {
  if (paused) return 'Pausado';
  if (state.phase === 'prep') return 'Prepare-se';
  if (state.phase === 'rest') return 'Descanso';
  return 'Round';
}

/**
 * The running timer, full screen (no tab bar, no header, screen always on):
 * preset and round on top, state label and a huge time left in the middle,
 * round segments under it, and end / pause / next at the bottom.
 */
export function TimerRunScreen() {
  useKeepAwake();
  const session = useTimerSession();
  const { colors } = useAppTheme();
  // Local sheet: the app-wide one (useConfirm) lives under this full-screen
  // modal, and iOS cannot present it from there.
  const [confirmingEnd, setConfirmingEnd] = useState(false);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/timer'));
  const finish = async () => {
    setConfirmingEnd(false);
    await stopTimer();
    close();
  };

  if (!session || session.state.phase === 'done') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <StatusBar style="light" />
        <Box flex={1} padding="screenMargin" gap="s24">
          <Box flex={1} alignItems="center" justifyContent="center" gap="s24">
            {session ? (
              <>
                <KimiMascot size="empty" />
                <Text variant="title" textAlign="center" accessibilityRole="header">
                  Treino concluído
                </Text>
                <BigCounter value={session.config.rounds} label={session.config.rounds === 1 ? 'Round' : 'Rounds'} />
                <Text variant="body" color="textMuted">
                  {session.title}
                </Text>
              </>
            ) : (
              <Text variant="heading">Nenhum timer em andamento.</Text>
            )}
          </Box>
          <Button title="Voltar" onPress={() => void finish()} />
        </Box>
      </SafeAreaView>
    );
  }

  const paused = session.clock.pausedAt !== null;
  const { state } = session;
  const look = lookOf(state, paused);
  const done = roundsDone(state);

  return (
    // TODO(motion): background color changing between states (round / rest / warning / pause).
    <SafeAreaView style={{ flex: 1, backgroundColor: colors[look.bg] }}>
      <StatusBar style={look.fg === 'onWarning' ? 'dark' : 'light'} />
      <Box flex={1} paddingHorizontal="screenMargin" paddingVertical="s16">
        <Box flexDirection="row" alignItems="center" gap="s12">
          <Text variant="bodyStrong" color={look.fg} flex={1} numberOfLines={1}>
            {session.title}
          </Text>
          <Text variant="bodyStrong" color={look.fg}>
            Round {state.round} de {state.rounds}
          </Text>
        </Box>

        <Box flex={1} alignItems="center" justifyContent="center" gap="s16">
          {/* TODO(motion): state label switching (ROUND / DESCANSO). */}
          <Text variant="captionCaps" color={look.fg} accessibilityRole="header">
            {phaseLabel(state, paused)}
          </Text>
          {/* TODO(motion): digits flipping every second. */}
          <Text
            variant="timer"
            color={look.fg}
            numberOfLines={1}
            adjustsFontSizeToFit
            accessibilityLabel={`${formatClock(state.remainingMs)} restantes`}
          >
            {formatClock(state.remainingMs)}
          </Text>
          <RoundSegments total={state.rounds} done={done} color={look.fg} />
        </Box>

        <Box flexDirection="row" alignItems="center" justifyContent="space-evenly">
          <ControlButton icon="missed" label="Encerrar timer" look={look} onPress={() => setConfirmingEnd(true)} />
          <ControlButton
            big
            icon={paused ? 'play' : 'pause'}
            label={paused ? 'Continuar' : 'Pausar'}
            look={look}
            onPress={() => (paused ? resumeTimer() : pauseTimer())}
          />
          <ControlButton icon="skipForward" label="Pular para a próxima fase" look={look} onPress={() => skipTimer(1)} />
        </Box>
      </Box>
      <ConfirmSheet
        visible={confirmingEnd}
        title="Encerrar o timer?"
        message="O treino em andamento para aqui."
        confirmLabel="Encerrar"
        tone="danger"
        onConfirm={() => void finish()}
        onCancel={() => setConfirmingEnd(false)}
      />
    </SafeAreaView>
  );
}

/** One segment per round: finished ones filled, the rest outlined. */
function RoundSegments({ total, done, color }: { total: number; done: number; color: ColorToken }) {
  const { border, size } = useAppTheme();
  return (
    <Box
      flexDirection="row"
      gap="s4"
      alignSelf="stretch"
      accessible
      accessibilityLabel={`${done} de ${total} rounds concluídos`}
    >
      {Array.from({ length: total }, (_, i) => (
        // TODO(motion): segment filling when a round ends.
        <Box
          key={i}
          flex={1}
          height={size.progressBar}
          borderRadius="sm"
          borderWidth={border.width}
          borderColor={color}
          backgroundColor={i < done ? color : 'transparent'}
        />
      ))}
    </Box>
  );
}

/** Side controls outlined in the text color; the main one filled with it, icon in the screen color. */
function ControlButton({
  icon,
  label,
  look,
  onPress,
  big = false,
}: {
  icon: IconName;
  label: string;
  look: Look;
  onPress: () => void;
  big?: boolean;
}) {
  const { size, border, colors } = useAppTheme();
  const diameter = big ? size.touchTarget * 2.25 : size.touchTarget * 1.5;
  return (
    <Pressable
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width: diameter,
        height: diameter,
        borderRadius: diameter / 2,
        backgroundColor: big ? colors[look.fg] : 'transparent',
        // Pressed: thicker ring (no animation; see TODO(motion) on the tactile button).
        borderWidth: pressed ? border.width * 2 : border.width,
        borderColor: colors[look.fg],
        alignItems: 'center',
        justifyContent: 'center',
      })}
    >
      <Icon name={icon} color={big ? look.bg : look.fg} active size={big ? size.icon * 2 : size.icon * 1.5} />
    </Pressable>
  );
}
