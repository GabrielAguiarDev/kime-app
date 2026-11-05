import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { useModalities, type Modality } from '@domain/Classes';
import type { StudentModality } from '@domain/Membership';
import { keyValueStorage } from '@infra';

import { useActiveGym } from '../activeGym/ActiveGymProvider';
import { useSession } from '../session/SessionProvider';
import { resolveSelectedModality } from './selectedModality';

/** A modality of the academy the student is linked to, with the link (competitor flag, goal). */
export interface LinkedModality extends Modality {
  link: StudentModality;
}

interface ActiveModalityContextValue {
  /** The student's modalities in the academy order (empty for owner/professor). */
  modalities: LinkedModality[];
  /** Modality the student's screens follow (Início, Aulas, ranking, competition). Null = none / staff. */
  selected: LinkedModality | null;
  select: (modalityId: string) => void;
  /** The student competes (accepted) in the selected modality. */
  competesInSelected: boolean;
  /** Modalities of the academy still loading. */
  isLoading: boolean;
}

const ActiveModalityContext = createContext<ActiveModalityContextValue | null>(null);

/**
 * The student's selected modality, saved on the device per user + academy.
 * When the student stops being linked to it, the first available is used.
 * Owner and professor see every modality (no selection).
 */
export function ActiveModalityProvider({ children }: { children: ReactNode }) {
  const { userId } = useSession();
  const { active, isStaff } = useActiveGym();
  const academyId = active?.status === 'active' && !isStaff ? active.gymId : undefined;
  const all = useModalities(academyId);
  const scope = userId && academyId ? `${userId}.${academyId}` : null;

  // Bumped on select so the stored value is re-read (the kv-store is synchronous).
  const [version, setVersion] = useState(0);

  const select = useCallback(
    (modalityId: string) => {
      if (!scope) return;
      keyValueStorage.setScoped('selectedModality', scope, modalityId);
      setVersion((v) => v + 1);
    },
    [scope],
  );

  const value = useMemo<ActiveModalityContextValue>(() => {
    void version;
    const links = new Map((active?.modalities ?? []).map((l) => [l.modalityId, l]));
    const modalities: LinkedModality[] = academyId
      ? (all.data ?? []).flatMap((m) => {
          const link = links.get(m.id);
          return link ? [{ ...m, link }] : [];
        })
      : [];
    const stored = scope ? keyValueStorage.getScoped('selectedModality', scope) : null;
    // The links arrive with the memberships (ready at boot); the academy list only
    // adds names and the order. Until it loads, resolve from the links so the
    // competitor guard (Competição tab, widget deep link) is already right.
    const orderedIds = all.data ? modalities.map((m) => m.id) : [...links.keys()];
    const selectedId = academyId ? resolveSelectedModality(orderedIds, stored) : null;
    const selected = modalities.find((m) => m.id === selectedId) ?? null;
    return {
      modalities,
      selected,
      select,
      competesInSelected: !!(selectedId && links.get(selectedId)?.isCompetitor),
      isLoading: !!academyId && all.isLoading,
    };
  }, [version, active?.modalities, academyId, all.data, all.isLoading, scope, select]);

  return <ActiveModalityContext.Provider value={value}>{children}</ActiveModalityContext.Provider>;
}

export function useActiveModality(): ActiveModalityContextValue {
  const ctx = useContext(ActiveModalityContext);
  if (!ctx) throw new Error('useActiveModality must be used inside ActiveModalityProvider');
  return ctx;
}
