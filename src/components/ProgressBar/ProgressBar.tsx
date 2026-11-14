import { useReducedMotion } from 'react-native-reanimated';

import type { BeltColorKey } from '@domain/Classes/classesTypes';
import { useAppTheme } from '@theme';
import { useTweened } from '@utils/useTweened';

import { BELT_COLOR_TOKEN } from '../BeltChip/BeltChip';

import { Box } from '../Box/Box';
import { Text } from '../Text/Text';

interface ProgressBarProps {
  value: number;
  max: number;
  /** Unit shown next to the numbers: "18 / 40 aulas". */
  unit: string;
  /** Fill color from the context: accent or water. */
  color?: 'accent' | 'water';
  /** Belt progress: fill in the next belt's main color (2.4). Wins over `color`. */
  beltColor?: BeltColorKey;
  /** Optional label on the left of the numbers. */
  label?: string;
  /**
   * Fill grows / shrinks smoothly when the value changes (user decision, an
   * exception to section 8; instant with "Reduce motion"). Off by default.
   */
  animated?: boolean;
}

const FILL_MS = 450;

/** Progress bar (DESIGN-SYSTEM.md, 3.3): 14 high, track `border`, 3px shine on top of the fill. */
export function ProgressBar({ value, max, unit, color = 'accent', beltColor, label, animated = false }: ProgressBarProps) {
  const { size, borderRadii } = useAppTheme();
  const target = max > 0 ? Math.min(Math.max(value / max, 0), 1) : 0;
  const reduceMotion = useReducedMotion();
  const ratio = useTweened(target, !animated || reduceMotion, FILL_MS);
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
        {/* Advances to the new value with `animated` (useTweened; reduced motion: instant). */}
        {ratio > 0 ? (
          <Box
            height={size.progressBar}
            borderRadius="progress"
            backgroundColor={beltColor ? BELT_COLOR_TOKEN[beltColor] : color}
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
