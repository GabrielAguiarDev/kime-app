export interface WheelOption<T extends string | number> {
  value: T;
  label: string;
}

export interface WheelPickerProps<T extends string | number> {
  options: WheelOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
}

/** Five rows visible, the selected one in the middle. */
export const WHEEL_VISIBLE_ROWS = 5;
