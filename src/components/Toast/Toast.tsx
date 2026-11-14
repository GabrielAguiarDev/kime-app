import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { useAppTheme } from '@theme';

import { Box, type BoxProps } from '../Box/Box';
import { Icon, type IconName } from '../Icon/Icon';
import { Text } from '../Text/Text';

const AnimatedBox = Animated.createAnimatedComponent(Box);
const TOAST_FADE_MS = 160;

/** How long a toast stays on screen. */
export const TOAST_MS = 2_000;

/**
 * Small confirmation popup ("Código copiado…"): raised surface, 2px border,
 * radius md, icon + caption. Place it where the action happened (it renders
 * inline; wrap it in an absolute Box to float it). Fades in and out (reduced motion: instant).
 */
export function Toast({ message, icon = 'check', ...boxProps }: { message: string; icon?: IconName } & BoxProps) {
  const { border, size } = useAppTheme();
  return (
    <AnimatedBox
      entering={FadeIn.duration(TOAST_FADE_MS)}
      exiting={FadeOut.duration(TOAST_FADE_MS)}
      flexDirection="row"
      alignItems="center"
      gap="s8"
      paddingHorizontal="s12"
      paddingVertical="s8"
      borderRadius="md"
      borderWidth={border.width}
      borderColor="border"
      backgroundColor="surfaceRaised"
      accessibilityRole="alert"
      {...boxProps}
    >
      <Icon name={icon} color="success" active size={size.iconInline} />
      <Text variant="caption" color="text">
        {message}
      </Text>
    </AnimatedBox>
  );
}

/** `show(message)` displays it for TOAST_MS (a new call restarts the time) and announces it to screen readers. */
export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const show = (next: string) => {
    if (timer.current) clearTimeout(timer.current);
    setMessage(next);
    AccessibilityInfo.announceForAccessibility(next);
    timer.current = setTimeout(() => setMessage(null), TOAST_MS);
  };
  return { message, show };
}
