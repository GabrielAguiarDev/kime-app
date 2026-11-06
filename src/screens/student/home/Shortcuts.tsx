import { Pressable } from 'react-native';

import { Box, Icon, Text, type IconName } from '@components';
import { useAppTheme } from '@theme';
import { haptics } from '@utils/haptics';

export interface Shortcut {
  key: string;
  icon: IconName;
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
  color?: 'accent' | 'water';
}

/** One row of round secondary tactile buttons (icon) with a short label under each. */
export function Shortcuts({ items }: { items: Shortcut[] }) {
  return (
    <Box flexDirection="row" justifyContent="space-between">
      {items.map(({ key, ...item }) => (
        <ShortcutButton key={key} {...item} />
      ))}
    </Box>
  );
}

function ShortcutButton({ icon, label, accessibilityLabel, onPress, disabled = false, color = 'accent' }: Omit<Shortcut, 'key'>) {
  const theme = useAppTheme();
  const d = theme.size.button + theme.spacing.s8;
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
      style={{ flex: 1, alignItems: 'center' }}
    >
      {({ pressed }) => {
        // TODO(motion): shortcut sinking on press and rising back.
        const edge = disabled || pressed ? 0 : theme.border.edgeWidth;
        return (
          <Box alignItems="center" gap="s8">
            <Box style={{ paddingTop: theme.border.edgeWidth - edge }}>
              <Box backgroundColor={edge > 0 ? 'edge' : 'transparent'} style={{ borderRadius: d / 2, paddingBottom: edge }}>
                <Box
                  backgroundColor={disabled ? 'disabled' : 'surface'}
                  borderColor={disabled ? 'disabled' : 'border'}
                  borderWidth={theme.border.width}
                  alignItems="center"
                  justifyContent="center"
                  style={{ width: d, height: d, borderRadius: d / 2 }}
                >
                  <Icon name={icon} color={disabled ? 'textMuted' : color} active={!disabled} />
                </Box>
              </Box>
            </Box>
            <Text variant="caption" color={disabled ? 'textMuted' : 'text'}>
              {label}
            </Text>
          </Box>
        );
      }}
    </Pressable>
  );
}
