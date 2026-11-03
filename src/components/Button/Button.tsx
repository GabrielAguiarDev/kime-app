import { ActivityIndicator, Pressable, type PressableProps } from 'react-native';

import { useAppTheme, type ColorToken } from '@theme';

import { Box } from '../Box/Box';
import { Icon, type IconName } from '../Icon/Icon';
import { Text } from '../Text/Text';

export type ButtonVariant = 'primary' | 'secondary' | 'success';

/**
 * Visual state of the tactile button. Each one is a separate static style —
 * there is no animation between them.
 *  - rest:     raised, darker bottom edge visible
 *  - pressed:  edge collapses, face moves down by the edge height
 *  - disabled: flat, muted
 *  - loading:  rest look with spinner, not pressable
 */
export type ButtonVisualState = 'rest' | 'pressed' | 'disabled' | 'loading';

const VARIANTS: Record<
  ButtonVariant,
  { fill: ColorToken; edge: ColorToken; text: ColorToken; border?: ColorToken }
> = {
  primary: { fill: 'primary', edge: 'primaryEdge', text: 'textOnPrimary' },
  success: { fill: 'success', edge: 'successEdge', text: 'textOnStatus' },
  secondary: { fill: 'neutralFill', edge: 'neutralEdge', text: 'text', border: 'border' },
};

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  title: string;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
}

export function Button({
  title,
  variant = 'primary',
  icon,
  loading = false,
  disabled,
  ...pressableProps
}: ButtonProps) {
  const { edge, colors } = useAppTheme();
  const v = VARIANTS[variant];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: loading }}
      accessibilityLabel={title}
      disabled={isDisabled}
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
        // TODO(motion): animate edge collapse + face translateY between rest and pressed.
        const edgeHeight = state === 'pressed' || state === 'disabled' ? 0 : edge.tactile;
        const offset = edge.tactile - edgeHeight;

        return (
          <Box style={{ paddingTop: offset }}>
            <Box
              backgroundColor={state === 'disabled' ? 'surfaceMuted' : v.edge}
              borderRadius="m"
              style={{ paddingBottom: edgeHeight }}
            >
              <Box
                backgroundColor={state === 'disabled' ? 'surfaceMuted' : v.fill}
                borderRadius="m"
                borderWidth={v.border ? 1 : 0}
                borderColor={v.border ?? 'transparent'}
                minHeight={52}
                paddingHorizontal="s20"
                flexDirection="row"
                alignItems="center"
                justifyContent="center"
                gap="s8"
              >
                {state === 'loading' ? (
                  <ActivityIndicator color={colors[v.text]} />
                ) : (
                  <>
                    {icon ? (
                      <Icon name={icon} size={20} color={state === 'disabled' ? 'textMuted' : v.text} />
                    ) : null}
                    <Text variant="button" color={state === 'disabled' ? 'textMuted' : v.text}>
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
