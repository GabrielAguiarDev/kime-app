import { useEffect, useState } from 'react';
import { AccessibilityInfo, Modal } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  withTiming,
  type EntryAnimationsValues,
  type LayoutAnimation,
} from 'react-native-reanimated';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme, type ColorToken } from '@theme';

import { Box } from '../Box/Box';
import { Button, type ButtonVariant } from '../Button/Button';
import { Icon, type IconName } from '../Icon/Icon';
import { KimiMascot, useMascotPx, type KimiPose } from '../KimiMascot/KimiMascot';
import { BUST_PROFILE_BANDS, BUST_RIGHT_PROFILE } from '../KimiMascot/bustProfile';
import { BUST_WINDOWS } from '../KimiMascot/poses';
import { Text } from '../Text/Text';

// Motion: quick rise from below the screen edge, so it doesn't drag on repeated feedback.
const ENTER_MS = 240;
/** Extra travel so the mascot (which rises past the top border) also starts out of view. */
const ENTER_OVERSHOOT = 140;

function enterFromBottom(values: EntryAnimationsValues): LayoutAnimation {
  'worklet';
  const config = { duration: ENTER_MS, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System };
  return {
    initialValues: { transform: [{ translateY: values.targetHeight + ENTER_OVERSHOOT }] },
    animations: { transform: [{ translateY: withTiming(0, config) }] },
  };
}

export type FeedbackTone = 'success' | 'accent' | 'water' | 'warning' | 'danger';

const TONES: Record<FeedbackTone, { tint: ColorToken; line: ColorToken; button: ButtonVariant }> = {
  success: { tint: 'feedbackSuccess', line: 'success', button: 'primary' },
  accent: { tint: 'feedbackAccent', line: 'accent', button: 'primary' },
  water: { tint: 'feedbackWater', line: 'water', button: 'water' },
  warning: { tint: 'feedbackWarning', line: 'warning', button: 'primary' },
  danger: { tint: 'feedbackDanger', line: 'danger', button: 'danger' },
};

interface FeedbackSheetProps {
  tone: FeedbackTone;
  title: string;
  message?: string;
  actionLabel: string;
  onAction: () => void;
  /** Icon on the left instead of the mascot. */
  icon?: IconName;
  /** Pose of the bust mascot (default `guard`). Ignored with `icon`. */
  pose?: KimiPose;
  /** Mascot micro-animations (every pose with eyes: guard, team, streak, thirsty). */
  animated?: boolean;
}

/**
 * Feedback sheet (DESIGN-SYSTEM.md, 3.10) — the "Correto!" strip at the bottom of the screen.
 * Semantic color at 15% over the screen background, 2px top line in the full color.
 * Every feedback message uses it, docked at the bottom of the screen. Padding 20 (top and
 * sides) and safe area + 12 at the bottom; a row (title and message; on the left the icon,
 * centered, or the 120 bust mascot, base on the row's base, top free to rise past the border),
 * 16, the full-width button. Height = the sum, no minimum.
 * Pass it to `<Screen feedback={...} />`. The caller fires the haptic for the moment.
 */
export function FeedbackSheet(props: FeedbackSheetProps) {
  return (
    <Modal
      transparent
      animationType="none"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={props.onAction}
    >
      {/* Measure device insets here, outside the native tab bar's safe area. */}
      <SafeAreaProvider>
        <Box flex={1} justifyContent="flex-end" accessibilityViewIsModal>
          <FeedbackSheetContent {...props} />
        </Box>
      </SafeAreaProvider>
    </Modal>
  );
}

function FeedbackSheetContent({ tone, title, message, actionLabel, onAction, icon, pose, animated }: FeedbackSheetProps) {
  const { bottom } = useSafeAreaInsets();
  const theme = useAppTheme();
  const t = TONES[tone];
  const paddingBottom = bottom + theme.spacing.s12;
  const mascotPx = useMascotPx('sheet');
  const mascotPose = pose ?? 'guard';
  // Height of the text block (measured); before the first layout, about a title + one line.
  const [textHeight, setTextHeight] = useState<number>(theme.spacing.s48);
  const textLeft = icon ? 0 : mascotRightEdge(mascotPose, mascotPx, textHeight) + theme.spacing.s12;

  // iOS ignores accessibilityLiveRegion: announce the sheet explicitly.
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(message ? `${title}. ${message}` : title);
  }, [title, message]);

  return (
    // Enters rising from the bottom edge. The tint is translucent: `bg` under it.
    <Animated.View entering={enterFromBottom}>
      <Box backgroundColor="bg">
        <Box
          backgroundColor={t.tint}
          borderTopWidth={theme.border.width}
          borderColor={t.line}
          paddingHorizontal="s20"
          paddingTop="s20"
          gap="s16"
          style={{ paddingBottom }}
          accessibilityLiveRegion="polite"
        >
          <Box flexDirection="row" alignItems={icon ? 'center' : 'flex-end'}>
            {icon ? (
              <Box marginRight="s12">
                <Icon name={icon} color={t.line} active />
              </Box>
            ) : (
              // Bust (size `sheet`, crop `bust`), base on the base of the row (16 above the
              // button, like the text); absolute, so it does not change the height and its top may
              // rise past the sheet's top border (nothing clips it).
              <Box position="absolute" left={0} bottom={0} pointerEvents="box-none">
                <KimiMascot
                  size="sheet"
                  crop="bust"
                  pose={mascotPose}
                  animated={!!animated}
                  // Comes alive as soon as the sheet has risen.
                  startAfterMs={ENTER_MS + 60}
                />
              </Box>
            )}
            <Box
              flex={1}
              gap="s4"
              style={{ marginLeft: textLeft }}
              onLayout={(e) => setTextHeight(Math.round(e.nativeEvent.layout.height))}
            >
              <Text variant="heading" accessibilityRole="header">
                {title}
              </Text>
              {message ? <Text variant="body">{message}</Text> : null}
            </Box>
          </Box>
          <Button title={actionLabel} variant={t.button} onPress={onAction} />
        </Box>
      </Box>
    </Animated.View>
  );
}

/**
 * Right edge (pt from the mascot's left) of whatever the bust draws within the bottom
 * `textHeight` of it: the body, and the headband tips or fists when they are at the text's
 * height. The text starts after it, so it never covers the mascot (bustProfile.ts).
 */
function mascotRightEdge(pose: KimiPose, px: number, textHeight: number): number {
  const window = BUST_WINDOWS[pose];
  const profile = BUST_RIGHT_PROFILE[pose];
  const from = Math.max(0, Math.floor((1 - textHeight / px) * BUST_PROFILE_BANDS));
  const edge = Math.max(...profile.slice(Math.min(from, BUST_PROFILE_BANDS - 1)));
  return edge * window.width * (px / window.height);
}
