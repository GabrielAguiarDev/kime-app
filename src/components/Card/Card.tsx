import type { ReactNode } from 'react';
import { Pressable, type GestureResponderEvent } from 'react-native';

import { useAppTheme } from '@theme';
import { haptics } from '@utils/haptics';

import { Box, type BoxProps } from '../Box/Box';

interface CardProps extends BoxProps {
  children: ReactNode;
  /** Makes the card tappable: it gets the 4px bottom edge and sinks on press like the tactile button. */
  onPress?: (e: GestureResponderEvent) => void;
  /** Selected: accent border and accent background at 8%. */
  selected?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
}

/**
 * Card (DESIGN-SYSTEM.md, 3.2): surface, 2px border, radius-lg, padding 16.
 * Outer spacing (margins) applies to the whole card including its edge; everything else styles the face.
 * Visual states: rest, pressed (tappable only), selected, disabled.
 */
export function Card({
  children,
  onPress,
  selected = false,
  disabled = false,
  accessibilityLabel,
  margin,
  marginTop,
  marginBottom,
  marginHorizontal,
  marginVertical,
  ...faceProps
}: CardProps) {
  const theme = useAppTheme();
  const outer = { margin, marginTop, marginBottom, marginHorizontal, marginVertical };

  const face = (pressed: boolean, tappable: boolean) => {
    // TODO(motion): tappable card sinking on press and rising back (same as the tactile button).
    const edgeHeight = tappable && !pressed && !disabled ? theme.border.edgeWidth : 0;
    const offset = tappable ? theme.border.edgeWidth - edgeHeight : 0;
    return (
      <Box style={{ paddingTop: offset }}>
        <Box
          backgroundColor={edgeHeight > 0 ? 'edge' : 'transparent'}
          borderRadius="lg"
          style={{ paddingBottom: edgeHeight }}
        >
          <Box backgroundColor="surface" borderRadius="lg">
            <Box
              backgroundColor={selected ? 'accentSelected' : 'surface'}
              borderRadius="lg"
              borderWidth={theme.border.width}
              borderColor={selected ? 'accent' : 'border'}
              padding="cardPadding"
              {...faceProps}
            >
              {children}
            </Box>
          </Box>
        </Box>
      </Box>
    );
  };

  if (!onPress) return <Box {...outer}>{face(false, false)}</Box>;

  return (
    <Box {...outer}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ selected, disabled }}
        disabled={disabled}
        onPress={(e) => {
          haptics.tap();
          onPress(e);
        }}
      >
        {({ pressed }) => face(pressed, true)}
      </Pressable>
    </Box>
  );
}
