import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable } from 'react-native';

import { BottomSheet, Box, Card, Icon, LoadError, Screen, Text } from '@components';
import type { Modality } from '@domain/Classes';
import {
  fightDetails,
  fightTitle,
  formatLocalDate,
  formatTally,
  hasMedals,
  MEDALS,
  placementLabel,
  recordsByModality,
  tallyAccessibilityLabel,
  tallyFights,
  useCartel,
  type ChampionshipResult,
  type Fight,
  type FightRecord,
  type FightTally,
  type Medal,
  type MedalCount,
  type Placement,
  type PreviousRecord,
} from '@domain/Competition';
import { SheetForm } from '@screens/professor/shared';
import { useActiveGym } from '@services/activeGym';
import { useActiveModality } from '@services/activeModality';
import { useSession } from '@services/session';
import { useAppTheme } from '@theme';
import { useMyFinance } from '@screens/finance/StudentFinance';

/**
 * Medal colors come from the belt palette (no medal tokens in the design
 * system): gold = yellow belt, silver = light gray, bronze = light brown.
 */
const MEDAL_COLOR = { gold: 'beltYellow', silver: 'beltLightGray', bronze: 'beltLightBrown' } as const;
const MEDAL_NAMES: Record<Medal, [string, string]> = {
  gold: ['ouro', 'ouros'],
  silver: ['prata', 'pratas'],
  bronze: ['bronze', 'bronzes'],
};

/** "8 · 2 · 1" in display-lg with Vitórias / Derrotas / Empates under each number. */
export function FightTallyDisplay({ tally }: { tally: FightTally }) {
  const stats: [number, string][] = [
    [tally.wins, 'Vitórias'],
    [tally.losses, 'Derrotas'],
    [tally.draws, 'Empates'],
  ];
  return (
    <Box
      flexDirection="row"
      justifyContent="center"
      alignItems="flex-start"
      gap="s12"
      accessible
      accessibilityLabel={tallyAccessibilityLabel(tally)}
    >
      {stats.map(([value, label], index) => (
        <Box key={label} flexDirection="row" alignItems="flex-start" gap="s12">
          {index > 0 ? (
            <Text variant="displayLg" color="textMuted">
              ·
            </Text>
          ) : null}
          <Box alignItems="center">
            <Text variant="displayLg">{value}</Text>
            <Text variant="caption">{label}</Text>
          </Box>
        </Box>
      ))}
    </Box>
  );
}

/** Medals won: one chip per kind with its count (nothing when there are none). */
export function MedalRow({ medals }: { medals: MedalCount }) {
  if (!hasMedals(medals)) return null;
  const label = MEDALS.filter((m) => medals[m] > 0)
    .map((m) => `${medals[m]} ${MEDAL_NAMES[m][medals[m] === 1 ? 0 : 1]}`)
    .join(', ');
  return (
    <Box flexDirection="row" justifyContent="center" gap="s16" accessible accessibilityLabel={`Medalhas: ${label}`}>
      {MEDALS.filter((m) => medals[m] > 0).map((m) => (
        <Box key={m} flexDirection="row" alignItems="center" gap="s4">
          <Icon name="medal" color={MEDAL_COLOR[m]} active />
          <Text variant="bodyStrong">{medals[m]}</Text>
        </Box>
      ))}
    </Box>
  );
}

/** Placement inline: medal icon + "Ouro" / "Prata" / "Bronze" / "Sem pódio". */
export function PlacementTag({ placement }: { placement: Placement }) {
  return (
    <Box flexDirection="row" alignItems="center" gap="s4">
      {placement !== 'none' ? <Icon name="medal" color={MEDAL_COLOR[placement]} active size={16} /> : null}
      <Text variant="caption">{placementLabel(placement)}</Text>
    </Box>
  );
}

/** Secondary line of a person row: placement and the tally of that championship. */
export function ResultLine({ placement, tally }: { placement: Placement | null; tally: FightTally }) {
  const fought = tally.wins + tally.losses + tally.draws > 0;
  if (!placement && !fought) return <Text variant="caption">Sem resultados registrados</Text>;
  return (
    <Box flexDirection="row" alignItems="center" gap="s8">
      {placement ? <PlacementTag placement={placement} /> : null}
      {fought ? (
        <Text variant="caption" accessibilityLabel={tallyAccessibilityLabel(tally)}>
          {formatTally(tally)}
        </Text>
      ) : null}
    </Box>
  );
}

/** Summary card of one modality: name (optional), tally and medals. */
export function FightRecordCard({ record, title }: { record: FightRecord; title?: string }) {
  return (
    <Card gap="s16">
      {title ? (
        <Text variant="captionCaps" textAlign="center">
          {title}
        </Text>
      ) : null}
      <FightTallyDisplay tally={record} />
      <MedalRow medals={record} />
      {record.championships === 0 ? (
        <Text variant="caption" textAlign="center">
          Nenhum campeonato realizado ainda.
        </Text>
      ) : null}
    </Card>
  );
}

/** One fight: "Vitória · Finalização", stage and opponent, note. */
export function FightRow({ fight, onPress, last }: { fight: Fight; onPress?: () => void; last?: boolean }) {
  const details = fightDetails(fight);
  return (
    <Card onPress={onPress} accessibilityLabel={[fightTitle(fight), details, fight.note].filter(Boolean).join(', ')}
      flexDirection="row" alignItems="center" gap="s12" marginBottom={last ? undefined : 's8'}>
      <Box flex={1} gap="s4">
        <Text variant="bodyStrong" color={fight.result === 'win' ? 'success' : fight.result === 'loss' ? 'danger' : 'text'}>
          {fightTitle(fight)}
        </Text>
        {details ? <Text variant="caption">{details}</Text> : null}
        {fight.note ? <Text variant="body" color="textMuted">{fight.note}</Text> : null}
      </Box>
      {onPress ? <Icon name="edit" color="textMuted" /> : null}
    </Card>
  );
}

/** Discreet seal of a previous championship (recorded by staff, before the app). */
export function PreviousSeal() {
  return (
    <Box alignSelf="flex-start" paddingHorizontal="s8" paddingVertical="s4" borderRadius="sm" backgroundColor="surfaceRaised">
      <Text variant="caption" color="textMuted">
        Registro anterior
      </Text>
    </Box>
  );
}

const BEFORE_KIMI = 'Antes do Kimi';

/** "Vitórias, derrotas e empates" + medals of the previous record, for screen readers. */
function previousAccessibilityLabel(record: PreviousRecord): string {
  const medals = MEDALS.filter((m) => record[m] > 0)
    .map((m) => `${record[m]} ${MEDAL_NAMES[m][record[m] === 1 ? 0 : 1]}`)
    .join(', ');
  return [`${BEFORE_KIMI}: ${tallyAccessibilityLabel(record)}`, medals ? `medalhas: ${medals}` : null].filter(Boolean).join('; ');
}

/** Medals inline and small (one icon + count per kind). */
function InlineMedals({ medals }: { medals: MedalCount }) {
  if (!hasMedals(medals)) return null;
  return (
    <Box flexDirection="row" alignItems="center" gap="s8">
      {MEDALS.filter((m) => medals[m] > 0).map((m) => (
        <Box key={m} flexDirection="row" alignItems="center" gap="s4">
          <Icon name="medal" color={MEDAL_COLOR[m]} active size={16} />
          <Text variant="caption" color="text">
            {medals[m]}
          </Text>
        </Box>
      ))}
    </Box>
  );
}

/** "Antes do Kimi" (card): the summarized previous record of a modality. */
export function BeforeKimiCard({ record, onPress }: { record: PreviousRecord; onPress?: () => void }) {
  return (
    <Card onPress={onPress} accessibilityLabel={previousAccessibilityLabel(record)} flexDirection="row" alignItems="center" gap="s12">
      <Box flex={1} gap="s4">
        <Text variant="bodyStrong">{BEFORE_KIMI}</Text>
        <Box flexDirection="row" alignItems="center" gap="s12">
          <Text variant="caption" color="text">
            {formatTally(record)}
          </Text>
          <InlineMedals medals={record} />
        </Box>
      </Box>
      {onPress ? <Icon name="edit" color="textMuted" /> : null}
    </Card>
  );
}

/** A held championship in the history: name, date, placement and tally; opens its fights. */
export function ChampionshipResultRow({ result, onPress }: { result: ChampionshipResult; onPress: () => void }) {
  const tally = tallyFights(result.fights);
  return (
    <Card
      onPress={onPress}
      accessibilityLabel={[result.name, formatLocalDate(result.eventDate), result.isHistorical ? 'registro anterior' : null]
        .filter(Boolean)
        .join(', ')}
      flexDirection="row" alignItems="center" gap="s12">
      <Box flex={1} gap="s4">
        <Text variant="bodyStrong">{result.name}</Text>
        <Text variant="caption">{formatLocalDate(result.eventDate)}</Text>
        <ResultLine placement={result.placement} tally={tally} />
        {result.isHistorical ? <PreviousSeal /> : null}
      </Box>
      <Icon name="chevronRight" color="textMuted" />
    </Card>
  );
}

/** Read-only fights of one championship (sheet). */
function ChampionshipFightsSheet({ result, onClose }: { result: ChampionshipResult | null; onClose: () => void }) {
  return (
    <BottomSheet visible={!!result} onRequestClose={onClose}>
      {result ? (
        <SheetForm title={result.name} tall>
          <Text variant="caption">
            {[formatLocalDate(result.eventDate), result.location || null].filter(Boolean).join(' · ')}
          </Text>
          {result.isHistorical ? <PreviousSeal /> : null}
          {result.placement ? <PlacementTag placement={result.placement} /> : null}
          {result.fights.length === 0 ? (
            <Text variant="body" color="textMuted">
              Nenhuma luta registrada neste campeonato.
            </Text>
          ) : (
            <Box>
              {result.fights.map((f, i) => (
                <FightRow key={f.id} fight={f} last={i === result.fights.length - 1} />
              ))}
            </Box>
          )}
        </SheetForm>
      ) : null}
    </BottomSheet>
  );
}

/**
 * "Cartel" of an athlete, per modality, for the athlete themself and staff:
 * tally in display-lg, medals and the championships held (each opens its
 * fights). `modalityIds` are the modalities to show even without results
 * (where the athlete competes now).
 */
export function FightRecordSection({
  academyId,
  athleteId,
  modalities,
  modalityIds,
  only,
  title = 'Cartel',
}: {
  academyId: string;
  athleteId: string;
  modalities: Modality[];
  modalityIds: string[];
  /** Show just this modality. */
  only?: string;
  /** Section title; null = none (the Cartel screen has it in the header). */
  title?: string | null;
}) {
  const cartel = useCartel(academyId, athleteId);
  const [open, setOpen] = useState<ChampionshipResult | null>(null);
  const records = cartel.ready
    ? recordsByModality(cartel.history ?? [], modalityIds, cartel.previous).filter((r) => !only || r.modalityId === only)
    : [];
  const nameOf = (id: string) => modalities.find((m) => m.id === id)?.name ?? 'Modalidade removida';

  if (!cartel.ready && !cartel.isLoading && !cartel.isError) return null;
  if (cartel.ready && records.length === 0) return null;

  return (
    <Box gap="s12">
      {title ? <Text variant="captionCaps">{title}</Text> : null}
      {cartel.isLoading ? <ActivityIndicator accessibilityLabel="Carregando cartel" /> : null}
      {cartel.isError ? <LoadError title="Não foi possível carregar o cartel" onRetry={cartel.refetch} /> : null}
      {records.map((record) => {
        // Previous and app championships together, newest first; the previous record last.
        const championships = (cartel.history ?? []).filter((h) => h.modalityId === record.modalityId);
        const before = cartel.previous?.find((p) => p.modalityId === record.modalityId);
        return (
          <Box key={record.modalityId} gap="s8">
            <FightRecordCard record={record} title={nameOf(record.modalityId)} />
            {championships.map((c) => (
              <ChampionshipResultRow key={c.entryId} result={c} onPress={() => setOpen(c)} />
            ))}
            {before ? <BeforeKimiCard record={before} /> : null}
          </Box>
        );
      })}
      <ChampionshipFightsSheet result={open} onClose={() => setOpen(null)} />
    </Box>
  );
}

/**
 * Perfil, under the athlete's name: the own "Cartel" of the modality selected
 * in the Início header (only when the student competes in it): tally and
 * medals, no championships. Tapping opens the Cartel screen (fight history).
 */
export function MyFightRecordCard() {
  const { userId } = useSession();
  const { active, isStaff } = useActiveGym();
  const { selected, competesInSelected } = useActiveModality();
  // Championships are paused while the fee is overdue with the block on.
  const { blocked } = useMyFinance();
  const show = !!active && !isStaff && !!userId && !!selected && competesInSelected && !blocked;
  const cartel = useCartel(active?.gymId, userId ?? undefined, show);
  if (!show || !selected) return null;
  const record = cartel.ready
    ? recordsByModality(cartel.history ?? [], [selected.id], cartel.previous).find((r) => r.modalityId === selected.id)
    : undefined;
  return (
    <Box alignSelf="stretch" marginTop="s8">
      {cartel.isLoading ? <ActivityIndicator accessibilityLabel="Carregando cartel" /> : null}
      {cartel.isError ? <LoadError title="Não foi possível carregar o cartel" onRetry={cartel.refetch} /> : null}
      {record ? (
        <Card
          gap="s12"
          onPress={() => router.push('/cartel')}
          accessibilityLabel={`Cartel de ${selected.name}: ${tallyAccessibilityLabel(record)}. Ver histórico de lutas`}
        >
          <Box flexDirection="row" alignItems="center">
            <Text variant="captionCaps" flex={1}>{`Cartel · ${selected.name}`}</Text>
            <Icon name="chevronRight" color="textMuted" size={20} />
          </Box>
          <FightTallyDisplay tally={record} />
          <MedalRow medals={record} />
        </Card>
      ) : null}
    </Box>
  );
}

/** "3 vitórias · 1 derrota" (zeros left out); null without fights. */
function fightsSummary({ wins, losses, draws }: FightTally): string | null {
  const parts = [
    wins ? `${wins} ${wins === 1 ? 'vitória' : 'vitórias'}` : null,
    losses ? `${losses} ${losses === 1 ? 'derrota' : 'derrotas'}` : null,
    draws ? `${draws} ${draws === 1 ? 'empate' : 'empates'}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

/**
 * Result of the athlete in an event, discreet: a medal in its color on the
 * podium, a neutral trophy without podium, a clock while nothing was recorded.
 */
function ResultBadge({ result, size = 40 }: { result: ChampionshipResult; size?: number }) {
  const recorded = !!result.placement || result.fights.length > 0;
  return (
    <Box
      width={size}
      height={size}
      alignItems="center"
      justifyContent="center"
      backgroundColor="surfaceRaised"
      style={{ borderRadius: size / 2 }}
    >
      {result.placement && result.placement !== 'none' ? (
        <Icon name="medal" color={MEDAL_COLOR[result.placement]} active size={22} />
      ) : (
        <Icon name={recorded ? 'trophy' : 'clock'} color="textMuted" size={20} />
      )}
    </Box>
  );
}

/** One event of the history (row of a grouped list): badge, name, date · place, result; opens its fights. */
function EventRow({ result, last, onPress }: { result: ChampionshipResult; last: boolean; onPress: () => void }) {
  const { border } = useAppTheme();
  const fights = fightsSummary(tallyFights(result.fights));
  const placement = result.placement ? placementLabel(result.placement) : null;
  const outcome = [placement, fights].filter(Boolean).join(' · ') || 'Resultado ainda não registrado';
  const where = [formatLocalDate(result.eventDate), result.location || null].filter(Boolean).join(' · ');
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${result.name}, ${where}. ${outcome}.${result.isHistorical ? ' Registro anterior.' : ''} Ver lutas`}>
      <Box
        flexDirection="row"
        alignItems="center"
        gap="s12"
        paddingVertical="s12"
        borderBottomWidth={last ? 0 : border.width}
        borderColor="border"
      >
        <ResultBadge result={result} />
        <Box flex={1} gap="s4">
          <Text variant="bodyStrong" numberOfLines={1}>
            {result.name}
          </Text>
          <Text variant="caption" numberOfLines={1}>
            {where}
          </Text>
          <Text variant="caption" color={placement || fights ? 'text' : 'textMuted'} numberOfLines={1}>
            {outcome}
          </Text>
          {result.isHistorical ? <PreviousSeal /> : null}
        </Box>
        <Icon name="chevronRight" color="textMuted" />
      </Box>
    </Pressable>
  );
}

/** "Antes do Kimi" in the grouped history list: the previous record (not tappable), always last. */
function BeforeKimiRow({ record }: { record: PreviousRecord }) {
  return (
    <Box
      flexDirection="row"
      alignItems="center"
      gap="s12"
      paddingVertical="s12"
      accessible
      accessibilityLabel={previousAccessibilityLabel(record)}
    >
      <Box width={40} height={40} alignItems="center" justifyContent="center" backgroundColor="surfaceRaised" style={{ borderRadius: 20 }}>
        <Icon name="clock" color="textMuted" size={20} />
      </Box>
      <Box flex={1} gap="s4">
        <Text variant="bodyStrong">{BEFORE_KIMI}</Text>
        <Box flexDirection="row" alignItems="center" gap="s12">
          <Text variant="caption" color="text">
            {formatTally(record)}
          </Text>
          <InlineMedals medals={record} />
        </Box>
      </Box>
    </Box>
  );
}

/**
 * Cartel (stack screen, from the Perfil card), own, of the modality selected
 * in the Início header (in the header subtitle): the summary (tally, medals,
 * events) and "Histórico de lutas" — one row per event, newest first, with a
 * discreet result badge; each opens its fights.
 */
export function CartelScreen() {
  const { userId } = useSession();
  const { active } = useActiveGym();
  const { selected } = useActiveModality();
  const cartel = useCartel(active?.gymId, userId ?? undefined);
  const [open, setOpen] = useState<ChampionshipResult | null>(null);
  // Previous and app championships together, by date (newest first).
  const events = (cartel.history ?? [])
    .filter((h) => h.modalityId === selected?.id)
    .sort((a, b) => b.eventDate.localeCompare(a.eventDate));
  const before = cartel.previous?.find((p) => p.modalityId === selected?.id);
  const record =
    selected && cartel.ready
      ? recordsByModality(cartel.history ?? [], [selected.id], cartel.previous).find((r) => r.modalityId === selected.id)
      : undefined;

  return (
    <Screen nativeHeader title="Cartel" subtitle={selected?.name} onBack={() => router.back()}>
      {cartel.isLoading ? <ActivityIndicator accessibilityLabel="Carregando cartel" /> : null}
      {cartel.isError ? <LoadError title="Não foi possível carregar o cartel" onRetry={cartel.refetch} /> : null}
      {record ? (
        <Box gap="s32" paddingTop="s16">
          <Card gap="s16" paddingVertical="s24">
            <FightTallyDisplay tally={record} />
            <MedalRow medals={record} />
            <Text variant="caption" textAlign="center">
              {record.championships === 0
                ? 'Nenhum campeonato ainda'
                : `${record.championships} ${record.championships === 1 ? 'campeonato' : 'campeonatos'}`}
            </Text>
          </Card>

          <Box gap="s8">
            <Text variant="captionCaps" accessibilityRole="header">
              Histórico de lutas
            </Text>
            {events.length === 0 && !before ? (
              <Text variant="body" color="textMuted">
                Os campeonatos que você disputar aparecem aqui, com o resultado de cada luta.
              </Text>
            ) : (
              <Card paddingVertical="none">
                {events.map((e, i) => (
                  <EventRow key={e.entryId} result={e} last={!before && i === events.length - 1} onPress={() => setOpen(e)} />
                ))}
                {before ? <BeforeKimiRow record={before} /> : null}
              </Card>
            )}
          </Box>
        </Box>
      ) : null}
      <ChampionshipFightsSheet result={open} onClose={() => setOpen(null)} />
    </Screen>
  );
}
