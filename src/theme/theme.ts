import { createTheme } from '@shopify/restyle';

import { palette } from './palette';
import { fontFamily } from './fonts';

/**
 * Semantic color tokens. Each "fill" color has a `*Edge` companion: the darker
 * bottom border that gives tactile buttons/cards their depth.
 */
const lightColors = {
  background: palette.offWhite,
  surface: palette.white,
  surfaceMuted: palette.graphite100,
  border: palette.graphite200,
  borderStrong: palette.graphite400,

  text: palette.graphite900,
  textMuted: palette.graphite500,
  textOnPrimary: palette.white,
  textOnStatus: palette.white,

  primary: palette.red500,
  primaryEdge: palette.red700,
  primarySoft: palette.red50,

  // "Recusado"/errors share the accent hue but always come with icon + text,
  // never as a filled button (filled red is reserved for the primary action).
  danger: palette.red500,
  dangerSoft: palette.red50,

  success: palette.green500,
  successEdge: palette.green700,
  successSoft: palette.green50,

  warning: palette.amber500,
  warningEdge: palette.amber700,
  warningSoft: palette.amber50,

  neutralFill: palette.white,
  neutralEdge: palette.graphite200,

  tabIcon: palette.graphite400,
  tabIconActive: palette.red500,

  transparent: 'transparent',

  beltWhite: palette.beltWhite,
  beltBlue: palette.beltBlue,
  beltPurple: palette.beltPurple,
  beltBrown: palette.beltBrown,
  beltBlack: palette.beltBlack,
};

export type ColorToken = keyof typeof lightColors;

const darkColors: Record<ColorToken, string> = {
  ...lightColors,
  background: palette.graphite900,
  surface: palette.graphite850,
  surfaceMuted: palette.graphite800,
  border: palette.graphite700,
  borderStrong: palette.graphite500,

  text: palette.offWhite,
  textMuted: palette.graphite400,

  primary: palette.red400,
  primaryEdge: palette.red700,
  primarySoft: palette.red950,

  danger: palette.red400,
  dangerSoft: palette.red950,

  successSoft: palette.green950,
  warningSoft: palette.amber950,

  neutralFill: palette.graphite850,
  neutralEdge: palette.graphite950,

  tabIcon: palette.graphite500,
  tabIconActive: palette.red400,
};

export const lightTheme = createTheme({
  colors: lightColors,
  spacing: {
    none: 0,
    s2: 2,
    s4: 4,
    s8: 8,
    s12: 12,
    s16: 16,
    s20: 20,
    s24: 24,
    s32: 32,
    s40: 40,
    s56: 56,
  },
  // Slightly rounded everywhere. No pill shapes.
  borderRadii: {
    none: 0,
    s: 6,
    m: 8,
    l: 12,
  },
  // Height of the darker bottom edge on tactile elements.
  edge: {
    tactile: 4,
  },
  textVariants: {
    defaults: {
      fontFamily: fontFamily.regular,
      fontSize: 16,
      lineHeight: 22,
      color: 'text',
    },
    // Big condensed numbers: ml, days, classes.
    displayXL: {
      fontFamily: fontFamily.condensedExtraBold,
      fontSize: 72,
      lineHeight: 74,
      color: 'text',
    },
    display: {
      fontFamily: fontFamily.condensedExtraBold,
      fontSize: 48,
      lineHeight: 52,
      color: 'text',
    },
    number: {
      fontFamily: fontFamily.condensedBold,
      fontSize: 28,
      lineHeight: 32,
      color: 'text',
    },
    title: {
      fontFamily: fontFamily.condensedBold,
      fontSize: 32,
      lineHeight: 36,
      color: 'text',
      textTransform: 'uppercase',
    },
    heading: {
      fontFamily: fontFamily.bold,
      fontSize: 20,
      lineHeight: 26,
      color: 'text',
    },
    body: {
      fontFamily: fontFamily.regular,
      fontSize: 16,
      lineHeight: 22,
      color: 'text',
    },
    bodyBold: {
      fontFamily: fontFamily.semiBold,
      fontSize: 16,
      lineHeight: 22,
      color: 'text',
    },
    caption: {
      fontFamily: fontFamily.medium,
      fontSize: 13,
      lineHeight: 18,
      color: 'textMuted',
    },
    label: {
      fontFamily: fontFamily.condensedBold,
      fontSize: 14,
      lineHeight: 18,
      letterSpacing: 0.8,
      color: 'textMuted',
      textTransform: 'uppercase',
    },
    button: {
      fontFamily: fontFamily.condensedBold,
      fontSize: 18,
      lineHeight: 22,
      letterSpacing: 0.8,
      color: 'text',
      textTransform: 'uppercase',
    },
  },
  breakpoints: {},
});

export type Theme = typeof lightTheme;

export const darkTheme: Theme = {
  ...lightTheme,
  colors: darkColors as Theme['colors'],
};
