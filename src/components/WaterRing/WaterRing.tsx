import Svg, { Circle } from 'react-native-svg';

import { useAppTheme } from '@theme';

import { Box } from '../Box/Box';
import { Text } from '../Text/Text';

interface WaterRingProps {
  consumedMl: number;
  goalMl: number;
  /** Diameter. Default tokens.size.waterRing. */
  size?: number;
}

const formatMl = (ml: number) => ml.toLocaleString('pt-BR');

/**
 * Water ring (DESIGN-SYSTEM.md, 3.4): stroke 14, track `border`, fill `water`, butt caps.
 * Visual states: in progress (water) and goal reached (success).
 */
export function WaterRing({ consumedMl, goalMl, size }: WaterRingProps) {
  const theme = useAppTheme();
  const diameter = size ?? theme.size.waterRing;
  const stroke = theme.size.waterRingStroke;
  const radius = (diameter - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = goalMl > 0 ? Math.min(Math.max(consumedMl / goalMl, 0), 1) : 0;
  const goalReached = goalMl > 0 && consumedMl >= goalMl;
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
      accessibilityValue={{ min: 0, max: goalMl, now: Math.min(consumedMl, goalMl) }}
      accessibilityLabel={`${formatMl(consumedMl)} de ${formatMl(goalMl)} ml${goalReached ? ', meta batida' : ''}`}
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
      <Text variant="displayLg">{formatMl(consumedMl)}</Text>
      <Text variant="caption">de {formatMl(goalMl)} ml</Text>
    </Box>
  );
}
