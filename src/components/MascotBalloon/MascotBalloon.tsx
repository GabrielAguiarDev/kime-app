import { useAppTheme } from '@theme';

import { Box } from '../Box/Box';
import { Mascot, type MascotExpression } from '../Mascot/Mascot';
import { Text } from '../Text/Text';

interface MascotBalloonProps {
  /** Short message, at most two lines. */
  message: string;
  /** `angry` by default (tips, reminders, pending check-in); `celebrating` for good news. */
  expression?: MascotExpression;
}

/**
 * Mascot speaking (DESIGN-SYSTEM.md, 11.3): mascot 56 on the left and a
 * balloon on the right (surface, 2px border, radius-lg) with a pointer toward
 * the mascot.
 */
export function MascotBalloon({ message, expression = 'angry' }: MascotBalloonProps) {
  const { border, spacing } = useAppTheme();
  // Pointer: a square rotated 45° with only its outer borders, half outside the balloon's left edge.
  const pointer = spacing.s12;

  return (
    <Box flexDirection="row" alignItems="center" gap="s12" accessible accessibilityLabel={message}>
      {/* TODO(motion): mascot popping in and the balloon appearing. */}
      <Mascot size="feedback" expression={expression} />
      <Box flex={1} justifyContent="center">
        <Box
          backgroundColor="surface"
          borderColor="border"
          borderWidth={border.width}
          borderRadius="lg"
          paddingHorizontal="s16"
          paddingVertical="s12"
        >
          <Text variant="body" numberOfLines={2}>
            {message}
          </Text>
        </Box>
        {/* Drawn over the balloon so its fill hides the balloon's border at the pointer base. */}
        <Box
          position="absolute"
          width={pointer}
          height={pointer}
          backgroundColor="surface"
          borderColor="border"
          borderLeftWidth={border.width}
          borderBottomWidth={border.width}
          style={{ left: -pointer / 2 + border.width / 2, transform: [{ rotate: '45deg' }] }}
        />
      </Box>
    </Box>
  );
}
