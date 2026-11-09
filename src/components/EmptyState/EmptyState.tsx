import type { ReactNode } from 'react';

import { useAppTheme } from '@theme';

import { Box } from '../Box/Box';
import { Icon, type IconName } from '../Icon/Icon';
import { KimiMascot } from '../KimiMascot/KimiMascot';
import { Text } from '../Text/Text';

type EmptyStateVisual =
  /** Default: the animated guard mascot (size `empty`). */
  | { visual?: 'mascot'; icon?: never }
  /** A 48 icon in text-muted, for small spaces (inside a card or a list section). */
  | { visual: 'icon'; icon: IconName };

type EmptyStateProps = EmptyStateVisual & {
  /** Short sentence (body). */
  title: string;
  /** Optional second line, muted. */
  description?: string;
  /** Secondary tactile button, when there is an action. */
  action?: ReactNode;
  /** An error state: the mascot shows the angry brows when it appears. */
  error?: boolean;
};

/** Empty state (DESIGN-SYSTEM.md, 3.11). No illustration other than the mascot. */
export function EmptyState({ title, description, action, visual = 'mascot', icon, error }: EmptyStateProps) {
  const { size } = useAppTheme();
  return (
    <Box alignItems="center" paddingVertical="s32" paddingHorizontal="s16" gap="s12">
      {visual === 'icon' && icon ? (
        <Icon name={icon} size={size.iconEmpty} color="textMuted" />
      ) : (
        <KimiMascot size="empty" animated angry={error} />
      )}
      <Box gap="s4">
        <Text variant="body" textAlign="center">
          {title}
        </Text>
        {description ? (
          <Text variant="body" color="textMuted" textAlign="center">
            {description}
          </Text>
        ) : null}
      </Box>
      {action ? (
        <Box alignSelf="stretch" marginTop="s8">
          {action}
        </Box>
      ) : null}
    </Box>
  );
}
