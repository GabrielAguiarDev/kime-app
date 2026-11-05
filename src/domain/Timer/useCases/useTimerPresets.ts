import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { QueryKeys } from '@infra/query';
import { supabase, toAppError } from '@infra/supabase';

import type { TimerConfig, TimerPreset } from '../timerRules';

async function call<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    throw toAppError(e);
  }
}

async function list(academyId: string): Promise<TimerPreset[]> {
  return call(async () => {
    const { data, error } = await supabase
      .from('timer_presets')
      .select('id, name, rounds, round_seconds, rest_seconds, warning_seconds')
      .eq('academy_id', academyId)
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
    }));
  });
}

const columns = (c: TimerConfig) => ({
  rounds: c.rounds,
  round_seconds: c.roundSeconds,
  rest_seconds: c.restSeconds,
  warning_seconds: c.warningSeconds,
});

/** Presets saved by the academy (every active member reads them). */
export function useTimerPresets(academyId: string | undefined) {
  return useQuery({
    queryKey: [QueryKeys.TimerPresets, academyId],
    queryFn: () => list(academyId!),
    enabled: !!academyId,
  });
}

/** Staff: save, overwrite and delete the academy's presets. */
export function useTimerPresetMutations(academyId: string, userId: string) {
  const queryClient = useQueryClient();
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: [QueryKeys.TimerPresets, academyId] });
  return {
    create: useMutation({
      mutationFn: ({ name, config }: { name: string; config: TimerConfig }) =>
        call(async () => {
          const { error } = await supabase
            .from('timer_presets')
            .insert({ academy_id: academyId, name: name.trim(), created_by: userId, ...columns(config) });
          if (error) throw error;
        }),
      onSuccess,
    }),
    update: useMutation({
      mutationFn: ({ id, config }: { id: string; config: TimerConfig }) =>
        call(async () => {
          const { data, error } = await supabase.from('timer_presets').update(columns(config)).eq('id', id).select('id');
          if (error) throw error;
          if (data.length === 0) throw new Error('forbidden');
        }),
      onSuccess,
    }),
    remove: useMutation({
      mutationFn: (id: string) =>
        call(async () => {
          const { data, error } = await supabase.from('timer_presets').delete().eq('id', id).select('id');
          if (error) throw error;
          if (data.length === 0) throw new Error('forbidden');
        }),
      onSuccess,
    }),
  };
}
