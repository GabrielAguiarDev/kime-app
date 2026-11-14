import { readyToGraduate, useBelts, useModalityStats } from '@domain/Classes';
import { useGymMembers, useInactiveStudents } from '@domain/Membership';

/**
 * Staff: students ready for the next belt ("Pronto para graduar"), from the
 * stats the app already loads (confirmed classes since the last graduation vs
 * the next belt's goal). Only active students linked to the modality.
 */
export function useGraduationReady(academyId: string | undefined) {
  const members = useGymMembers(academyId);
  const stats = useModalityStats(academyId);
  const belts = useBelts(academyId);
  const queries = [members, stats, belts];

  const links = new Map<string, Set<string>>();
  for (const m of members.data ?? []) {
    if (m.role === 'student') links.set(m.id, new Set(m.modalities.map((l) => l.modalityId)));
  }
  const ready =
    members.data && stats.data && belts.data
      ? readyToGraduate(stats.data, belts.data, (membershipId, modalityId) => !!links.get(membershipId)?.has(modalityId))
      : [];

  return {
    ready,
    members: members.data ?? [],
    isLoading: queries.some((q) => q.isLoading),
    isError: queries.some((q) => q.isError),
    refetch: () => queries.forEach((q) => void q.refetch()),
  };
}

/** Staff: "Alunos sumidos" joined with the member list (name, photo, modalities). */
export function useInactiveMembers(academyId: string | undefined) {
  const inactive = useInactiveStudents(academyId);
  const members = useGymMembers(academyId);
  const byId = new Map((members.data ?? []).map((m) => [m.id, m]));
  const list = (inactive.data ?? []).flatMap((s) => {
    const member = byId.get(s.membershipId);
    return member ? [{ student: s, member }] : [];
  });
  return {
    list,
    isLoading: inactive.isLoading || members.isLoading,
    isError: inactive.isError || members.isError,
    refetch: () => {
      void inactive.refetch();
      void members.refetch();
    },
  };
}
