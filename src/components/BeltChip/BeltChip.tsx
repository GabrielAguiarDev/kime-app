import {
  beltColorNeedsOutline,
  beltName,
  BELT_COLOR_KEYS,
  BELT_COLOR_LABEL,
  BELT_EXTRA_COLOR_KEYS,
  BELT_PICKER_ORDER,
} from '@domain/Classes/classesRules';
import type { BeltColorKey, BeltLook } from '@domain/Classes/classesTypes';
import { useAppTheme, type BeltColor } from '@theme';

import { Box } from '../Box/Box';
import { Text } from '../Text/Text';

/** Palette key → design-system color token (2.4). */
export const BELT_COLOR_TOKEN: Record<BeltColorKey, BeltColor> = {
  white: 'beltWhite',
  gray: 'beltGray',
  yellow: 'beltYellow',
  orange: 'beltOrange',
  green: 'beltGreen',
  blue: 'beltBlue',
  purple: 'beltPurple',
  brown: 'beltBrown',
  black: 'beltBlack',
  red: 'beltRed',
  light_gray: 'beltLightGray',
  dark_gray: 'beltDarkGray',
  dark_yellow: 'beltDarkYellow',
  light_green: 'beltLightGreen',
  dark_green: 'beltDarkGreen',
  light_blue: 'beltLightBlue',
  dark_blue: 'beltDarkBlue',
  light_purple: 'beltLightPurple',
  light_brown: 'beltLightBrown',
  dark_red: 'beltDarkRed',
};

type BeltColorOption = { key: BeltColorKey; label: string; token: BeltColor };
const option = (key: BeltColorKey): BeltColorOption => ({ key, label: BELT_COLOR_LABEL[key], token: BELT_COLOR_TOKEN[key] });

/** The main belt colors, in palette order, with their (feminine) names. */
export const BELT_COLORS: BeltColorOption[] = BELT_COLOR_KEYS.map(option);

/** Light/dark shades. */
export const BELT_EXTRA_COLORS: BeltColorOption[] = BELT_EXTRA_COLOR_KEYS.map(option);

/** All 20 colors in the belt sheet order (grouped by family). */
export const BELT_PICKER_COLORS: BeltColorOption[] = BELT_PICKER_ORDER.map(option);

interface BeltSwatchProps {
  belt: BeltLook | null;
  width?: number;
  height?: number;
  /** Takes the full width of its container (belt sheet preview). */
  fill?: boolean;
}

/**
 * Horizontal belt: the main color, with the last 25% on the right in the tip
 * color when there is one. White and black get the `border` outline (2.4).
 * No belt: `disabled`. The same drawing everywhere (chip, trail, history,
 * achievement, belt sheet preview).
 */
export function BeltSwatch({ belt, width, height, fill = false }: BeltSwatchProps) {
  const { size, border } = useAppTheme();
  const outlined = !belt || beltColorNeedsOutline(belt.primary) || (!!belt.tip && beltColorNeedsOutline(belt.tip));
  return (
    <Box
      width={fill ? undefined : (width ?? size.beltChipWidth)}
      alignSelf={fill ? 'stretch' : undefined}
      height={height ?? size.beltChipHeight}
      flexDirection="row"
      overflow="hidden"
      borderWidth={outlined ? border.width : 0}
      borderColor="border"
      backgroundColor={belt ? BELT_COLOR_TOKEN[belt.primary] : 'disabled'}
    >
      {belt?.tip ? (
        <>
          <Box flex={3} />
          <Box flex={1} backgroundColor={BELT_COLOR_TOKEN[belt.tip]} />
        </>
      ) : null}
    </Box>
  );
}

interface BeltChipProps {
  belt: BeltLook;
  /** Overrides the derived name; "" hides the text. */
  label?: string;
}

/** Belt chip (DESIGN-SYSTEM.md, 3.7): 28×10 belt (with its tip) + name in caption. */
export function BeltChip({ belt, label }: BeltChipProps) {
  const name = beltName(belt);
  const text = label ?? name;
  return (
    <Box flexDirection="row" alignItems="center" gap="s8" accessible accessibilityLabel={`Faixa ${name}`}>
      <BeltSwatch belt={belt} />
      {text ? <Text variant="caption">{text}</Text> : null}
    </Box>
  );
}
