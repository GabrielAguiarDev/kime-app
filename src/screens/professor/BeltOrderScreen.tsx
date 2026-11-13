import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { BeltSwatch, Box, Button, EmptyState, LoadError, ReorderList, Screen, Text, Spinner } from '@components';
import { beltName, beltsOf, useBeltMutations, useBelts, useModalities, type ModalityBelt } from '@domain/Classes';
import { errorMessage } from '@infra';
import { useActiveGym } from '@services/activeGym';
import { haptics } from '@utils/haptics';

/** Owner: hold and drag the belts of one modality into the graduation order, then save. */
export function BeltOrderScreen() {
  const { modalidade } = useLocalSearchParams<{ modalidade?: string }>();
  const { active } = useActiveGym();
  const modalities = useModalities(active?.gymId);
  const belts = useBelts(active?.gymId);

  // Always render the Screen (its ScrollView) on the first render: iOS only
  // places a scroll view under the large-title header when it is there as the
  // screen appears; mounted later it starts hidden under the header.
  if (!active) {
    return (
      <Screen nativeHeader title="Ordenar faixas" onBack={() => router.back()}>
        <Spinner accessibilityLabel="Carregando" />
      </Screen>
    );
  }
  const modality = modalities.data?.find((m) => m.id === modalidade);
  const list = modality ? beltsOf(belts.data ?? [], modality.id) : [];
  const loading = modalities.isLoading || belts.isLoading;

  return (
    <Screen nativeHeader title="Ordenar faixas" onBack={() => router.back()}>
      {loading ? <Spinner /> : null}
      {modalities.isError || belts.isError ? (
        <LoadError
          title="Não foi possível carregar as faixas"
          onRetry={() => {
            void modalities.refetch();
            void belts.refetch();
          }}
        />
      ) : null}
      {!loading && !modalities.isError && !belts.isError && (!modality || list.length < 2) ? (
        <EmptyState
          visual="icon"
          icon="belt"
          title="Nada para ordenar."
          description="Cadastre pelo menos duas faixas nesta modalidade."
        />
      ) : null}
      {modality && list.length >= 2 ? (
        <OrderEditor
          key={list.map((b) => b.id).join('|')}
          academyId={active.gymId}
          modalityId={modality.id}
          modalityName={modality.name}
          initial={list}
        />
      ) : null}
    </Screen>
  );
}

function OrderEditor({
  academyId,
  modalityId,
  modalityName,
  initial,
}: {
  academyId: string;
  modalityId: string;
  modalityName: string;
  initial: ModalityBelt[];
}) {
  const { reorder } = useBeltMutations(academyId, modalityId);
  const [order, setOrder] = useState(initial);
  const changed = order.some((b, i) => b.id !== initial[i]?.id);

  return (
    <Box gap="s16">
      <Text variant="body" color="textMuted">
        {`Segure uma faixa e arraste até a posição dela na graduação de ${modalityName}. A primeira é a faixa inicial.`}
      </Text>
      <ReorderList
        items={order}
        keyOf={(b) => b.id}
        labelOf={(b) => `Faixa ${beltName(b)}`}
        onChange={setOrder}
        renderItem={(b) => (
          <>
            <BeltSwatch belt={b} />
            <Box flex={1}>
              <Text variant="bodyStrong" numberOfLines={1}>
                {beltName(b)}
              </Text>
              <Text variant="caption">{b.classesRequired ? `${b.classesRequired} aulas` : 'Aulas não definidas'}</Text>
            </Box>
          </>
        )}
      />
      {reorder.error ? (
        <Text variant="caption" color="danger">
          {errorMessage(reorder.error)}
        </Text>
      ) : null}
      <Button
        title="Salvar ordem"
        disabled={!changed}
        loading={reorder.isPending}
        onPress={() =>
          reorder.mutate(
            order.map((b) => b.id),
            {
              onSuccess: () => {
                haptics.success();
                router.back();
              },
            },
          )
        }
      />
    </Box>
  );
}
