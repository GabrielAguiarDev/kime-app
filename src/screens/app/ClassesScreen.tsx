import { EmptyState, Screen } from '@components';

export function ClassesScreen() {
  return (
    <Screen title="Aulas" bottomInset={false}>
      <EmptyState
        icon="calendar-outline"
        title="Nenhum horário ainda"
        description="Os horários da academia e o check-in aparecem aqui."
      />
    </Screen>
  );
}
