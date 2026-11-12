import { Alert } from 'react-native';

import { useAnnouncementMutations } from '@domain/Announcements';
import { errorMessage } from '@infra';
import { useConfirm } from '@services/confirm';
import { haptics } from '@utils/haptics';

/** "Apagar aviso" with a confirmation; `deletingId` while it runs. */
export function useDeleteAnnouncement(academyId: string, onDeleted?: () => void) {
  const { remove } = useAnnouncementMutations(academyId);
  const confirm = useConfirm();
  const ask = async (id: string) => {
    const ok = await confirm({
      title: 'Apagar aviso?',
      message: 'Ele some para todos da academia. Não dá para desfazer.',
      confirmLabel: 'Apagar aviso',
      tone: 'danger',
    });
    if (!ok) return;
    remove.mutate(id, {
      onSuccess: () => {
        haptics.success();
        onDeleted?.();
      },
      onError: (e) => Alert.alert('Avisos', errorMessage(e)),
    });
  };
  return { ask, deletingId: remove.isPending ? remove.variables : undefined };
}
