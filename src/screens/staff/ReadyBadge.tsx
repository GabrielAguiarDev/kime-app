import { Box, Icon, Text } from '@components';
import { useAppTheme } from '@theme';

/** "Pronto para graduar" seal (staff only): icon + text, never color alone. */
export function ReadyBadge() {
  const { size } = useAppTheme();
  return (
    <Box
      flexDirection="row"
      alignItems="center"
      alignSelf="flex-start"
      gap="s4"
      paddingHorizontal="s8"
      paddingVertical="s4"
      borderRadius="sm"
      backgroundColor="accentSelected"
    >
      <Icon name="belt" size={size.badgeIcon} color="accent" active />
      <Text variant="caption" color="accent">
        Pronto para graduar
      </Text>
    </Box>
  );
}
