import { Button } from '../Button/Button';
import { EmptyState } from '../EmptyState/EmptyState';

/**
 * A screen or section whose data did not load (offline, server error):
 * offline icon, the sentence and "Tentar de novo".
 */
export function LoadError({ title, onRetry }: { title: string; onRetry: () => void }) {
  return (
    <EmptyState
      visual="icon"
      icon="offline"
      title={title}
      action={<Button title="Tentar de novo" variant="secondary" onPress={onRetry} />}
    />
  );
}
