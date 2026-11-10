import { useState, type ReactNode } from 'react';
import { Pressable } from 'react-native';

import { BottomSheet, Box, Icon, Text } from '@components';
import { RANKING_CONFIG } from '@domain/Ranking';
import { SheetForm } from '@screens/professor/shared';
import { useAppTheme } from '@theme';

const pct = (weight: number) => `${Math.round(weight * 100)}%`;

/** "Muay Thai · últimos 28 dias" and the "i" button that explains the score. */
export function RankingHeader({ modalityName }: { modalityName: string }) {
  const { size } = useAppTheme();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Box flexDirection="row" alignItems="center" gap="s8">
        <Text variant="bodyStrong" flex={1} numberOfLines={1}>
          {modalityName} · últimos {RANKING_CONFIG.rollingDays} dias
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Como funciona a pontuação"
          onPress={() => setOpen(true)}
          style={{ width: size.touchTarget, height: size.touchTarget, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="info" color="textMuted" />
        </Pressable>
      </Box>
      <BottomSheet visible={open} onRequestClose={() => setOpen(false)}>
        <SheetForm title="Como funciona a pontuação">
          <Rule title={`Presença · ${pct(RANKING_CONFIG.attendanceWeight)}`}>
            Aulas confirmadas em relação às aulas da grade da modalidade. Ir a todas as aulas da semana vale 100%.
          </Rule>
          <Rule title={`Constância de água · ${pct(RANKING_CONFIG.hydrationWeight)}`}>
            Dias em que você bateu a sua meta de água. Conta a meta cumprida, nunca o volume.
          </Rule>
          <Rule title={`Mínimo de ${RANKING_CONFIG.eligibility.minEligibleDays} dias`}>
            Só entra no ranking quem tem pelo menos {RANKING_CONFIG.eligibility.minEligibleDays} dias na modalidade
            dentro do período. Antes disso, o aluno fica em classificação.
          </Rule>
          <Rule title="Desempate">
            Com a mesma pontuação, fica na frente quem confirmou mais aulas no período; depois, quem tem a maior
            constância de água.
          </Rule>
          <Text variant="caption">
            O ranking é recalculado todo dia com os últimos {RANKING_CONFIG.rollingDays} dias completos (o dia de hoje
            ainda não conta).
          </Text>
        </SheetForm>
      </BottomSheet>
    </>
  );
}

function Rule({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box gap="s4">
      <Text variant="bodyStrong">{title}</Text>
      <Text variant="body" color="textMuted">{children}</Text>
    </Box>
  );
}
