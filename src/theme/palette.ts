/**
 * Raw palette. Never use directly in components — use semantic tokens from the theme.
 * Proposal derived from the product spec (no design source yet): neutral graphite/off-white
 * base, a single strong red accent.
 */
export const palette = {
  graphite950: '#0C0D0F',
  graphite900: '#121417',
  graphite850: '#1C1F24',
  graphite800: '#262A31',
  graphite700: '#2F343C',
  graphite500: '#5C6168',
  graphite400: '#9AA0A8',
  graphite200: '#D9D9D5',
  graphite100: '#E9E9E6',
  offWhite: '#F4F4F2',
  white: '#FFFFFF',

  red500: '#E10600',
  red400: '#F2241B',
  red700: '#A30400',
  red800: '#7A0300',
  red50: '#FCE6E5',
  red950: '#2A0B0A',

  green500: '#1F9D55',
  green700: '#157A41',
  green50: '#E3F4EA',
  green950: '#0E2418',

  amber500: '#E8A317',
  amber700: '#B47C0A',
  amber50: '#FCF3DD',
  amber950: '#2A1F07',

  // Belt colors (used only to personalize the user's own profile).
  beltWhite: '#F1F1EE',
  beltBlue: '#1F4FB8',
  beltPurple: '#6B2FA3',
  beltBrown: '#6B4423',
  beltBlack: '#16171A',
} as const;
