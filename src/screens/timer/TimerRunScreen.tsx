import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Box, Button, ConfirmSheet, Icon, Text, type IconName } from '@components';
import { formatClock, type TimerState } from '@domain/Timer';
import { pauseTimer, resumeTimer, skipTimer, stopTimer, useTimerSession, type TimerSession } from '@services/timer';
import { useAppTheme, type ColorToken } from '@theme';
import { haptics } from '@utils/haptics';

interface Look {
  bg: ColorToken;
  fg: ColorToken;
}

/** Colors by state, readable across the room (tokens only). */
function lookOf(state: TimerState, paused: boolean): Look {
  if (paused) return { bg: 'surfaceRaised', fg: 'text' };
  if (state.phase === 'done') return { bg: 'bg', fg: 'text' };
  if (state.warning) return { bg: 'danger', fg: 'onDanger' };
  if (state.phase === 'prep') return { bg: 'warning', fg: 'onWarning' };
  if (state.phase === 'rest') return { bg: 'water', fg: 'onWater' };
  return { bg: 'success', fg: 'onSuccess' };
}

function phaseLabel(state: TimerState, paused: boolean): string {
  const base =
    state.phase === 'prep'
      ? 'Prepare-se'
      : state.phase === 'rest'
        ? 'Descanso'
        : state.phase === 'done'
          ? 'Fim do treino'
          : `Round ${state.round} de ${state.rounds}`;
  return paused ? `${base} · pausado` : base;
}

/** What comes after the current phase. */
function nextLabel(session: TimerSession): string | null {
  const i = session.state.segmentIndex;
  if (i < 0) return null;
  const next = session.segments[i + 1];
  if (!next) return 'Último round';
  const length = formatClock(next.endMs - next.startMs);
  return next.phase === 'rest' ? `Depois: descanso ${length}` : `Depois: round ${next.round} (${length})`;
}

/**
 * The running timer, full screen: state color, huge time left, round, what
 * comes next, and pause / previous / next / end. The screen stays on.
 */
export function TimerRunScreen() {
  useKeepAwake();
  const session = useTimerSession();
  const { colors } = useAppTheme();
  // Local sheet: the app-wide one (useConfirm) lives under this full-screen
  // modal, and iOS cannot present it from there.
  const [confirmingEnd, setConfirmingEnd] = useState(false);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/timer'));

  if (!session) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <Box flex={1} alignItems="center" justifyContent="center" padding="screenMargin" gap="s16">
          <Text variant="heading">Nenhum timer em andamento.</Text>
          <Button title="Configurar timer" variant="secondary" fullWidth={false} onPress={() => router.replace('/timer')} />
        </Box>
      </SafeAreaView>
    );
  }

  const paused = session.clock.pausedAt !== null;
  const { state } = session;
  const look = lookOf(state, paused);
  const done = state.phase === 'done';

  const finish = async () => {
    setConfirmingEnd(false);
    await stopTimer();
    close();
  };
  const end = () => {
    if (done) void finish();
    else setConfirmingEnd(true);
  };

  return (
    // TODO(motion): background color changing between phases.
    <SafeAreaView style={{ flex: 1, backgroundColor: colors[look.bg] }}>
      <Box flex={1} paddingHorizontal="screenMargin" paddingVertical="s16">
        <Box flexDirection="row" alignItems="center" justifyContent="space-between">
          <Text variant="heading" color={look.fg} flex={1} numberOfLines={1}>
            {session.title}
          </Text>
          <RoundButton icon="missed" label={done ? 'Fechar' : 'Encerrar timer'} color={look.fg} onPress={end} />
        </Box>

        <Box flex={1} alignItems="center" justifyContent="center" gap="s8">
          <Text variant="title" color={look.fg} textTransform="uppercase" accessibilityRole="header">
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
            {done ? '0:00' : formatClock(state.remainingMs)}
          </Text>
          {!done ? (
            <Text variant="heading" color={look.fg}>
              {nextLabel(session)}
            </Text>
          ) : null}
        </Box>

        {done ? (
          <Button title="Fechar" variant="secondary" onPress={end} />
        ) : (
          <Box flexDirection="row" alignItems="center" justifyContent="space-evenly">
            <RoundButton icon="skipBack" label="Fase anterior" color={look.fg} onPress={() => skipTimer(-1)} />
            <RoundButton
              big
              icon={paused ? 'play' : 'pause'}
              label={paused ? 'Continuar' : 'Pausar'}
              color={look.fg}
              onPress={() => {
                haptics.tap();
                if (paused) resumeTimer();
                else pauseTimer();
              }}
            />
            <RoundButton icon="skipForward" label="Próxima fase" color={look.fg} onPress={() => skipTimer(1)} />
          </Box>
        )}
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

function RoundButton({
  icon,
  label,
  color,
  onPress,
  big = false,
}: {
  icon: IconName;
  label: string;
  color: ColorToken;
  onPress: () => void;
  big?: boolean;
}) {
  const { size, border, colors } = useAppTheme();
  const diameter = big ? size.touchTarget * 2 : size.touchTarget * 1.25;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width: diameter,
        height: diameter,
        borderRadius: diameter / 2,
        // Pressed: thicker ring (no animation; see TODO(motion) on the tactile button).
        borderWidth: pressed ? border.width * 2 : border.width,
        borderColor: colors[color],
        alignItems: 'center',
        justifyContent: 'center',
      })}
    >
      <Icon name={icon} color={color} active={big} size={big ? size.icon * 2 : size.icon} />
    </Pressable>
  );
}
