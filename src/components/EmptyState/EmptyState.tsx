import type { ReactNode } from 'react';

import { Box } from '../Box/Box';
import { Icon, type IconName } from '../Icon/Icon';
import { Text } from '../Text/Text';

interface EmptyStateProps {
  icon: IconName;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <Box alignItems="center" paddingVertical="s40" paddingHorizontal="s16" gap="s12">
      <Box
        width={64}
        height={64}
        borderRadius="l"
        backgroundColor="surfaceMuted"
        alignItems="center"
        justifyContent="center"
      >
        <Icon name={icon} size={30} color="textMuted" />
      </Box>
      <Text variant="heading" textAlign="center">
        {title}
      </Text>
      {description ? (
        <Text variant="body" color="textMuted" textAlign="center">
          {description}
        </Text>
      ) : null}
      {action ? <Box alignSelf="stretch" marginTop="s8">{action}</Box> : null}
    </Box>
  );
}
