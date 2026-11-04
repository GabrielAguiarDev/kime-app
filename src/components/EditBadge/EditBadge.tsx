import { useAppTheme } from '@theme';

import { Box } from '../Box/Box';
import { Icon } from '../Icon/Icon';

/**
 * Pencil badge on the bottom-right corner of an editable image (profile
 * photo, academy logo): the image itself is the button that edits it.
 * Place it inside a relatively positioned wrapper around the image.
 */
export function EditBadge() {
  const { size, border } = useAppTheme();
  const px = size.avatarSmall * 0.75;
  return (
    <Box
      position="absolute"
      right={-px / 6}
      bottom={-px / 6}
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
}
