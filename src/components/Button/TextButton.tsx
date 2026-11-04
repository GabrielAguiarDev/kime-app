import { Button, type ButtonProps, type GhostColor } from './Button';

interface TextButtonProps extends Omit<ButtonProps, 'variant' | 'ghostColor'> {
  /** Default `accent` (3.1). `danger` only for destructive actions. */
  color?: GhostColor;
}

/** Low-emphasis action: the "Fantasma" (ghost) variant of the tactile button (3.1). */
export function TextButton({ color = 'accent', ...props }: TextButtonProps) {
  return <Button variant="ghost" ghostColor={color} {...props} />;
}
