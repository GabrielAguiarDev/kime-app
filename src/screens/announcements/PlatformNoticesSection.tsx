import { Alert } from 'react-native';

import { Box, Card, Icon, Text, TextButton } from '@components';
import { useDismissPlatformNotice, usePlatformNotices } from '@domain/PlatformNotices';
import { errorMessage } from '@infra';
import { useSession } from '@services/session';

/**
 * Início (staff and students, also while blocked for a fee): the newest
 * notice from the Kimi team, with "Entendi" to dismiss it (per account, on
 * every device). The next one, if any, shows after. Nothing while loading,
 * on error or without notices.
 */
export function PlatformNoticesSection() {
  const { userId } = useSession();
  const notices = usePlatformNotices(userId);
  const dismiss = useDismissPlatformNotice(userId);
  const notice = notices.data?.[0];
  if (!notice) return null;

  return (
    // TODO(motion): notice leaving after "Entendi" (and the next one coming in).
    <Card gap="s12">
      <Box flexDirection="row" alignItems="center" gap="s8">
        <Icon name="announcement" color="accent" />
        <Text variant="heading" flex={1} accessibilityRole="header">
          {notice.title}
        </Text>
      </Box>
      <Text variant="body">{notice.body}</Text>
      <Box flexDirection="row" alignItems="center" justifyContent="space-between" gap="s8">
        <Text variant="caption">Kimi</Text>
        <TextButton
          title="Entendi"
          fullWidth={false}
          disabled={dismiss.isPending}
          onPress={() => dismiss.mutate(notice.id, { onError: (e) => Alert.alert('Aviso do Kimi', errorMessage(e)) })}
        />
      </Box>
    </Card>
  );
}
