import { useAppTheme, useIsDark, type BeltColor } from '@theme';

import { Box } from '../Box/Box';
import { Text } from '../Text/Text';

export type Belt = 'white' | 'gray' | 'yellow' | 'orange' | 'green' | 'blue' | 'purple' | 'brown' | 'black' | 'red';

export const BELTS: Record<Belt, { label: string; color: BeltColor }> = {
  white: { label: 'Branca', color: 'beltWhite' },
  gray: { label: 'Cinza', color: 'beltGray' },
  yellow: { label: 'Amarela', color: 'beltYellow' },
  orange: { label: 'Laranja', color: 'beltOrange' },
  green: { label: 'Verde', color: 'beltGreen' },
  blue: { label: 'Azul', color: 'beltBlue' },
  purple: { label: 'Roxa', color: 'beltPurple' },
  brown: { label: 'Marrom', color: 'beltBrown' },
  black: { label: 'Preta', color: 'beltBlack' },
  red: { label: 'Coral / Vermelha', color: 'beltRed' },
};

interface BeltChipProps {
  belt: Belt;
  /** Overrides the default name (e.g. "Azul · 2 graus"). */
  label?: string;
}

/** Belt chip (DESIGN-SYSTEM.md, 3.7): 28×10 rectangle in the belt color + name in caption. */
export function BeltChip({ belt, label }: BeltChipProps) {
  const { size, border } = useAppTheme();
  const isDark = useIsDark();
  const b = BELTS[belt];
  // White always gets a border; black only in the dark theme.
  const outlined = belt === 'white' || (belt === 'black' && isDark);
  return (
    <Box flexDirection="row" alignItems="center" gap="s8" accessible accessibilityLabel={`Faixa ${label ?? b.label}`}>
      <Box
        width={size.beltChipWidth}
        height={size.beltChipHeight}
        backgroundColor={b.color}
        borderWidth={outlined ? border.width : 0}
        borderColor="border"
      />
      <Text variant="caption">{label ?? b.label}</Text>
    </Box>
  );
}
