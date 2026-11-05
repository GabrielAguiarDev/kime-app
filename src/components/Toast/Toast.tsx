import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { useAppTheme } from '@theme';

import { Box, type BoxProps } from '../Box/Box';
import { Icon, type IconName } from '../Icon/Icon';
import { Text } from '../Text/Text';

/** How long a toast stays on screen. */
export const TOAST_MS = 2_000;

/**
 * Small confirmation popup ("Código copiado…"): raised surface, 2px border,
 * radius md, icon + caption. Place it where the action happened (it renders
 * inline; wrap it in an absolute Box to float it). Shows and hides instantly.
 */
export function Toast({ message, icon = 'check', ...boxProps }: { message: string; icon?: IconName } & BoxProps) {
  const { border, size } = useAppTheme();
  return (
    // TODO(motion): toast fading in and out.
    <Box
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
    </Box>
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
