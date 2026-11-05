import { requireOptionalNativeModule } from 'expo';
import type * as AudioModule from 'expo-audio';

/**
 * Round timer sounds (expo-audio, SDK 58). Loaded only when the native module
 * exists (a dev client built before expo-audio was added just stays silent).
 *
 * Audio session:
 *  - plays in silent mode (playsInSilentMode);
 *  - stays active in the background / locked screen (shouldPlayInBackground +
 *    the plugin's background audio mode), kept alive by a silent loop while
 *    the timer runs;
 *  - mixes with other apps' music and DUCKS it (lowers, never stops) only
 *    while a bell/clapper plays, then lets it back up.
 */
export type TimerSoundName = 'roundStart' | 'roundEnd' | 'warning';

const SOURCES: Record<TimerSoundName | 'silence', number> = {
  roundStart: require('../../../assets/sounds/bell.wav'),
  roundEnd: require('../../../assets/sounds/bell-triple.wav'),
  warning: require('../../../assets/sounds/clapper.wav'),
  silence: require('../../../assets/sounds/silence.wav'),
};

/** How long each sound lasts (ms): ducking is released after it. */
const DURATION_MS: Record<TimerSoundName, number> = { roundStart: 2200, roundEnd: 3100, warning: 600 };

const available = !!requireOptionalNativeModule('ExpoAudio');

function lib(): typeof AudioModule | null {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return available ? (require('expo-audio') as typeof AudioModule) : null;
}

type Player = ReturnType<typeof AudioModule.createAudioPlayer>;
let players: Record<TimerSoundName | 'silence', Player> | null = null;
let duckUntil = 0;
let unduckTimer: ReturnType<typeof setTimeout> | null = null;

export const timerAudioAvailable = available;

async function mode(duck: boolean): Promise<void> {
  await lib()?.setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    interruptionMode: duck ? 'duckOthers' : 'mixWithOthers',
  });
}

/** Loads the sounds and starts the silent keep-alive loop. */
export async function startTimerAudio(): Promise<void> {
  const A = lib();
  if (!A) return;
  await mode(false);
  if (!players) {
    players = {
      roundStart: A.createAudioPlayer(SOURCES.roundStart),
      roundEnd: A.createAudioPlayer(SOURCES.roundEnd),
      warning: A.createAudioPlayer(SOURCES.warning),
      silence: A.createAudioPlayer(SOURCES.silence),
    };
  }
  players.silence.loop = true;
  players.silence.volume = 0;
  players.silence.play();
}

export async function playTimerSound(name: TimerSoundName): Promise<void> {
  if (!players) return;
  const until = Date.now() + DURATION_MS[name];
  if (Date.now() >= duckUntil) await mode(true);
  duckUntil = Math.max(duckUntil, until);
  const player = players[name];
  await player.seekTo(0);
  player.play();
  if (unduckTimer) clearTimeout(unduckTimer);
  unduckTimer = setTimeout(() => {
    unduckTimer = null;
    void mode(false);
  }, duckUntil - Date.now());
}

/** Stops the keep-alive and frees the players. */
export async function stopTimerAudio(): Promise<void> {
  if (unduckTimer) clearTimeout(unduckTimer);
  unduckTimer = null;
  duckUntil = 0;
  if (players) {
    for (const p of Object.values(players)) {
      p.pause();
      p.remove();
    }
    players = null;
  }
  await lib()?.setAudioModeAsync({ shouldPlayInBackground: false, interruptionMode: 'mixWithOthers' });
}
