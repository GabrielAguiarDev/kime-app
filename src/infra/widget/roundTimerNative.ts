import { requireOptionalNativeModule } from 'expo';

import type { NativeTimerPlan } from '@domain/Timer/timerRules';

/**
 * Native round timer engine (modules/kimi-widget): iOS RoundTimerEngine (bells + Live Activity +
 * fallback notifications), Android RoundTimerService (fixed notification + bells). It plays and
 * shows the timer without JavaScript, in the background and with the screen locked.
 * Builds without these functions: `available` is false and the timer runs silent, in the app only.
 */

/** Buttons of the Live Activity (iOS) / fixed notification (Android). */
export type RoundTimerCommand = 'pause' | 'resume' | 'skip';

interface RoundTimerModule {
  roundTimerSync?: (json: string) => Promise<boolean>;
  roundTimerStop?: () => Promise<void>;
  addListener?: (
    event: 'onRoundTimerCommand',
    listener: (payload: { action: string }) => void,
  ) => { remove: () => void };
}

const native = requireOptionalNativeModule<RoundTimerModule>('KimiWidget');

const COMMANDS: readonly string[] = ['pause', 'resume', 'skip'] satisfies RoundTimerCommand[];

export const roundTimerNative = {
  available: typeof native?.roundTimerSync === 'function',
  sync: (plan: NativeTimerPlan): Promise<boolean> =>
    native?.roundTimerSync?.(JSON.stringify(plan)) ?? Promise.resolve(false),
  stop: (): Promise<void> => native?.roundTimerStop?.() ?? Promise.resolve(),
  /** Pause / resume / skip pressed outside the app (lock screen, Dynamic Island, notification). */
  onCommand: (listener: (command: RoundTimerCommand) => void): { remove: () => void } =>
    native?.addListener?.('onRoundTimerCommand', ({ action }) => {
      if (COMMANDS.includes(action)) listener(action as RoundTimerCommand);
    }) ?? { remove: () => undefined },
};
