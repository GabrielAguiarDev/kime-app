import { useAppTheme, type BeltColor } from '@theme';

import { Box } from '../Box/Box';
import { Text } from '../Text/Text';

interface ProgressBarProps {
  value: number;
  max: number;
  /** Unit shown next to the numbers: "18 / 40 aulas". */
  unit: string;
  /** Fill color from the context: accent, water or a belt color. */
  color?: 'accent' | 'water' | BeltColor;
  /** Optional label on the left of the numbers. */
  label?: string;
}

/** Progress bar (DESIGN-SYSTEM.md, 3.3): 14 high, track `border`, 3px shine on top of the fill. */
export function ProgressBar({ value, max, unit, color = 'accent', label }: ProgressBarProps) {
  const { size, borderRadii } = useAppTheme();
  const ratio = max > 0 ? Math.min(Math.max(value / max, 0), 1) : 0;
  const numbers = `${value} / ${max} ${unit}`;

  return (
    <Box
      gap="s8"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label ? `${label}: ${numbers}` : numbers}
      accessibilityValue={{ min: 0, max, now: Math.min(value, max) }}
    >
      <Box flexDirection="row" justifyContent="space-between" alignItems="baseline" gap="s8">
        {label ? <Text variant="caption">{label}</Text> : <Box />}
        <Text variant="bodyStrong">{numbers}</Text>
      </Box>
      <Box height={size.progressBar} borderRadius="progress" backgroundColor="border" overflow="hidden">
        {/* TODO(motion): belt/progress bar advancing to the new value. */}
        {ratio > 0 ? (
          <Box
            height={size.progressBar}
            borderRadius="progress"
            backgroundColor={color}
            style={{ width: `${ratio * 100}%` }}
          >
            <Box
              position="absolute"
              backgroundColor="progressShine"
              height={size.progressShine}
              borderRadius="progress"
              style={{
                top: size.progressShine,
                left: borderRadii.progress,
                right: borderRadii.progress,
              }}
            />
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}
