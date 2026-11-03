import { Box } from '../Box/Box';
import { Text } from '../Text/Text';

interface BigCounterProps {
  value: number | string;
  /** Shown in caps under the number: "DIAS PARA O CAMPEONATO". */
  label: string;
}

/** Big counter (DESIGN-SYSTEM.md, 3.5): number in display-xl + caption label in caps. */
export function BigCounter({ value, label }: BigCounterProps) {
  return (
    <Box alignItems="center" accessible accessibilityLabel={`${value} ${label}`}>
      {/* TODO(motion): countdown number flipping when it changes. */}
      <Text variant="displayXl">{value}</Text>
      <Text variant="captionCaps">{label}</Text>
    </Box>
  );
}
