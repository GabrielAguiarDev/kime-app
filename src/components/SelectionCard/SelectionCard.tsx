import type { ReactNode } from 'react';

import { Box } from '../Box/Box';
import { Card } from '../Card/Card';
import { Text } from '../Text/Text';

interface SelectionCardProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Shown before the label (e.g. a BeltChip without label). */
  leading?: ReactNode;
  /** Second line, muted. */
  description?: string;
  disabled?: boolean;
  accessibilityLabel?: string;
  /** Takes the remaining width in a row/wrap grid. */
  flex?: number;
}

/**
 * Selection card (DESIGN-SYSTEM.md, 11.5): choices in forms are tappable cards
 * (3D edge), not lists or dropdowns. Selected: accent border + accent at 8%.
 */
export function SelectionCard({
  label,
  selected,
  onPress,
  leading,
  description,
  disabled,
  accessibilityLabel,
  flex,
}: SelectionCardProps) {
  return (
    <Box flex={flex}>
      <Card
        onPress={onPress}
        selected={selected}
        disabled={disabled}
        accessibilityLabel={accessibilityLabel ?? label}
        flexDirection="row"
        alignItems="center"
        justifyContent={leading ? 'flex-start' : 'center'}
        gap="s12"
      >
        {leading}
        <Box flexShrink={1} alignItems={leading ? 'flex-start' : 'center'}>
          <Text variant="bodyStrong" color={selected ? 'accent' : 'text'}>
            {label}
          </Text>
          {description ? <Text variant="caption">{description}</Text> : null}
        </Box>
      </Card>
    </Box>
  );
}
