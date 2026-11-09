import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { Box, KimiMascot, useKimiAnimates } from '@components';

/** How long the intro stays after the animation starts. The `intro` animation in kimi.riv should fit in it. */
export const INTRO_MS = 3000;
/** The animation never started (slow or broken file): give up after this. */
const INTRO_START_TIMEOUT_MS = 2000;

/**
 * App opening (every cold start, for everyone, signed in or not): right after
 * the splash, over the first screen, the mascot plays `intro` (smoke bomb →
 * ninja → angry eyes), then this layer goes away. Not shown when the mascot is
 * static (no kimi.riv yet, or "Reduce motion" on): nothing to play.
 * `onDone` must be stable (useCallback): it is an effect dependency.
 */
export function AppIntro({ onDone }: { onDone: () => void }) {
  const animates = useKimiAnimates();
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!animates) {
      onDone();
      return;
    }
    const id = setTimeout(onDone, started ? INTRO_MS : INTRO_START_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [animates, started, onDone]);

  if (!animates) return null;
  return (
    <Box style={StyleSheet.absoluteFill} backgroundColor="bg" alignItems="center" justifyContent="center" accessibilityViewIsModal>
      <KimiMascot size="hero" play="intro" onStart={() => setStarted(true)} />
    </Box>
  );
}
