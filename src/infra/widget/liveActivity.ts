import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

/**
 * Round timer Live Activity (iOS 16.2+, modules/kimi-widget + targets/widgets/RoundTimerActivity.swift).
 * No-op on Android and on builds without the native functions.
 */
interface LiveActivityModule {
  startRoundTimerActivity?: (json: string) => boolean;
  endRoundTimerActivity?: () => void;
}

const native = Platform.OS === 'ios' ? requireOptionalNativeModule<LiveActivityModule>('KimiWidget') : null;

export interface RoundTimerActivityState {
  title: string;
  phase: 'prep' | 'round' | 'rest' | 'done';
  round: number;
  rounds: number;
  /** Epoch ms when the current phase ends. */
  endsAtMs: number;
  paused: boolean;
  remainingSeconds: number;
  warning: boolean;
}

export const roundTimerActivity = {
  /** Starts or updates the activity; false when unavailable or turned off by the user. */
  update: (state: RoundTimerActivityState): boolean => native?.startRoundTimerActivity?.(JSON.stringify(state)) ?? false,
  end: (): void => native?.endRoundTimerActivity?.(),
};
