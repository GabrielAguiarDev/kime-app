import type { ReactNode } from 'react';

import { useAppTheme } from '@theme';

import { Box, type BoxProps } from '../Box/Box';

interface CardProps extends BoxProps {
  children: ReactNode;
}

/**
 * Static surface with the same darker bottom edge language as buttons.
 * Outer spacing (margins) applies to the whole card including its edge;
 * everything else styles the face.
 */
export function Card({
  children,
  margin,
  marginTop,
  marginBottom,
  marginHorizontal,
  marginVertical,
  ...faceProps
}: CardProps) {
  const { edge } = useAppTheme();
  return (
    <Box
      backgroundColor="neutralEdge"
      borderRadius="l"
      style={{ paddingBottom: edge.tactile }}
      margin={margin}
      marginTop={marginTop}
      marginBottom={marginBottom}
      marginHorizontal={marginHorizontal}
      marginVertical={marginVertical}
    >
      <Box
        backgroundColor="surface"
        borderRadius="l"
        borderWidth={1}
        borderColor="border"
        padding="s16"
        {...faceProps}
      >
        {children}
      </Box>
    </Box>
  );
}
