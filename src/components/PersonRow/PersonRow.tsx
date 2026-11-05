import type { ReactNode } from 'react';
import { Pressable } from 'react-native';

import { useAppTheme } from '@theme';

import { Avatar } from '../Avatar/Avatar';
import { Box } from '../Box/Box';
import { Icon, type IconName } from '../Icon/Icon';
import { Text } from '../Text/Text';

export interface PersonAction {
  icon: IconName;
  label: string;
  onPress: () => void;
  color?: 'accent' | 'danger' | 'textMuted';
  disabled?: boolean;
}

/** Compact row for long lists. Group rows inside one surface container. */
export function PersonRow({ name, avatarPath, secondary, leading, trailing, actions, onPress, last = false }: {
  name: string;
  avatarPath?: string | null;
  secondary?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  actions?: PersonAction[];
  onPress?: () => void;
  last?: boolean;
}) {
  const theme = useAppTheme();
  const content = (
    <Box minHeight={60} style={{ paddingVertical: 10 }} flexDirection="row" alignItems="center" gap="s12"
      borderBottomWidth={last ? 0 : theme.border.width} borderColor="border">
      {leading}
      <Avatar name={name} path={avatarPath} size={40} />
      <Box flex={1} gap="s4">
        <Text variant="bodyStrong" numberOfLines={1}>{name}</Text>
        {typeof secondary === 'string' ? <Text variant="caption" numberOfLines={1}>{secondary}</Text> : secondary}
      </Box>
      {trailing}
      {actions?.map((action) => (
        <Pressable key={action.label} accessibilityRole="button" accessibilityLabel={action.label}
          disabled={action.disabled} onPress={action.onPress}
          style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surfaceRaised }}>
          <Icon name={action.icon} color={action.color ?? 'textMuted'} active={action.color === 'accent'} />
        </Pressable>
      ))}
      {onPress && !actions ? <Icon name="chevronRight" color="textMuted" /> : null}
    </Box>
  );
  return onPress ? <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={name}>{content}</Pressable> : content;
}
