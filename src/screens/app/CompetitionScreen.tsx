import { EmptyState, Screen } from '@components';

export function CompetitionScreen() {
  return (
    <Screen nativeHeader title="Competição" bottomInset={false}>
      <EmptyState
        title="Nenhum campeonato vinculado"
        description="Campeonatos, plano de água e dieta definidos pelo professor aparecem aqui."
      />
    </Screen>
  );
}
