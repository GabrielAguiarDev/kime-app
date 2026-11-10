import { Pressable } from 'react-native';

import { useAppTheme } from '@theme';

import { Box } from '../Box/Box';
import { Icon } from '../Icon/Icon';

/**
 * Pencil badge on the bottom-right corner of an editable image (profile
 * photo, academy logo). Without `onPress` the image itself is the button that
 * edits it; with `onPress` the badge is the button (the image can do something
 * else, e.g. open the photo), with a touch area of at least the touch target
 * while it keeps its size. Place it inside a relatively positioned wrapper.
 */
export function EditBadge({
  onPress,
  accessibilityLabel,
  disabled,
  inset = 0,
}: {
  onPress?: () => void;
  accessibilityLabel?: string;
  disabled?: boolean;
  /** Padding of the wrapper around the image (the badge stays on the image's corner). */
  inset?: number;
} = {}) {
  const { size, border } = useAppTheme();
  const px = size.avatarSmall * 0.75;
  const badge = (
    <Box
      position={onPress ? undefined : 'absolute'}
      right={onPress ? undefined : -px / 6}
      bottom={onPress ? undefined : -px / 6}
      width={px}
      height={px}
      backgroundColor="accent"
      borderWidth={border.width}
      borderColor="bg"
      alignItems="center"
      justifyContent="center"
      style={{ borderRadius: px / 2 }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Icon name="edit" color="onAccent" />
    </Box>
  );
  if (!onPress) return badge;
  // Same look; the touch area grows around it to the touch target and a bit more.
  const slop = Math.max(0, (size.touchTarget - px) / 2) + 4;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={slop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={{ position: 'absolute', right: inset - px / 6, bottom: inset - px / 6 }}
    >
      {badge}
    </Pressable>
  );
}
