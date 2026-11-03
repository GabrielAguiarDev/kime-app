import { Image } from 'expo-image';

import { useAppTheme } from '@theme';

// Brand SVGs (DESIGN-SYSTEM.md, section 4). Never recolor, distort, or add outlines/shadows.
const SOURCES = {
  angry: require('../../../assets/brand/kimi-mascot.svg'),
  celebrating: require('../../../assets/brand/kimi-mascot-celebrating.svg'),
} as const;

export type MascotExpression = keyof typeof SOURCES;

/** 160 on milestone/onboarding screens, 96 in empty states, 56 in the feedback sheet. */
export type MascotSize = 'hero' | 'empty' | 'feedback';

interface MascotProps {
  size: MascotSize;
  /** `angry` is the default expression; `celebrating` (round eyes) for the feedback sheet. */
  expression?: MascotExpression;
}

/** Kimi mascot. Only in empty states, the feedback sheet, onboarding and milestone screens. Never in lists, regular cards or the tab bar. */
export function Mascot({ size, expression = 'angry' }: MascotProps) {
  const { size: sizes } = useAppTheme();
  const px = { hero: sizes.mascotHero, empty: sizes.mascotEmpty, feedback: sizes.mascotFeedback }[size];
  return (
    <Image
      source={SOURCES[expression]}
      style={{ width: px, height: px }}
      contentFit="contain"
      accessible={false}
    />
  );
}
