import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator } from 'react-native';

import {
  BeltChip,
  Box,
  Button,
  Card,
  EmptyState,
  Icon,
  LoadError,
  PersonRow,
  Screen,
  StatusBadge,
  Text,
  TextButton,
  type IconName,
  type PersonAction,
} from '@components';
import { formatLocalDate } from '@domain/Competition';
import { useAcademyToday, useModalities, WEEKDAY_LABELS, weekdayOf, type LocalDate } from '@domain/Classes';
import {
  canMarkAttendance,
  eventRevenue,
  formatPrice,
  goingCount,
  groupPeople,
  isFullFor,
  locationLabel,
  myStatus,
  priceLabel,
  rsvpOpen,
  shortDateLabel,
  spotsLabel,
  spotsLeft,
  timeRangeLabel,
  useEventMutations,
  useEventPeople,
  useEventRsvps,
  useEvents,
  type AcademyEvent,
  type EventPerson,
} from '@domain/Events';
import { roleLabel } from '@domain/Membership';
import { errorMessage } from '@infra';
import { Section } from '@screens/competition/shared';
import { useActiveGym } from '@services/activeGym';
import { useConfirm } from '@services/confirm';
import { useSession } from '@services/session';
import { haptics } from '@utils/haptics';

import { CancelledBadge, EventCover, editEvent } from './parts';
import { useRsvp } from './useRsvp';
import { useOpenPerson } from '@screens/team/useOpenPerson';

const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

/**
 * One event. Everyone in its audience: cover, date and time, place,
 * description, price ("Gratuito" or paid directly to the academy), spots left
 * and "Vou" / "Não vou" (changeable until the deadline). Members see "Quem
 * vai" (photo, name, belt). Staff see "Vão", "Não vão" and "Sem resposta";
 * from the event day on they mark attendance ("Marcar todos os confirmados")
 * and, on paid events, who has paid; they edit (pencil) and cancel.
 */
export function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { active } = useActiveGym();
  const academyId = active?.gymId;
  const events = useEvents(academyId);
  const today = useAcademyToday(academyId);
  const event = events.data?.find((e) => e.id === id);

  // Always render the Screen (its ScrollView) on the first render (large-title header on iOS).
  if (!academyId || !id || events.isLoading || today.isLoading) {
    return (
      <Screen nativeHeader title=" " onBack={back}>
        <ActivityIndicator accessibilityLabel="Carregando" />
      </Screen>
    );
  }
  if ((events.isError && !event) || today.isError) {
    return (
      <Screen nativeHeader title="Evento" onBack={back}>
        <LoadError
          title="Não foi possível carregar o evento"
          onRetry={() => {
            void events.refetch();
            void today.refetch();
          }}
        />
      </Screen>
    );
  }
  if (!event || !today.data) {
    return (
      <Screen nativeHeader title="Evento" onBack={back}>
        <EmptyState title="Evento não encontrado." description="Ele pode não ser para as suas modalidades." />
      </Screen>
    );
  }
  return <EventDetail academyId={academyId} event={event} today={today.data} />;
}

function EventDetail({ academyId, event, today }: { academyId: string; event: AcademyEvent; today: LocalDate }) {
  const { userId } = useSession();
  const { isStaff } = useActiveGym();
  const rsvps = useEventRsvps(academyId);
  const people = useEventPeople(event.id);
  const modalities = useModalities(academyId);
  const rsvp = useRsvp(academyId, userId);
  const confirm = useConfirm();
  const mutations = useEventMutations(academyId);

  const answers = rsvps.data ?? [];
  const going = goingCount(answers, event.id);
  const mine = myStatus(answers, event.id, userId);
  const left = spotsLeft(event, going);
  const full = isFullFor(event, going, mine);
  const open = rsvpOpen(event, today);
  const cancelled = !!event.cancelledAt;
  const list = people.data ?? [];
  const inAudience = list.some((p) => p.userId === userId);

  const modalityNames = event.allModalities
    ? 'Todas as modalidades'
    : (modalities.data ?? [])
        .filter((m) => event.modalityIds.includes(m.id))
        .map((m) => m.name)
        .join(', ');

  const cancel = async () => {
    const ok = await confirm({
      title: 'Cancelar evento?',
      message: `${event.title} será cancelado. Quem confirmou presença recebe um aviso.`,
      confirmLabel: 'Cancelar evento',
      cancelLabel: 'Manter',
      tone: 'danger',
    });
    if (ok) mutations.cancel.mutate(event.id, { onSuccess: () => void haptics.success() });
  };

  const footer =
    !cancelled && open && (inAudience || !people.data) ? (
      <RsvpFooter
        mine={mine}
        full={full}
        deadline={event.rsvpDeadline}
        pending={rsvp.pendingStatus}
        error={rsvp.error}
        onAnswer={(status) => rsvp.answer(event.id, status)}
      />
    ) : undefined;

  return (
    <Screen
      nativeHeader
      title={event.title}
      onBack={back}
      topAction={
        isStaff && !cancelled
          ? { icon: 'edit', accessibilityLabel: 'Editar evento', onPress: () => editEvent(event.id) }
          : undefined
      }
      footer={footer}
    >
      <Box gap="s24">
        <EventCover path={event.coverPath} />
        {cancelled ? <CancelledBadge /> : null}

        {cancelled ? (
          <Card flexDirection="row" alignItems="center" gap="s12">
            <Icon name="warning" color="danger" />
            <Text variant="body" flex={1}>
              Evento cancelado pela academia.
            </Text>
          </Card>
        ) : null}

        <Card gap="s12">
          <InfoRow icon="calendar" text={formatLocalDate(event.eventDate)} detail={WEEKDAY_LABELS[weekdayOf(event.eventDate)].long} />
          <InfoRow icon="clock" text={timeRangeLabel(event)} />
          <InfoRow icon="location" text={locationLabel(event.location)} />
          <InfoRow icon="money" text={priceLabel(event.priceCents)} />
          {left !== null ? (
            <InfoRow
              icon="users"
              text={spotsLabel(left)}
              detail={`${event.capacity} ${event.capacity === 1 ? 'vaga' : 'vagas'} no total`}
              danger={left === 0 && !cancelled}
            />
          ) : null}
          {event.rsvpDeadline && !cancelled ? (
            <InfoRow
              icon="checks"
              text={open ? `Confirme até ${shortDateLabel(event.rsvpDeadline)}` : 'Prazo para confirmar encerrado'}
            />
          ) : null}
          {modalityNames ? <InfoRow icon="belt" text={modalityNames} /> : null}
        </Card>

        {event.description ? <Text variant="body">{event.description}</Text> : null}

        {people.isLoading ? <ActivityIndicator accessibilityLabel="Carregando" /> : null}
        {people.isError ? <LoadError title="Não foi possível carregar a lista" onRetry={() => void people.refetch()} /> : null}

        {people.data ? (
          isStaff ? (
            <StaffLists academyId={academyId} event={event} today={today} people={list} />
          ) : (
            <GoingList people={list.filter((p) => p.status === 'going')} userId={userId} />
          )
        ) : null}

        {isStaff && !cancelled ? (
          <Box gap="s8">
            <TextButton title="Cancelar evento" color="danger" loading={mutations.cancel.isPending} onPress={() => void cancel()} />
            {mutations.cancel.error ? (
              <Text variant="caption" color="danger" textAlign="center">
                {errorMessage(mutations.cancel.error)}
              </Text>
            ) : null}
          </Box>
        ) : null}
      </Box>
    </Screen>
  );
}

function InfoRow({ icon, text, detail, danger = false }: { icon: IconName; text: string; detail?: string; danger?: boolean }) {
  return (
    <Box flexDirection="row" alignItems="center" gap="s12">
      <Icon name={icon} color={danger ? 'danger' : 'textMuted'} />
      <Box flex={1} gap="s4">
        <Text variant="bodyStrong" color={danger ? 'danger' : 'text'}>
          {text}
        </Text>
        {detail ? <Text variant="caption">{detail}</Text> : null}
      </Box>
    </Box>
  );
}

/** Fixed at the bottom: "Vou" / "Não vou" (the answer can change until the deadline). */
function RsvpFooter({
  mine,
  full,
  deadline,
  pending,
  error,
  onAnswer,
}: {
  mine: 'going' | 'not_going' | null;
  full: boolean;
  deadline: LocalDate | null;
  pending: 'going' | 'not_going' | undefined;
  error: unknown;
  onAnswer: (status: 'going' | 'not_going') => void;
}) {
  return (
    <Box gap="s12">
      {mine === 'going' ? (
        <StatusBadge status="confirmed" label="Você vai" />
      ) : mine === 'not_going' ? (
        <StatusBadge status="rejected" label="Você não vai" />
      ) : deadline ? (
        <Text variant="caption">Responda até {shortDateLabel(deadline)}.</Text>
      ) : null}
      {error ? (
        <Text variant="caption" color="danger">
          {errorMessage(error)}
        </Text>
      ) : null}
      <Box flexDirection="row" gap="s12">
        {mine !== 'going' ? (
          <Box flex={1}>
            <Button
              title={full ? 'Vagas esgotadas' : 'Vou'}
              icon={full ? undefined : 'check'}
              disabled={full || !!pending}
              loading={pending === 'going'}
              onPress={() => onAnswer('going')}
            />
          </Box>
        ) : null}
        {mine !== 'not_going' ? (
          <Box flex={1}>
            <Button
              title="Não vou"
              variant="secondary"
              disabled={!!pending}
              loading={pending === 'not_going'}
              onPress={() => onAnswer('not_going')}
            />
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}

function personSecondary(p: EventPerson) {
  if (p.belt) return <BeltChip belt={p.belt} />;
  return p.role === 'student' ? undefined : roleLabel[p.role];
}

/** Members: "Quem vai" with photo, name and belt (the check-in preference does not apply: social event). */
function GoingList({ people, userId }: { people: EventPerson[]; userId: string | undefined }) {
  const openPerson = useOpenPerson();
  return (
    <Section title={`Quem vai (${people.length})`}>
      {people.length === 0 ? (
        <Text variant="body" color="textMuted">
          Ninguém confirmou ainda.
        </Text>
      ) : (
        <Card>
          {people.map((p, index) => (
            <PersonRow
              key={p.userId}
              name={p.userId === userId ? `${p.fullName} (você)` : p.fullName}
              avatarPath={p.avatarPath}
              secondary={personSecondary(p)}
              last={index === people.length - 1}
              onPress={openPerson(p.userId)}
            />
          ))}
        </Card>
      )}
    </Section>
  );
}

/** Staff: going / not going / no answer, with attendance (event day on) and payment (paid events). */
function StaffLists({
  academyId,
  event,
  today,
  people,
}: {
  academyId: string;
  event: AcademyEvent;
  today: LocalDate;
  people: EventPerson[];
}) {
  const openPerson = useOpenPerson();
  const mutations = useEventMutations(academyId);
  const { going, notGoing, noAnswer } = groupPeople(people);
  const marking = canMarkAttendance(event, today);
  const paidEvent = event.priceCents !== null;
  const busy = mutations.attendance.isPending || mutations.paid.isPending;
  const confirmedNotMarked = going.filter((p) => !p.attended).map((p) => p.userId);
  const present = people.filter((p) => p.attended).length;
  const paid = people.filter((p) => p.paid).length;

  const actionsFor = (p: EventPerson): PersonAction[] => [
    ...(paidEvent
      ? [
          {
            icon: 'money' as const,
            label: p.paid ? `Desmarcar pagamento de ${p.fullName}` : `Marcar pagamento de ${p.fullName}`,
            color: p.paid ? ('accent' as const) : ('textMuted' as const),
            disabled: busy,
            onPress: () => mutations.paid.mutate({ eventId: event.id, userIds: [p.userId], on: !p.paid }),
          },
        ]
      : []),
    ...(marking
      ? [
          {
            icon: 'attended' as const,
            label: p.attended ? `Desmarcar presença de ${p.fullName}` : `Marcar presença de ${p.fullName}`,
            color: p.attended ? ('accent' as const) : ('textMuted' as const),
            disabled: busy,
            onPress: () => {
              void haptics.tap();
              mutations.attendance.mutate({ eventId: event.id, userIds: [p.userId], on: !p.attended });
            },
          },
        ]
      : []),
  ];

  const status = (p: EventPerson): string | undefined => {
    const marks = [p.attended ? 'Presente' : null, p.paid ? 'Pago' : null].filter(Boolean).join(' · ');
    return marks || undefined;
  };

  const group = (title: string, list: EventPerson[], empty: string) => (
    <Section title={`${title} (${list.length})`}>
      {list.length === 0 ? (
        <Text variant="body" color="textMuted">
          {empty}
        </Text>
      ) : (
        <Card>
          {list.map((p, index) => (
            <PersonRow
              key={p.userId}
              name={p.fullName}
              avatarPath={p.avatarPath}
              secondary={
                <Box flexDirection="row" alignItems="center" gap="s8" flexWrap="wrap">
                  {p.belt ? <BeltChip belt={p.belt} /> : p.role !== 'student' ? <Text variant="caption">{roleLabel[p.role]}</Text> : null}
                  {status(p) ? (
                    <Text variant="caption" color="success">
                      {status(p)}
                    </Text>
                  ) : null}
                </Box>
              }
              actions={actionsFor(p)}
              last={index === list.length - 1}
              onPress={openPerson(p.userId)}
            />
          ))}
        </Card>
      )}
    </Section>
  );

  const revenue = event.priceCents !== null ? eventRevenue(event.priceCents, people) : null;

  return (
    <Box gap="s24">
      {revenue ? (
        // TODO(motion): received total counting up when a payment is marked.
        <Card gap="s8" accessible accessibilityLabel={`Recebido ${formatPrice(revenue.receivedCents)}`}>
          <Box flexDirection="row" alignItems="center" gap="s8">
            <Icon name="money" color="success" active />
            <Text variant="captionCaps">Recebido</Text>
          </Box>
          <Text variant="displayLg" color={revenue.receivedCents > 0 ? 'success' : 'text'}>
            {formatPrice(revenue.receivedCents)}
          </Text>
          <Text variant="caption">
            {revenue.paidCount === 1 ? '1 pagamento' : `${revenue.paidCount} pagamentos`} de {formatPrice(event.priceCents!)}
            {revenue.goingCount > 0 ? ` · previsto com os confirmados: ${formatPrice(revenue.expectedCents)}` : ''}
          </Text>
        </Card>
      ) : null}
      {marking || paidEvent ? (
        <Box gap="s12">
          <Text variant="bodyStrong">
            {[marking ? `${present} ${present === 1 ? 'presente' : 'presentes'}` : null, paidEvent ? `${paid} ${paid === 1 ? 'pago' : 'pagos'}` : null]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          <Text variant="caption">
            {[marking ? 'Toque no ícone de pessoa para marcar a presença.' : null, paidEvent ? 'Toque no cifrão para marcar quem já pagou.' : null]
              .filter(Boolean)
              .join(' ')}
          </Text>
          {marking && confirmedNotMarked.length > 0 ? (
            <Button
              title="Marcar todos os confirmados"
              icon="checks"
              variant="secondary"
              loading={mutations.attendance.isPending}
              disabled={busy}
              onPress={() =>
                mutations.attendance.mutate(
                  { eventId: event.id, userIds: confirmedNotMarked, on: true },
                  { onSuccess: () => void haptics.success() },
                )
              }
            />
          ) : null}
          {mutations.attendance.error || mutations.paid.error ? (
            <Text variant="caption" color="danger">
              {errorMessage(mutations.attendance.error ?? mutations.paid.error)}
            </Text>
          ) : null}
        </Box>
      ) : null}
      {group('Vão', going, 'Ninguém confirmou ainda.')}
      {group('Não vão', notGoing, 'Ninguém recusou.')}
      {group('Sem resposta', noAnswer, 'Todos responderam.')}
    </Box>
  );
}
