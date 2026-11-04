import { ScrollView } from 'react-native';

import { useAppTheme } from '@theme';

import { Box } from '../Box/Box';
import { SelectionCard } from '../SelectionCard/SelectionCard';

interface ChoiceRowProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
}

/**
 * One choice among a few (e.g. the modality whose trail is shown): selection
 * cards (11.5) in a horizontal row, scrolling sideways when they do not fit.
 * No scroll bars (3.12).
 */
export function ChoiceRow<T extends string>({ options, value, onChange, accessibilityLabel }: ChoiceRowProps<T>) {
  const { spacing } = useAppTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="tablist"
      // Full-bleed: the row scrolls under the screen margins.
      style={{ marginHorizontal: -spacing.screenMargin }}
      contentContainerStyle={{ paddingHorizontal: spacing.screenMargin, gap: spacing.s8 }}
    >
      {options.map((o) => (
        <Box key={o.value}>
          <SelectionCard label={o.label} selected={o.value === value} onPress={() => onChange(o.value)} />
        </Box>
      ))}
    </ScrollView>
  );
}
