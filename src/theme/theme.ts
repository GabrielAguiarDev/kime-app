import { createTheme } from '@shopify/restyle';
import type { TextStyle } from 'react-native';

import { fontFamily } from './fonts';
import { tokens } from './tokens';

type Scheme = 'light' | 'dark';

/** `#RRGGBB` + opacity token → rgba(). Use only with values from tokens.opacity. */
export function withAlpha(hex: string, opacity: number): string {
  const v = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function buildColors(scheme: Scheme) {
  const c = tokens.color[scheme];
  const { opacity } = tokens;
  const belt = tokens.color.belt;
  return {
    ...c,
    ...tokens.color.on,

    // Soft fills (section 3): selected card, status badges, feedback sheet, progress shine.
    accentSelected: withAlpha(c.accent, opacity.selected),
    // Dims the screen behind a confirmation sheet.
    scrim: withAlpha(c.edge, opacity.scrim),
    badgePending: withAlpha(c.warning, opacity.badgePending),
    badgeConfirmed: withAlpha(c.success, opacity.badgeConfirmed),
    badgeRejected: withAlpha(c.danger, opacity.badgeRejected),
    feedbackAccent: withAlpha(c.accent, opacity.feedback),
    feedbackWater: withAlpha(c.water, opacity.feedback),
    feedbackSuccess: withAlpha(c.success, opacity.feedback),
    feedbackWarning: withAlpha(c.warning, opacity.feedback),
    feedbackDanger: withAlpha(c.danger, opacity.feedback),
    progressShine: withAlpha(tokens.color.on.shine, opacity.shine),

    beltWhite: belt.white,
    beltGray: belt.gray,
    beltYellow: belt.yellow,
    beltOrange: belt.orange,
    beltGreen: belt.green,
    beltBlue: belt.blue,
    beltPurple: belt.purple,
    beltBrown: belt.brown,
    beltBlack: belt.black,
    beltRed: belt.red,
    // Extra shades ("Mais cores" in the belt sheet).
    beltLightGray: belt.lightGray,
    beltDarkGray: belt.darkGray,
    beltDarkYellow: belt.darkYellow,
    beltLightGreen: belt.lightGreen,
    beltDarkGreen: belt.darkGreen,
    beltLightBlue: belt.lightBlue,
    beltDarkBlue: belt.darkBlue,
    beltLightPurple: belt.lightPurple,
    beltLightBrown: belt.lightBrown,
    beltDarkRed: belt.darkRed,

    // Ranking podium medals (fixed in both schemes; dark text on top).
    medalGold: tokens.color.medal.gold,
    medalGoldEdge: tokens.color.medal.goldEdge,
    medalSilver: tokens.color.medal.silver,
    medalSilverEdge: tokens.color.medal.silverEdge,
    medalBronze: tokens.color.medal.bronze,
    medalBronzeEdge: tokens.color.medal.bronzeEdge,

    transparent: 'transparent',
  };
}

const lightColors = buildColors('light');
export type ColorToken = keyof typeof lightColors;
const darkColors: Record<ColorToken, string> = buildColors('dark');

type ScaleName = keyof typeof tokens.font.scale;

/** Every text uses tabular figures so numbers don't jump when they change. */
const TABULAR: TextStyle['fontVariant'] = ['tabular-nums'];

function textVariant(name: ScaleName) {
  const t: (typeof tokens.font.scale)[ScaleName] & { letterSpacing?: number; uppercase?: boolean } =
    tokens.font.scale[name];
  return {
    fontFamily: fontFamily[t.family],
    fontSize: t.size,
    lineHeight: t.lineHeight,
    fontVariant: TABULAR,
    color: 'text' as const,
    ...(t.letterSpacing ? { letterSpacing: t.letterSpacing } : {}),
    ...(t.uppercase ? { textTransform: 'uppercase' as const } : {}),
  };
}

export const lightTheme = createTheme({
  colors: lightColors,
  spacing: { none: 0, ...tokens.space },
  // Slightly rounded everywhere. Never pill-shaped (the progress bar radius is the only half-height one).
  borderRadii: { none: 0, ...tokens.radius },
  border: tokens.border,
  size: tokens.size,
  opacity: tokens.opacity,
  textVariants: {
    defaults: textVariant('body'),
    displayXl: textVariant('displayXl'),
    /** Round timer: digits readable across the room (shrinks to fit the width). */
    timer: textVariant('timer'),
    displayLg: textVariant('displayLg'),
    title: textVariant('title'),
    heading: textVariant('heading'),
    body: textVariant('body'),
    bodyStrong: textVariant('bodyStrong'),
    /** Top bar counters (11.1): Barlow Condensed 700, 20. */
    counter: textVariant('counter'),
    caption: { ...textVariant('caption'), color: 'textMuted' as const },
    /** Caption in caps: big-counter labels and section labels. */
    captionCaps: { ...textVariant('caption'), color: 'textMuted' as const, textTransform: 'uppercase' as const },
    button: textVariant('button'),
    /** Native header: compact title (iOS/Android) and large title (iOS). */
    navTitle: textVariant('navTitle'),
    navLargeTitle: textVariant('navLargeTitle'),
  },
  breakpoints: {},
});

export type Theme = typeof lightTheme;

export const darkTheme: Theme = {
  ...lightTheme,
  colors: darkColors as Theme['colors'],
};

export type BeltColor = Extract<ColorToken, `belt${string}`>;
