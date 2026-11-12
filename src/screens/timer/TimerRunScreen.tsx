import { useKeepAwake } from 'expo-keep-awake';
import { router, Stack, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Pressable, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigCounter, Box, Button, ConfirmSheet, Icon, KimiMascot, Text, type IconName } from '@components';
import { formatClock, roundsDone, type TimerState } from '@domain/Timer';
import {
  pauseTimer,
  resumeTimer,
  setTimerOrientation,
  skipTimer,
  stopTimer,
  useTimerOrientation,
  useTimerSession,
} from '@services/timer';
import { getTvConnection, subscribeTv } from '@services/tv';
import { useAppTheme, type ColorToken } from '@theme';
import { haptics } from '@utils/haptics';

/** Longest wait for the rotation back to portrait before closing. */
const LEAVE_ROTATION_MS = 1000;

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
 * round segments under it, and end / pause / next at the bottom. Vertical
 * or horizontal by the device's choice ("Tela do timer" in Ajustar, or the
 * rotate button here); horizontal puts the controls in a column on the right.
 * The rest of the app stays portrait.
 */
export function TimerRunScreen() {
  useKeepAwake();
  const session = useTimerSession();
  const tv = useSyncExternalStore(subscribeTv, getTvConnection);
  const { colors } = useAppTheme();
  const orientation = useTimerOrientation();
  const { width, height } = useWindowDimensions();
  // The window's shape (not the choice): right during the rotation, too.
  const landscape = width > height;
  // Leaving while landscape: turn this screen back to portrait first, then
  // close. Closed while landscape, iOS keeps the scene landscape under the
  // portrait app (sideways status bar), since the tabs don't ask to rotate.
  const [leaving, setLeaving] = useState(false);
  const screenOptions = <Stack.Screen options={{ orientation: leaving ? 'portrait' : orientation }} />;
  // Local sheet: the app-wide one (useConfirm) lives under this full-screen
  // modal, and iOS cannot present it from there.
  const [confirmingEnd, setConfirmingEnd] = useState(false);

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/timer'));
  const close = () => (landscape ? setLeaving(true) : leave());
  useEffect(() => {
    if (!leaving) return;
    if (!landscape) {
      leave();
      return;
    }
    // Rotation refused or never reported: close anyway.
    const timer = setTimeout(leave, LEAVE_ROTATION_MS);
    return () => clearTimeout(timer);
  }, [leaving, landscape]);
  const finish = async () => {
    setConfirmingEnd(false);
    await stopTimer();
    close();
  };

  if (!session || session.state.phase === 'done') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        {screenOptions}
        <StatusBar style="light" />
        <Box flex={1} padding="screenMargin" gap="s24">
          <Box flex={1} alignItems="center" justifyContent="center" gap="s24">
            {session ? (
              <>
                <KimiMascot size="empty" animated />
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
      {screenOptions}
      <StatusBar style={look.fg === 'onWarning' ? 'dark' : 'light'} />
      <Box
        flex={1}
        flexDirection={landscape ? 'row' : 'column'}
        gap={landscape ? 's24' : undefined}
        paddingHorizontal="screenMargin"
        paddingVertical="s16"
      >
        <Box flex={1}>
          <Box flexDirection="row" alignItems="center" gap="s12">
            <Text variant="bodyStrong" color={look.fg} flex={1} numberOfLines={1}>
              {session.title}
            </Text>
            <Text variant="bodyStrong" color={look.fg}>
              Round {state.round} de {state.rounds}
            </Text>
            {tv.display ? <Pressable accessibilityRole="button" accessibilityLabel={`TV ${tv.display.name}. Abrir opções`} onPress={() => router.push('/tv' as Href)}><Text variant="caption" color={look.fg}>{tv.failed ? `TV não atualizada · ${tv.display.name}` : `TV: ${tv.display.name}`}</Text></Pressable> : null}
            <Pressable
              onPress={() => {
                haptics.tap();
                setTimerOrientation(orientation === 'landscape' ? 'portrait' : 'landscape');
              }}
              accessibilityRole="button"
              accessibilityLabel={orientation === 'landscape' ? 'Mostrar na vertical' : 'Mostrar na horizontal'}
              hitSlop={12}
            >
              <Icon name="rotate" color={look.fg} />
            </Pressable>
          </Box>

          <Box flex={1} alignItems="center" justifyContent="center" gap={landscape ? 's8' : 's16'}>
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
        </Box>

        <Box
          flexDirection={landscape ? 'column' : 'row'}
          alignItems="center"
          justifyContent="space-evenly"
        >
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
        allowLandscape
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
