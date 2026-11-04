import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { LocalDate } from '@domain/Classes/classesTypes';
import { QueryKeys } from '@infra/query';

import { dietService as service } from '../dietService';
import type { DietMealInput } from '../dietTypes';

/** Meals of an athlete between two dates (a week, usually). */
export function useDietMeals(athleteId: string | undefined, from: LocalDate | undefined, to: LocalDate | undefined) {
  return useQuery({
    queryKey: [QueryKeys.DietDays, athleteId, from, to],
    queryFn: () => service.listMeals(athleteId!, from!, to!),
    enabled: !!athleteId && !!from && !!to,
  });
}

/** Staff: write one athlete's diet in one academy. */
export function useDietMutations(academyId: string, athleteId: string) {
  const queryClient = useQueryClient();
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: [QueryKeys.DietDays, athleteId] });
  return {
    save: useMutation({
      mutationFn: ({ date, mealId, input }: { date: LocalDate; mealId: string | null; input: DietMealInput }) =>
        service.saveMeal(academyId, athleteId, date, mealId, input),
      onSuccess,
    }),
    remove: useMutation({ mutationFn: (id: string) => service.deleteMeal(id), onSuccess }),
    copyDay: useMutation({
      mutationFn: ({ from, to }: { from: LocalDate; to: LocalDate }) => service.copyDay(academyId, athleteId, from, to),
      onSuccess,
    }),
  };
}
