import { requireOptionalNativeModule } from 'expo';

import type { NativeTimerPlan } from '@domain/Timer/timerRules';

/**
 * Native round timer engine (modules/kimi-widget): iOS RoundTimerEngine (bells + Live Activity),
 * Android RoundTimerService (fixed notification + bells). It plays and shows the timer without
 * JavaScript, in the background and with the screen locked.
 * Builds without these functions: `available` is false and the timer runs silent, in the app only.
 */
interface RoundTimerModule {
  roundTimerSync?: (json: string) => Promise<boolean>;
  roundTimerStop?: () => Promise<void>;
}

const native = requireOptionalNativeModule<RoundTimerModule>('KimiWidget');

export const roundTimerNative = {
  available: typeof native?.roundTimerSync === 'function',
  sync: (plan: NativeTimerPlan): Promise<boolean> =>
    native?.roundTimerSync?.(JSON.stringify(plan)) ?? Promise.resolve(false),
  stop: (): Promise<void> => native?.roundTimerStop?.() ?? Promise.resolve(),
};
