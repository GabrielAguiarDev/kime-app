import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { QueryKeys } from '@infra/query';
import { toAppError } from '@infra/supabase';

import { fightRecordApi as api, type FightRowApi } from '../fightRecordApi';
import type {
  ChampionshipResult,
  EntryResults,
  Fight,
  FightInput,
  FightMethod,
  FightRecord,
  FightResult,
  FightStage,
  Placement,
} from '../fightRecordTypes';

async function call<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    throw toAppError(e);
  }
}

interface FightJson {
  id: string;
  result: string;
  method: string;
  stage: string | null;
  opponent_name: string | null;
  note: string | null;
  created_at: string;
}

function toFight(row: FightRowApi | FightJson): Fight {
  return {
    id: row.id,
    result: row.result as FightResult,
    method: row.method as FightMethod,
    stage: (row.stage ?? null) as FightStage | null,
    opponentName: row.opponent_name,
    note: row.note,
    createdAt: row.created_at,
  };
}

const byCreation = (a: Fight, b: Fight) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);

/** Staff: entered athletes of a championship with placement and fights. */
export function useChampionshipResults(championshipId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: [QueryKeys.FightHistory, 'championship', championshipId],
    queryFn: () =>
      call(async (): Promise<EntryResults[]> =>
        (await api.listEntryResults(championshipId!)).map((r) => ({
          entryId: r.id,
          athleteId: r.athlete_id,
          placement: (r.placement ?? null) as Placement | null,
          fights: r.fights.map(toFight).sort(byCreation),
        })),
      ),
    enabled: !!championshipId && enabled,
  });
}

/** The athlete themself or staff: held championships (newest first) with placement and fights. */
export function useFightHistory(academyId: string | undefined, athleteId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: [QueryKeys.FightHistory, academyId, athleteId],
    queryFn: () =>
      call(async (): Promise<ChampionshipResult[]> =>
        (await api.history(academyId!, athleteId!)).map((r) => ({
          entryId: r.entry_id,
          championshipId: r.championship_id,
          modalityId: r.modality_id,
          name: r.name,
          eventDate: r.event_date,
          location: r.location,
          placement: (r.placement ?? null) as Placement | null,
          fights: ((r.fights ?? []) as unknown as FightJson[]).map(toFight),
        })),
      ),
    enabled: !!academyId && !!athleteId && enabled,
  });
}

/** Record per modality. A classmate gets only the modalities in common (no fights). */
export function useFightSummary(academyId: string | undefined, athleteId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: [QueryKeys.FightSummary, academyId, athleteId],
    queryFn: () =>
      call(async (): Promise<FightRecord[]> =>
        (await api.summary(academyId!, athleteId!)).map((r) => ({
          modalityId: r.modality_id,
          wins: r.wins,
          losses: r.losses,
          draws: r.draws,
          gold: r.gold,
          silver: r.silver,
          bronze: r.bronze,
          championships: r.championships,
        })),
      ),
    enabled: !!academyId && !!athleteId && enabled,
  });
}

/** Staff, from the championship day on: placement and fights of an entry. */
export function useResultMutations() {
  const queryClient = useQueryClient();
  const onSuccess = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: [QueryKeys.FightHistory] }),
      queryClient.invalidateQueries({ queryKey: [QueryKeys.FightSummary] }),
      queryClient.invalidateQueries({ queryKey: [QueryKeys.ChampionshipCompetitors] }),
    ]);
  return {
    setPlacement: useMutation({
      mutationFn: ({ entryId, placement }: { entryId: string; placement: Placement | null }) =>
        call(() => api.setPlacement(entryId, placement)),
      onSuccess,
    }),
    addFight: useMutation({
      mutationFn: ({ entryId, input }: { entryId: string; input: FightInput }) => call(() => api.addFight(entryId, input)),
      onSuccess,
    }),
    updateFight: useMutation({
      mutationFn: ({ id, input }: { id: string; input: FightInput }) => call(() => api.updateFight(id, input)),
      onSuccess,
    }),
    deleteFight: useMutation({ mutationFn: (id: string) => call(() => api.deleteFight(id)), onSuccess }),
  };
}
