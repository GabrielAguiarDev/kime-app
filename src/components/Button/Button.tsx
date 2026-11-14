import { Pressable, type GestureResponderEvent, type PressableProps } from 'react-native';

import { useAppTheme, type ColorToken } from '@theme';
import { haptics } from '@utils/haptics';

import { Box } from '../Box/Box';
import { Icon, type IconName } from '../Icon/Icon';
import { Text } from '../Text/Text';
import { Spinner } from '../Spinner/Spinner';

export type ButtonVariant = 'primary' | 'water' | 'secondary' | 'danger' | 'ghost';

/** Ghost buttons may use a muted or danger text for low-priority / destructive links. */
/** 3.1: ghost text is accent; danger only for destructive actions. */
export type GhostColor = Extract<ColorToken, 'accent' | 'danger'>;

/**
 * Visual state of the tactile button (DESIGN-SYSTEM.md, 3.1). Each one is a separate static
 * style — changes are instant, with no transition.
 *  - rest:     raised, solid bottom edge (4px) visible
 *  - pressed:  face moves down 4px and the edge disappears ("sinks")
 *  - disabled: `disabled` fill, no edge, muted text
 *  - loading:  rest look with a spinner, not pressable
 */
export type ButtonVisualState = 'rest' | 'pressed' | 'disabled' | 'loading';

type VariantStyle = { fill: ColorToken; edge: ColorToken | null; text: ColorToken; border?: ColorToken };

const VARIANTS: Record<Exclude<ButtonVariant, 'ghost'>, VariantStyle> = {
  primary: { fill: 'accent', edge: 'accentEdge', text: 'onAccent' },
  water: { fill: 'water', edge: 'waterEdge', text: 'onWater' },
  secondary: { fill: 'surface', edge: 'edge', text: 'text', border: 'border' },
  danger: { fill: 'danger', edge: 'dangerEdge', text: 'onDanger' },
};

/** Pressed fill of the ghost variant, matching its text color. */
const GHOST_PRESSED: Record<GhostColor, ColorToken> = {
  accent: 'accentSelected',
  danger: 'badgeRejected',
};

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  title: string;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
  /** Full width by default (3.1). */
  fullWidth?: boolean;
  /** Text color for the ghost variant only (default `accent`). */
  ghostColor?: GhostColor;
}

export function Button({
  title,
  variant = 'primary',
  icon,
  loading = false,
  fullWidth = true,
  ghostColor = 'accent',
  disabled,
  onPress,
  ...pressableProps
}: ButtonProps) {
  const theme = useAppTheme();
  const isDisabled = !!disabled || loading;
  const isGhost = variant === 'ghost';
  const v: VariantStyle = isGhost
    ? { fill: 'transparent', edge: null, text: ghostColor }
    : VARIANTS[variant];

  const handlePress = (e: GestureResponderEvent) => {
    haptics.tap();
    onPress?.(e);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      accessibilityLabel={title}
      disabled={isDisabled}
      onPress={handlePress}
      style={{ alignSelf: fullWidth ? 'stretch' : 'flex-start' }}
      {...pressableProps}
    >
      {({ pressed }) => {
        const state: ButtonVisualState = loading
          ? 'loading'
          : disabled
            ? 'disabled'
            : pressed
              ? 'pressed'
              : 'rest';
        // TODO(motion): tactile button sinking on press (edge collapses, face moves down) and rising back.
        const edgeHeight = v.edge && (state === 'rest' || state === 'loading') ? theme.border.edgeWidth : 0;
        // Keeps the total height constant: what the edge loses goes on top.
        const offset = v.edge ? theme.border.edgeWidth - edgeHeight : 0;
        const faceColor: ColorToken =
          state === 'disabled' && !isGhost
            ? 'disabled'
            : isGhost && state === 'pressed'
              ? GHOST_PRESSED[ghostColor]
              : v.fill;
        const textColor: ColorToken = state === 'disabled' ? 'textMuted' : v.text;

        return (
          <Box style={{ paddingTop: offset }}>
            <Box
              // Constant color (the face covers it when the edge is hidden): toggling to 'transparent'
              // and back makes Android drop the border radius, showing square corners.
              backgroundColor={v.edge ?? 'transparent'}
              borderRadius="md"
              style={{ paddingBottom: edgeHeight }}
            >
              <Box
                backgroundColor={faceColor}
                borderRadius="md"
                borderWidth={v.border && state !== 'disabled' ? theme.border.width : 0}
                borderColor={v.border ?? 'transparent'}
                minHeight={theme.size.button}
                paddingHorizontal="s20"
                flexDirection="row"
                alignItems="center"
                justifyContent="center"
                gap="s8"
              >
                {state === 'loading' ? (
                  <Spinner color={theme.colors[v.text]} />
                ) : (
                  <>
                    {icon ? <Icon name={icon} color={textColor} /> : null}
                    <Text variant="button" color={textColor}>
                      {title}
                    </Text>
                  </>
                )}
              </Box>
            </Box>
          </Box>
        );
      }}
    </Pressable>
  );
}
