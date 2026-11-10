import { useAppTheme, type ColorToken } from '@theme';

import { Box } from '../Box/Box';
import { Icon, type IconName } from '../Icon/Icon';
import { Text } from '../Text/Text';

export type Status = 'pending' | 'confirmed' | 'rejected';

const STATUS: Record<Status, { bg: ColorToken; fg: ColorToken; icon: IconName; label: string }> = {
  pending: { bg: 'badgePending', fg: 'text', icon: 'clock', label: 'Pendente' },
  confirmed: { bg: 'badgeConfirmed', fg: 'success', icon: 'check', label: 'Confirmado' },
  rejected: { bg: 'badgeRejected', fg: 'danger', icon: 'rejected', label: 'Recusado' },
};

interface StatusBadgeProps {
  status: Status;
  /** Overrides the default label ("Pendente", "Confirmado", "Recusado"). */
  label?: string;
  /** Overrides the default icon. */
  icon?: IconName;
}

/** Status badge (DESIGN-SYSTEM.md, 3.6): radius-sm, caption, 14 icon on the left. Never color alone. */
export function StatusBadge({ status, label, icon }: StatusBadgeProps) {
  const { size } = useAppTheme();
  const s = STATUS[status];
  return (
    // TODO(motion): badge changing from pending to confirmed.
    <Box
      flexDirection="row"
      alignItems="center"
      alignSelf="flex-start"
      gap="s4"
      paddingHorizontal="s8"
      paddingVertical="s4"
      borderRadius="sm"
      backgroundColor={s.bg}
    >
      <Icon name={icon ?? s.icon} size={size.badgeIcon} color={s.fg} />
      <Text variant="caption" color={s.fg}>
        {label ?? s.label}
      </Text>
    </Box>
  );
}
