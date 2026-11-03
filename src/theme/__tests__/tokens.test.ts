import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

import { darkTheme, lightTheme, withAlpha } from '../theme';
import { tokens } from '../tokens';

// Font files aren't needed here (expo-font pulls native asset loading). jest.mock is hoisted.
jest.mock('../fonts', () => ({ fontAssets: {}, fontFamily: jest.requireActual('../tokens').tokens.font.family }));

const root = join(__dirname, '..', '..', '..');

describe('design tokens', () => {
  it('generated files (TS, Swift, Kotlin) are in sync with tokens.json', () => {
    expect(() =>
      execFileSync('node', [join(root, 'scripts/tokens/generate.mjs'), '--check'], { stdio: 'pipe' }),
    ).not.toThrow();
  });

  it('uses the orange accent from the design system', () => {
    expect(lightTheme.colors.accent).toBe('#D9400A');
    expect(darkTheme.colors.accent).toBe('#F05A1E');
  });

  it('light and dark themes expose the same color tokens', () => {
    expect(Object.keys(darkTheme.colors).sort()).toEqual(Object.keys(lightTheme.colors).sort());
  });

  it('derives soft fills from opacity tokens', () => {
    expect(lightTheme.colors.accentSelected).toBe(withAlpha('#D9400A', tokens.opacity.selected));
    expect(withAlpha('#FFFFFF', 0.25)).toBe('rgba(255, 255, 255, 0.25)');
  });
});
