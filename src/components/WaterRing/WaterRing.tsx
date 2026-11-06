import { useReducedMotion } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { waterDayState } from '@domain/Water';
import { useAppTheme } from '@theme';
import { useTweened } from '@utils/useTweened';

import { Box } from '../Box/Box';
import { Text } from '../Text/Text';

interface WaterRingProps {
  consumedMl: number;
  /** Null without a goal (no weight yet): only the total shows. */
  goalMl: number | null;
  isLimit?: boolean;
  /** Diameter. Default tokens.size.waterRing. */
  size?: number;
  /** Ring only, without the ml in the center (small sizes, e.g. the widget preview). */
  hideLabel?: boolean;
}

const formatMl = (ml: number) => ml.toLocaleString('pt-BR');

// Motion (user decision: the ring filling is an exception to "no animations", see 8).
const FILL_MS = 700;

/**
 * Water ring (DESIGN-SYSTEM.md, 3.4): stroke 14, track `border`, fill `water`, butt caps.
 * Visual states: in progress (water) and goal reached (success).
 * The fill grows / shrinks smoothly when the amount changes (instant with
 * "Reduce motion"); it opens already at the current value.
 */
export function WaterRing({ consumedMl, goalMl, isLimit = false, size, hideLabel = false }: WaterRingProps) {
  const theme = useAppTheme();
  const diameter = size ?? theme.size.waterRing;
  const stroke = hideLabel ? theme.size.widgetRingStroke : theme.size.waterRingStroke;
  const radius = (diameter - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = goalMl && goalMl > 0 ? Math.min(Math.max(consumedMl / goalMl, 0), 1) : 0;
  const state = waterDayState(consumedMl, goalMl, isLimit);
  const fill = state === 'over' ? theme.colors.warning : state === 'done' ? theme.colors.success : theme.colors.water;
  const center = diameter / 2;

  const shown = useTweened(ratio, useReducedMotion(), FILL_MS);

  return (
    <Box
      width={diameter}
      height={diameter}
      alignItems="center"
      justifyContent="center"
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={goalMl ? { min: 0, max: goalMl, now: Math.min(consumedMl, goalMl) } : undefined}
      accessibilityLabel={
        goalMl
          ? `${formatMl(consumedMl)} de ${formatMl(goalMl)} ml${state === 'over' ? ', você passou do limite de hoje' : state === 'done' ? (isLimit ? ', limite cumprido' : ', meta batida') : ''}`
          : `${formatMl(consumedMl)} ml hoje`
      }
    >
      <Svg width={diameter} height={diameter} style={{ position: 'absolute' }}>
        <Circle cx={center} cy={center} r={radius} stroke={theme.colors.border} strokeWidth={stroke} fill="none" />
        {shown > 0 ? (
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={fill}
            strokeWidth={stroke}
            strokeLinecap="butt"
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - shown)}
            transform={`rotate(-90 ${center} ${center})`}
          />
        ) : null}
      </Svg>
      {hideLabel ? null : (
        <Box width={Math.max(0, diameter - stroke * 2 - 32)} alignItems="center" gap="s4">
          <Text variant="displayLg" textAlign="center" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
            {formatMl(consumedMl)}
          </Text>
          <Text variant="caption" textAlign="center">
            {goalMl ? `${isLimit ? 'Limite' : 'Meta'} de hoje` : 'ml hoje'}
          </Text>
          {goalMl ? (
            <Text variant="bodyStrong" textAlign="center" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
              {formatMl(goalMl)} ml
            </Text>
          ) : null}
        </Box>
      )}
    </Box>
  );
}
