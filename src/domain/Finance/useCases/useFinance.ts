import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { QueryKeys } from '@infra/query';

import { financeService as service } from '../financeService';
import type { ExpenseInput, FinanceSettings, OpenCharge, PaymentInput, StudentBilling } from '../financeTypes';

/** Owner: settings (off when never configured). Pass `enabled: false` for anyone else. */
export function useFinanceSettings(academyId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: [QueryKeys.FinanceSettings, academyId],
    queryFn: () => service.getSettings(academyId!),
    enabled: !!academyId && enabled,
  });
}

export function useSaveFinanceSettings(academyId: string) {
  const queryClient = useQueryClient();
  const key = [QueryKeys.FinanceSettings, academyId];
  return useMutation({
    mutationFn: (values: Partial<Omit<FinanceSettings, 'academyId'>>) => service.saveSettings(academyId, values),
    // Optimistic: the switch moves on the tap; an error rolls back.
    onMutate: async (values) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<FinanceSettings>(key);
      if (previous) queryClient.setQueryData<FinanceSettings>(key, { ...previous, ...values });
      return { previous };
    },
    onError: (_e, _v, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: key }),
        queryClient.invalidateQueries({ queryKey: [QueryKeys.FinanceOpenCharges, academyId] }),
      ]),
  });
}

export function useFinancePlans(academyId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: [QueryKeys.FinancePlans, academyId],
    queryFn: () => service.listPlans(academyId!),
    enabled: !!academyId && enabled,
  });
}

export function usePlanMutations(academyId: string) {
  const queryClient = useQueryClient();
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: [QueryKeys.FinancePlans, academyId] });
  return {
    save: useMutation({
      mutationFn: ({ id, name, amountCents }: { id: string | null; name: string; amountCents: number }) =>
        id ? service.updatePlan(id, name, amountCents) : service.createPlan(academyId, name, amountCents),
      onSuccess,
    }),
    archive: useMutation({
      mutationFn: ({ id, archived }: { id: string; archived: boolean }) => service.setPlanArchived(id, archived),
      onSuccess,
    }),
  };
}

export function useStudentBilling(membershipId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: [QueryKeys.FinanceBilling, membershipId],
    queryFn: () => service.getBilling(membershipId!),
    enabled: !!membershipId && enabled,
  });
}

export function useSaveStudentBilling(academyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (billing: StudentBilling) => service.saveBilling(academyId, billing),
    onSuccess: (_d, billing) => queryClient.invalidateQueries({ queryKey: [QueryKeys.FinanceBilling, billing.membershipId] }),
  });
}

export function useStudentCharges(academyId: string | undefined, userId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: [QueryKeys.FinanceCharges, academyId, 'student', userId],
    queryFn: () => service.listStudentCharges(academyId!, userId!),
    enabled: !!academyId && !!userId && enabled,
  });
}

export function useMonthCharges(academyId: string | undefined, month: string) {
  return useQuery({
    queryKey: [QueryKeys.FinanceCharges, academyId, 'month', month],
    queryFn: () => service.listMonthCharges(academyId!, month),
    enabled: !!academyId,
  });
}

/** Owner: unpaid charges of this month or earlier, most overdue first. */
export function useOpenCharges(academyId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: [QueryKeys.FinanceOpenCharges, academyId],
    queryFn: () => service.listOpenCharges(academyId!),
    enabled: !!academyId && enabled,
  });
}

/**
 * Mark paid / undo. Marking paid removes the row from the open list on the tap.
 * `onPaid` / `onPayError` live on the mutation itself, so they still run when
 * the sheet that fired it has already closed.
 */
export function usePaymentMutations(
  academyId: string,
  { onPaid, onPayError }: { onPaid?: () => void; onPayError?: (e: unknown) => void } = {},
) {
  const queryClient = useQueryClient();
  const openKey = [QueryKeys.FinanceOpenCharges, academyId];
  const onSettled = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: openKey }),
      queryClient.invalidateQueries({ queryKey: [QueryKeys.FinanceCharges, academyId] }),
      queryClient.invalidateQueries({ queryKey: [QueryKeys.FinanceReport, academyId] }),
    ]);
  return {
    markPaid: useMutation({
      mutationFn: ({ chargeId, input }: { chargeId: string; input: PaymentInput }) => service.markPaid(chargeId, input),
      onMutate: async ({ chargeId }) => {
        await queryClient.cancelQueries({ queryKey: openKey });
        const previous = queryClient.getQueryData<OpenCharge[]>(openKey);
        queryClient.setQueryData<OpenCharge[]>(openKey, (list) => list?.filter((c) => c.id !== chargeId));
        return { previous };
      },
      onSuccess: () => onPaid?.(),
      onError: (e, _v, context) => {
        if (context?.previous) queryClient.setQueryData(openKey, context.previous);
        onPayError?.(e);
      },
      onSettled,
    }),
    undo: useMutation({ mutationFn: (chargeId: string) => service.undoPayment(chargeId), onSettled }),
  };
}

export function useExpenses(academyId: string | undefined, month: string) {
  return useQuery({
    queryKey: [QueryKeys.FinanceExpenses, academyId, month],
    queryFn: () => service.listExpenses(academyId!, month),
    enabled: !!academyId,
  });
}

export function useExpenseMutations(academyId: string) {
  const queryClient = useQueryClient();
  const onSuccess = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: [QueryKeys.FinanceExpenses, academyId] }),
      queryClient.invalidateQueries({ queryKey: [QueryKeys.FinanceReport, academyId] }),
    ]);
  return {
    save: useMutation({
      mutationFn: ({ id, input }: { id: string | null; input: ExpenseInput }) =>
        id ? service.updateExpense(id, input) : service.createExpense(academyId, input),
      onSuccess,
    }),
    remove: useMutation({ mutationFn: (id: string) => service.deleteExpense(id), onSuccess }),
  };
}

export function useFinanceReport(academyId: string | undefined, month: string) {
  return useQuery({
    queryKey: [QueryKeys.FinanceReport, academyId, month],
    queryFn: () => service.report(academyId!, month),
    enabled: !!academyId,
  });
}

/** Student: own overdue months and the block (null when finance is off). */
export function useMyFinanceStatus(academyId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: [QueryKeys.MyFinanceStatus, academyId],
    queryFn: () => service.myStatus(academyId!),
    enabled: !!academyId && enabled,
  });
}
