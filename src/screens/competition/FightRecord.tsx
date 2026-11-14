import { router, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Alert, Pressable } from 'react-native';

import { BottomSheet, Box, Card, HeaderMenu, Icon, LoadError, Screen, Text, Spinner } from '@components';
import type { Modality } from '@domain/Classes';
import {
  fightDetails,
  fightTitle,
  formatLocalDate,
  formatTally,
  placementLabel,
  recordsByModality,
  tallyAccessibilityLabel,
  tallyFights,
  useCartel,
  type ChampionshipResult,
  type Fight,
  type FightRecord,
  type FightTally,
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

/**
 * "8 · 2 · 1" with Vitórias / Derrotas / Empates under each number: display-lg on the Cartel
 * screen, `compact` (title) on the summary cards.
 */
export function FightTallyDisplay({ tally, compact = false }: { tally: FightTally; compact?: boolean }) {
  const number = compact ? 'title' : 'displayLg';
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
      gap={compact ? 's8' : 's12'}
      accessible
      accessibilityLabel={tallyAccessibilityLabel(tally)}
    >
      {stats.map(([value, label], index) => (
        <Box key={label} flexDirection="row" alignItems="flex-start" gap={compact ? 's8' : 's12'}>
          {index > 0 ? (
            <Text variant={number} color="textMuted">
              ·
            </Text>
          ) : null}
          <Box alignItems="center">
            <Text variant={number}>{value}</Text>
            <Text variant="caption">{label}</Text>
          </Box>
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

/** Summary card of one modality: name (optional) and the tally; `onPress` opens the history. */
export function FightRecordCard({ record, title, onPress }: { record: FightRecord; title?: string; onPress?: () => void }) {
  return (
    <Card
      gap="s12"
      onPress={onPress}
      accessibilityLabel={
        onPress ? `Cartel${title ? ` de ${title}` : ''}: ${tallyAccessibilityLabel(record)}. Ver histórico de lutas` : undefined
      }
    >
      {title ? (
        <Box flexDirection="row" alignItems="center">
          <Text variant="captionCaps" flex={1}>
            {title}
          </Text>
          {onPress ? <Icon name="chevronRight" color="textMuted" size={20} /> : null}
        </Box>
      ) : null}
      <FightTallyDisplay tally={record} compact />
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

/** Discreet seal of an internal championship: listed, but out of the record. */
export function InternalSeal() {
  return (
    <Box alignSelf="flex-start" paddingHorizontal="s8" paddingVertical="s4" borderRadius="sm" backgroundColor="surfaceRaised">
      <Text variant="caption" color="textMuted">
        Não conta no cartel
      </Text>
    </Box>
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

/** "Antes do Kimi: vitórias, derrotas e empates", for screen readers. */
function previousAccessibilityLabel(record: PreviousRecord): string {
  return `${BEFORE_KIMI}: ${tallyAccessibilityLabel(record)}`;
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
 * Staff, member page: "Cartel" of an athlete, per modality — tally in display-lg and medals.
 * Tapping a card opens the Cartel screen of that athlete and modality (championships and
 * fights). `modalityIds` are the modalities to show even without results (where the athlete
 * competes now).
 */
export function FightRecordSection({
  academyId,
  athleteId,
  modalities,
  modalityIds,
  only,
  athleteName,
  title = 'Cartel',
}: {
  academyId: string;
  athleteId: string;
  modalities: Modality[];
  modalityIds: string[];
  /** Show just this modality. */
  only?: string;
  /** Header subtitle of the Cartel screen opened from a card. */
  athleteName: string;
  /** Section title; null = none (the Cartel screen has it in the header). */
  title?: string | null;
}) {
  const cartel = useCartel(academyId, athleteId);
  const records = cartel.ready
    ? recordsByModality(cartel.history ?? [], modalityIds, cartel.previous).filter((r) => !only || r.modalityId === only)
    : [];
  const nameOf = (id: string) => modalities.find((m) => m.id === id)?.name ?? 'Modalidade removida';

  if (!cartel.ready && !cartel.isLoading && !cartel.isError) return null;
  if (cartel.ready && records.length === 0) return null;

  return (
    <Box gap="s12">
      {title ? <Text variant="captionCaps">{title}</Text> : null}
      {cartel.isLoading ? <Spinner accessibilityLabel="Carregando cartel" /> : null}
      {cartel.isError ? <LoadError title="Não foi possível carregar o cartel" onRetry={cartel.refetch} /> : null}
      {records.map((record) => (
        <FightRecordCard
          key={record.modalityId}
          record={record}
          title={nameOf(record.modalityId)}
          onPress={() =>
            router.push({
              pathname: '/cartel',
              params: { athleteId, modalityId: record.modalityId, modalityName: nameOf(record.modalityId), athleteName },
            })
          }
        />
      ))}
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
      {cartel.isLoading ? <Spinner accessibilityLabel="Carregando cartel" /> : null}
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
          <FightTallyDisplay tally={record} compact />
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
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${result.name}, ${where}. ${outcome}.${result.isHistorical ? ' Registro anterior.' : ''}${result.countsInRecord ? '' : ' Não conta no cartel.'} Ver lutas`}>
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
          {!result.countsInRecord ? <InternalSeal /> : null}
        </Box>
        <Icon name="chevronRight" color="textMuted" />
      </Box>
    </Pressable>
  );
}

/** "Antes do Kimi" in the grouped history list, always last; `onPress` (staff) edits it. */
function BeforeKimiRow({ record, onPress }: { record: PreviousRecord; onPress?: () => void }) {
  const row = (
    <Box
      flexDirection="row"
      alignItems="center"
      gap="s12"
      paddingVertical="s12"
      accessible={!onPress}
      accessibilityLabel={onPress ? undefined : previousAccessibilityLabel(record)}
    >
      <Box width={40} height={40} alignItems="center" justifyContent="center" backgroundColor="surfaceRaised" style={{ borderRadius: 20 }}>
        <Icon name="clock" color="textMuted" size={20} />
      </Box>
      <Box flex={1} gap="s4">
        <Text variant="bodyStrong">{BEFORE_KIMI}</Text>
        <Text variant="caption" color="text">
          {formatTally(record)}
        </Text>
      </Box>
      {onPress ? <Icon name="edit" color="textMuted" /> : null}
    </Box>
  );
  if (!onPress) return row;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${previousAccessibilityLabel(record)}. Editar`}>
      {row}
    </Pressable>
  );
}

/** Staff's edit requests from the Cartel screen (see PreviousHistoryEditor). */
export type CartelEditRequest =
  | { kind: 'record'; modalityId: string }
  | { kind: 'create' }
  | { kind: 'championship'; championshipId: string; mode: 'results' | 'edit' };

/**
 * Cartel (stack screen): the summary (tally, medals, events) and "Histórico de lutas" — one
 * row per event, newest first, with a discreet result badge; each opens its fights.
 *  - From the Perfil card: own, of the modality selected in the Início header (header subtitle).
 *  - From a member's page (staff): params `athleteId`, `modalityId`, `modalityName`, `athleteName`.
 *    Staff get a "⋯" menu (register the previous record / add a previous championship) and edit
 *    the previous items by tapping them; `staffEditor` renders the sheets that do it.
 */
export function CartelScreen({
  staffEditor,
}: {
  staffEditor?: (ctx: {
    athleteId: string;
    modalityId: string;
    request: CartelEditRequest | null;
    onRequestChange: (request: CartelEditRequest | null) => void;
  }) => ReactNode;
} = {}) {
  const { userId } = useSession();
  const { active } = useActiveGym();
  const own = useActiveModality().selected;
  const params = useLocalSearchParams<{ athleteId?: string; modalityId?: string; modalityName?: string; athleteName?: string }>();
  const ofOther = !!params.athleteId && !!params.modalityId;
  const selected = ofOther ? { id: params.modalityId!, name: params.modalityName ?? '' } : own;
  const cartel = useCartel(active?.gymId, ofOther ? params.athleteId : (userId ?? undefined));
  const [open, setOpen] = useState<ChampionshipResult | null>(null);
  const [request, setRequest] = useState<CartelEditRequest | null>(null);
  const staff = ofOther && !!staffEditor;
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
    <Screen
      nativeHeader
      title="Cartel"
      subtitle={ofOther ? [params.athleteName, selected?.name].filter(Boolean).join(' · ') : selected?.name}
      onBack={() => router.back()}
      headerRight={
        staff && selected ? (
          <StaffCartelMenu
            hasPrevious={!!before}
            onSelect={(kind) => setRequest(kind === 'record' ? { kind, modalityId: selected.id } : { kind })}
          />
        ) : undefined
      }
    >
      {cartel.isLoading ? <Spinner accessibilityLabel="Carregando cartel" /> : null}
      {cartel.isError ? <LoadError title="Não foi possível carregar o cartel" onRetry={cartel.refetch} /> : null}
      {record ? (
        <Box gap="s32" paddingTop="s16">
          <Card gap="s16" paddingVertical="s24">
            <FightTallyDisplay tally={record} />
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
                {ofOther
                  ? 'Os campeonatos que o atleta disputar aparecem aqui, com o resultado de cada luta.'
                  : 'Os campeonatos que você disputar aparecem aqui, com o resultado de cada luta.'}
              </Text>
            ) : (
              <Card paddingVertical="none">
                {events.map((e, i) => (
                  <EventRow
                    key={e.entryId}
                    result={e}
                    last={!before && i === events.length - 1}
                    onPress={() =>
                      // Staff edit a previous championship; everything else opens its fights.
                      staff && e.isHistorical
                        ? setRequest({ kind: 'championship', championshipId: e.championshipId, mode: 'results' })
                        : setOpen(e)
                    }
                  />
                ))}
                {before ? (
                  <BeforeKimiRow
                    record={before}
                    onPress={staff && selected ? () => setRequest({ kind: 'record', modalityId: selected.id }) : undefined}
                  />
                ) : null}
              </Card>
            )}
          </Box>
        </Box>
      ) : null}
      {staff
        ? staffEditor!({ athleteId: params.athleteId!, modalityId: params.modalityId!, request, onRequestChange: setRequest })
        : null}
      <ChampionshipFightsSheet result={open} onClose={() => setOpen(null)} />
    </Screen>
  );
}

const STAFF_MENU = [
  { id: 'record', title: 'Registrar cartel anterior' },
  { id: 'create', title: 'Adicionar campeonato anterior' },
] as const;

/** Staff, header "⋯": the history before the app (previous record, previous championship). */
function StaffCartelMenu({ hasPrevious, onSelect }: { hasPrevious: boolean; onSelect: (kind: 'record' | 'create') => void }) {
  const options = STAFF_MENU.map((o) => ({
    id: o.id,
    title: o.id === 'record' && hasPrevious ? 'Editar cartel anterior' : o.title,
  }));
  return (
    <HeaderMenu
      accessibilityLabel="Mais opções"
      label={<Icon name="more" color="text" />}
      options={options}
      selectedId={null}
      onSelect={(id) => onSelect(id as 'record' | 'create')}
      // Build without the native menu: the same two options in an alert.
      onFallbackPress={() =>
        Alert.alert('Cartel', undefined, [
          ...options.map((o) => ({ text: o.title, onPress: () => onSelect(o.id) })),
          { text: 'Cancelar', style: 'cancel' as const },
        ])
      }
    />
  );
}
