import { useQuery } from '@tanstack/react-query';

import type { BeltColorKey, BeltLook } from '@domain/Classes';
import { QueryKeys } from '@infra/query';
import { supabase, toAppError } from '@infra/supabase';

import type { ChampionshipCompetitor, Classmate, SharedModality } from '../teamTypes';

const belt = (primary: string | null | undefined, tip: string | null | undefined): BeltLook | null =>
  primary ? { primary: primary as BeltColorKey, tip: (tip ?? null) as BeltColorKey | null } : null;

interface SharedRow {
  modality_id: string;
  belt_primary: string | null;
  belt_tip: string | null;
  is_competitor: boolean;
}

async function listClassmates(academyId: string): Promise<Classmate[]> {
  const { data, error } = await supabase.rpc('classmates', { p_academy_id: academyId });
  if (error) throw toAppError(error);
  return data.map((r) => ({
    userId: r.user_id,
    fullName: r.full_name,
    avatarPath: r.avatar_path,
    role: r.role,
    memberSince: r.member_since,
    modalities: ((r.modalities ?? []) as unknown as SharedRow[]).map(
      (m): SharedModality => ({ modalityId: m.modality_id, belt: belt(m.belt_primary, m.belt_tip), isCompetitor: m.is_competitor }),
    ),
  }));
}

/** Student: the academy's staff and the students who share a modality (server-enforced). */
export function useClassmates(academyId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: [QueryKeys.Classmates, academyId],
    queryFn: () => listClassmates(academyId!),
    enabled: !!academyId && enabled,
  });
}

/** Competitors entered in a championship: staff, or students linked to its modality. */
export function useChampionshipCompetitors(championshipId: string | undefined) {
  return useQuery({
    queryKey: [QueryKeys.ChampionshipCompetitors, championshipId],
    queryFn: async (): Promise<ChampionshipCompetitor[]> => {
      const { data, error } = await supabase.rpc('championship_competitors', { p_championship_id: championshipId! });
      if (error) throw toAppError(error);
      return data.map((r) => ({
        userId: r.user_id,
        fullName: r.full_name,
        avatarPath: r.avatar_path,
        belt: belt(r.belt_primary, r.belt_tip),
      }));
    },
    enabled: !!championshipId,
  });
}
