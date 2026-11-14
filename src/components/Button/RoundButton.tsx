import { Pressable } from 'react-native';

import { useAppTheme } from '@theme';
import { haptics } from '@utils/haptics';

import { Box } from '../Box/Box';
import { Icon, type IconName } from '../Icon/Icon';

/**
 * Circular primary tactile button, icon only (e.g. start the timer). Same
 * mechanics as the tactile button (3.1): accent face on a 4px accent-edge
 * that disappears on press, instantly.
 */
export function RoundButton({
  icon,
  accessibilityLabel,
  onPress,
  diameter,
  disabled = false,
}: {
  icon: IconName;
  accessibilityLabel: string;
  onPress: () => void;
  /** Default: 2 × touch target. */
  diameter?: number;
  disabled?: boolean;
}) {
  const theme = useAppTheme();
  const d = diameter ?? theme.size.touchTarget * 2;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
    >
      {({ pressed }) => {
        // TODO(motion): round tactile button sinking on press and rising back.
        const edge = disabled || pressed ? 0 : theme.border.edgeWidth;
        return (
          <Box style={{ paddingTop: theme.border.edgeWidth - edge }}>
            <Box
              // Constant color (the face covers it when the edge is hidden): toggling to 'transparent'
              // and back makes Android drop the border radius, showing a square.
              backgroundColor="accentEdge"
              style={{ borderRadius: d / 2, paddingBottom: edge }}
            >
              <Box
                backgroundColor={disabled ? 'disabled' : 'accent'}
                alignItems="center"
                justifyContent="center"
                style={{ width: d, height: d, borderRadius: d / 2 }}
              >
                <Icon name={icon} color={disabled ? 'textMuted' : 'onAccent'} active size={d * 0.4} />
              </Box>
            </Box>
          </Box>
        );
      }}
    </Pressable>
  );
}
