import Svg, { Circle } from 'react-native-svg';

import { useAppTheme } from '@theme';

import { Box } from '../Box/Box';
import { Text } from '../Text/Text';

interface WaterRingProps {
  consumedMl: number;
  /** Null without a goal (no weight yet): only the total shows. */
  goalMl: number | null;
  /** Diameter. Default tokens.size.waterRing. */
  size?: number;
  /** Ring only, without the ml in the center (small sizes, e.g. the widget preview). */
  hideLabel?: boolean;
}

const formatMl = (ml: number) => ml.toLocaleString('pt-BR');

/**
 * Water ring (DESIGN-SYSTEM.md, 3.4): stroke 14, track `border`, fill `water`, butt caps.
 * Visual states: in progress (water) and goal reached (success).
 */
export function WaterRing({ consumedMl, goalMl, size, hideLabel = false }: WaterRingProps) {
  const theme = useAppTheme();
  const diameter = size ?? theme.size.waterRing;
  const stroke = hideLabel ? theme.size.widgetRingStroke : theme.size.waterRingStroke;
  const radius = (diameter - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = goalMl && goalMl > 0 ? Math.min(Math.max(consumedMl / goalMl, 0), 1) : 0;
  const goalReached = !!goalMl && goalMl > 0 && consumedMl >= goalMl;
  const fill = goalReached ? theme.colors.success : theme.colors.water;
  const center = diameter / 2;

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
          ? `${formatMl(consumedMl)} de ${formatMl(goalMl)} ml${goalReached ? ', meta batida' : ''}`
          : `${formatMl(consumedMl)} ml hoje`
      }
    >
      <Svg width={diameter} height={diameter} style={{ position: 'absolute' }}>
        <Circle cx={center} cy={center} r={radius} stroke={theme.colors.border} strokeWidth={stroke} fill="none" />
        {/* TODO(motion): ring filling up after water is logged. */}
        {ratio > 0 ? (
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={fill}
            strokeWidth={stroke}
            strokeLinecap="butt"
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - ratio)}
            transform={`rotate(-90 ${center} ${center})`}
          />
        ) : null}
      </Svg>
      {hideLabel ? null : (
        <>
          <Text variant="displayLg">{formatMl(consumedMl)}</Text>
          <Text variant="caption">{goalMl ? `de ${formatMl(goalMl)} ml` : 'ml hoje'}</Text>
        </>
      )}
    </Box>
  );
}
