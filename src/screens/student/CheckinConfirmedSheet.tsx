import { BottomSheet, Box, Button, Mascot, Text } from '@components';
import { useAppTheme } from '@theme';

interface CheckinConfirmedSheetProps {
  /** Confirmed check-ins since the last visit; null hides the sheet. */
  count: number | null;
  total: number;
  onClose: () => void;
}

/**
 * Feedback for a confirmed check-in (3.10 content, success tone) shown in a
 * bottom sheet because Início already owns the screen footer.
 */
export function CheckinConfirmedSheet({ count, total, onClose }: CheckinConfirmedSheetProps) {
  const theme = useAppTheme();
  const title = count && count > 1 ? `${count} check-ins confirmados.` : 'Check-in confirmado.';

  return (
    <BottomSheet visible={count !== null} onRequestClose={onClose} dismissLabel="Continuar">
      <Box
        backgroundColor="feedbackSuccess"
        borderTopWidth={theme.border.width}
        borderColor="success"
        borderRadius="lg"
        padding="s16"
        gap="s16"
        marginBottom="s16"
        accessibilityLiveRegion="polite"
      >
        <Box flexDirection="row" alignItems="center" gap="s12">
          <Mascot size="feedback" expression="celebrating" />
          <Box flex={1} gap="s4">
            <Text variant="heading" accessibilityRole="header">
              {title}
            </Text>
            <Text variant="body">{`${total} ${total === 1 ? 'aula confirmada' : 'aulas confirmadas'} no total.`}</Text>
          </Box>
        </Box>
      </Box>
      <Button title="Continuar" onPress={onClose} />
    </BottomSheet>
  );
}
