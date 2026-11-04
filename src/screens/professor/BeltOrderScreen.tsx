import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { BeltSwatch, Box, Button, EmptyState, ReorderList, Screen, Text } from '@components';
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

  if (!active) return null;
  const modality = modalities.data?.find((m) => m.id === modalidade);
  const list = modality ? beltsOf(belts.data ?? [], modality.id) : [];
  const loading = modalities.isLoading || belts.isLoading;

  return (
    <Screen nativeHeader title="Ordenar faixas" onBack={() => router.back()}>
      {loading ? <ActivityIndicator /> : null}
      {!loading && (!modality || list.length < 2) ? (
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
