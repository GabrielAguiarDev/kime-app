import { router } from 'expo-router';

import { Card, EmptyState, LoadError, Screen, Spinner } from '@components';
import { usePendingRequests } from '@domain/Membership';
import { useActiveGym } from '@services/activeGym';

import { RequestCard } from './RequestCard';

/** Staff: join requests waiting (from the Início notice and the Equipe banner). */
export function RequestsScreen() {
  const { active } = useActiveGym();
  const requests = usePendingRequests(active?.gymId);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <Screen nativeHeader title="Pedidos de entrada" onBack={back}>
      {requests.isLoading ? <Spinner accessibilityLabel="Carregando" /> : null}
      {requests.isError ? (
        <LoadError title="Não foi possível carregar os pedidos" onRetry={() => void requests.refetch()} />
      ) : null}
      {requests.data?.length === 0 ? (
        <EmptyState title="Nenhum pedido pendente." description="Quem entrar com o código da academia aparece aqui." />
      ) : null}
      <Card>
        {requests.data?.map((request, index) => <RequestCard key={request.membershipId} request={request} last={index === requests.data!.length - 1} />)}
      </Card>
    </Screen>
  );
}
