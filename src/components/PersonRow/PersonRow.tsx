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

/** Compact row for long lists (48 photo, ~72 tall). Group rows inside one surface container. `dense`: smaller photo and height (rankings). */
export function PersonRow({ name, avatarPath, competitor = false, secondary, leading, trailing, actions, onPress, last = false, dense = false, chevron = true }: {
  name: string;
  avatarPath?: string | null;
  /** Trophy badge on the photo. */
  competitor?: boolean;
  secondary?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  actions?: PersonAction[];
  onPress?: () => void;
  last?: boolean;
  dense?: boolean;
  /** Tappable rows show a chevron by default; false keeps the right edge for the trailing content. */
  chevron?: boolean;
}) {
  const theme = useAppTheme();
  const content = (
    <Box minHeight={dense ? 48 : 72} style={{ paddingVertical: dense ? 6 : 12 }} flexDirection="row" alignItems="center" gap="s12"
      borderBottomWidth={last ? 0 : theme.border.width} borderColor="border">
      {leading}
      <Avatar name={name} path={avatarPath} size={dense ? 32 : 48} competitor={competitor} />
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
      {onPress && !actions && chevron ? <Icon name="chevronRight" color="textMuted" /> : null}
    </Box>
  );
  return onPress ? <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={name}>{content}</Pressable> : content;
}

/**
 * The single surface container of a person list (DESIGN-SYSTEM, "Linha de
 * pessoa"): 2px border, radius-lg, side padding only — the rows set the height
 * and draw the dividers. Use it instead of a Card so every list looks the same.
 */
export function PersonList({ children }: { children: ReactNode }) {
  const theme = useAppTheme();
  return (
    <Box backgroundColor="surface" borderColor="border" borderWidth={theme.border.width} borderRadius="lg" paddingHorizontal="s16">
      {children}
    </Box>
  );
}
