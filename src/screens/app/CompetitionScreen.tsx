import { EmptyState, Screen } from '@components';

export function CompetitionScreen() {
  return (
    <Screen title="Competição" bottomInset={false}>
      <EmptyState
        icon="trophy-outline"
        title="Nenhum campeonato vinculado"
        description="Campeonatos, plano de água e dieta definidos pelo professor aparecem aqui."
      />
    </Screen>
  );
}
