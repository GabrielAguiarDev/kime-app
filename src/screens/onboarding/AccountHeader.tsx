import { Box, Icon, Text } from '@components';
import { useMyProfile } from '@domain/Profile';
import { useSession } from '@services/session';
import { useAppTheme } from '@theme';

/**
 * Signed in without an academy (choice, code and waiting screens): who is
 * signed in, so a wrong account is noticed. Empty avatar (no photo yet) with
 * the user icon, the name and the e-mail.
 */
export function AccountHeader() {
  const { session, userId } = useSession();
  const profile = useMyProfile(userId);
  const { size, border } = useAppTheme();
  const email = session?.user.email ?? '';
  const metaName = session?.user.user_metadata?.full_name;
  const name = profile.data?.fullName || (typeof metaName === 'string' ? metaName : '') || email;
  return (
    <Box flexDirection="row" alignItems="center" gap="s12" accessible accessibilityLabel={`Conectado como ${name}, ${email}`}>
      <Box
        width={size.avatarSmall}
        height={size.avatarSmall}
        backgroundColor="surfaceRaised"
        borderWidth={border.width}
        borderColor="border"
        alignItems="center"
        justifyContent="center"
        style={{ borderRadius: size.avatarSmall / 2 }}
      >
        <Icon name="user" color="textMuted" />
      </Box>
      <Box flex={1}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {name}
        </Text>
        {email && email !== name ? (
          <Text variant="caption" numberOfLines={1}>
            {email}
          </Text>
        ) : null}
      </Box>
    </Box>
  );
}
