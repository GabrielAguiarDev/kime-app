import { AcademyLogo, Box, Card, Text } from '@components';
import type { CodeType } from '@domain/Gym';

/** Academy logo + name, as shown after a code is recognized. */
export function AcademyCard({
  gymName,
  logoUrl,
  codeType,
  caption,
}: {
  gymName: string;
  logoUrl: string | null;
  codeType?: CodeType;
  caption?: string;
}) {
  return (
    <Card
      flexDirection="row"
      alignItems="center"
      gap="s16"
      accessibilityLabel={`Academia ${gymName}${codeType === 'instructor' ? ', convite para professor' : ''}`}
    >
      <AcademyLogo name={gymName} url={logoUrl} />
      <Box flex={1} gap="s4">
        {caption ? <Text variant="captionCaps">{caption}</Text> : null}
        <Text variant="title" numberOfLines={3}>
          {gymName}
        </Text>
        {codeType === 'instructor' ? (
          <Text variant="caption" color="accent">
            Convite para professor
          </Text>
        ) : null}
      </Box>
    </Card>
  );
}
