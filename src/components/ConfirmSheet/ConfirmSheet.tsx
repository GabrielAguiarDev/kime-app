import { BottomSheet } from '../BottomSheet/BottomSheet';
import { Box } from '../Box/Box';
import { Button } from '../Button/Button';
import { TextButton } from '../Button/TextButton';
import { Text } from '../Text/Text';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel: string;
  /** `danger` for destructive actions (sign out, remove); `primary` otherwise. */
  tone?: 'primary' | 'danger';
  cancelLabel?: string;
}

interface ConfirmSheetProps extends ConfirmOptions {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onClosed?: () => void;
  /** See BottomSheet: present in landscape too. */
  allowLandscape?: boolean;
}

/** Confirmation in the app's language: a bottom sheet with one action and "Cancelar". */
export function ConfirmSheet({
  visible,
  title,
  message,
  confirmLabel,
  tone = 'primary',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
  onClosed,
  allowLandscape,
}: ConfirmSheetProps) {
  return (
    <BottomSheet visible={visible} onRequestClose={onCancel} onClosed={onClosed} dismissLabel={cancelLabel} allowLandscape={allowLandscape}>
      <Box gap="s24">
        <Box gap="s8">
          <Text variant="heading" accessibilityRole="header">
            {title}
          </Text>
          <Text variant="body" color="textMuted">
            {message}
          </Text>
        </Box>
        <Box gap="s12">
          <Button title={confirmLabel} variant={tone} onPress={onConfirm} />
          <TextButton title={cancelLabel} onPress={onCancel} />
        </Box>
      </Box>
    </BottomSheet>
  );
}
