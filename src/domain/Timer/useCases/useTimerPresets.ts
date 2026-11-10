import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { QueryKeys } from '@infra/query';
import { supabase, toAppError } from '@infra/supabase';

import { BUILT_IN_PRESETS, orderPresets, type TimerConfig, type TimerPreset } from '../timerRules';

async function call<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    throw toAppError(e);
  }
}

const columns = (c: TimerConfig) => ({
  rounds: c.rounds,
  round_seconds: c.roundSeconds,
  rest_seconds: c.restSeconds,
  warning_seconds: c.warningSeconds,
});

async function listPersonal(): Promise<TimerPreset[]> {
  return call(async () => {
    const { data, error } = await supabase
      .from('personal_timer_presets')
      .select('id, name, rounds, round_seconds, rest_seconds, warning_seconds')
      .order('name');
    if (error) throw error;
    return data.map((r) => ({
      id: r.id,
      name: r.name,
      rounds: r.rounds,
      roundSeconds: r.round_seconds,
      restSeconds: r.rest_seconds,
      warningSeconds: r.warning_seconds,
      builtIn: false,
      personal: true,
    }));
  });
}

/** The user's own presets (RLS: only theirs), the same in every academy. */
export function usePersonalTimerPresets(userId: string | undefined) {
  return useQuery({
    queryKey: [QueryKeys.PersonalTimerPresets, userId],
    queryFn: listPersonal,
    enabled: !!userId,
  });
}

/** Anyone (student, instructor, owner): save, overwrite and delete their own presets. */
export function usePersonalTimerPresetMutations(userId: string) {
  const queryClient = useQueryClient();
  // Returned, so the mutation settles with the list already holding the change.
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: [QueryKeys.PersonalTimerPresets, userId] });
  return {
    /** Resolves with the new preset's id. */
    create: useMutation({
      mutationFn: ({ name, config }: { name: string; config: TimerConfig }) =>
        call(async () => {
          const { data, error } = await supabase
            .from('personal_timer_presets')
            .insert({ name: name.trim(), ...columns(config) })
            .select('id')
            .single();
          if (error) throw error;
          return data.id;
        }),
      onSuccess,
    }),
    update: useMutation({
      mutationFn: ({ id, name, config }: { id: string; name: string; config: TimerConfig }) =>
        call(async () => {
          const { data, error } = await supabase
            .from('personal_timer_presets')
            .update({ name: name.trim(), ...columns(config) })
            .eq('id', id)
            .select('id');
          if (error) throw error;
          if (data.length === 0) throw new Error('forbidden');
        }),
      onSuccess,
    }),
    remove: useMutation({
      mutationFn: (id: string) =>
        call(async () => {
          const { data, error } = await supabase.from('personal_timer_presets').delete().eq('id', id).select('id');
          if (error) throw error;
          if (data.length === 0) throw new Error('forbidden');
        }),
      onSuccess,
    }),
  };
}

interface TimerPrefs {
  /** Ready-made presets the user removed from their list (`builtin:*` ids). */
  hidden: string[];
  /** Order of the user's list ("Gerenciar predefinições"). */
  order: string[];
}

/** List preferences on the profile (follow the user across devices and sign-outs). */
function useTimerPrefs(userId: string | undefined) {
  const queryClient = useQueryClient();
  const key = [QueryKeys.TimerPrefs, userId];
  const query = useQuery({
    queryKey: key,
    queryFn: () =>
      call(async (): Promise<TimerPrefs> => {
        const { data, error } = await supabase
          .from('profiles')
          .select('hidden_timer_presets, timer_preset_order')
          .eq('id', userId!)
          .single();
        if (error) throw error;
        return { hidden: data.hidden_timer_presets, order: data.timer_preset_order };
      }),
    enabled: !!userId,
  });
  const set = useMutation({
    mutationFn: (patch: Partial<TimerPrefs>) =>
      call(async () => {
        const { data, error } = await supabase
          .from('profiles')
          .update({
            ...(patch.hidden ? { hidden_timer_presets: patch.hidden } : {}),
            ...(patch.order ? { timer_preset_order: patch.order } : {}),
          })
          .eq('id', userId!)
          .select('id');
        if (error) throw error;
        if (data.length === 0) throw new Error('forbidden');
      }),
    // Optimistic: the list changes at once; rolled back on error.
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<TimerPrefs>(key);
      if (previous) queryClient.setQueryData<TimerPrefs>(key, { ...previous, ...patch });
      return { previous };
    },
    onError: (_e, _patch, context) => queryClient.setQueryData(key, context?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
  return { prefs: query.data, isLoading: query.isLoading, isError: query.isError, refetch: query.refetch, set };
}

/**
 * The user's timer list: their own presets and the ready-made ones they kept,
 * in the order they chose (`orderPresets`). Also removes / restores ready-made
 * presets and saves a new order.
 */
export function useMyTimerPresets(userId: string | undefined) {
  const personal = usePersonalTimerPresets(userId);
  const { prefs, set, ...prefsQuery } = useTimerPrefs(userId);
  const hidden = prefs?.hidden ?? [];
  const builtIns = BUILT_IN_PRESETS.filter((p) => !hidden.includes(p.id));
  const presets = orderPresets([...(personal.data ?? []), ...builtIns], prefs?.order ?? []);
  return {
    presets,
    hiddenCount: hidden.length,
    isLoading: personal.isLoading || prefsQuery.isLoading,
    isError: personal.isError || prefsQuery.isError,
    refetch: () => {
      void personal.refetch();
      void prefsQuery.refetch();
    },
    reorder: (ids: string[]) => set.mutate({ order: ids }),
    hideBuiltIn: (id: string) => set.mutate({ hidden: [...hidden, id] }),
    restoreBuiltIns: () => set.mutate({ hidden: [] }),
    prefsError: set.error,
  };
}
