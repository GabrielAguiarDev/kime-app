import { AcademyLogo, Box, Card, Text } from '@components';
import type { CodeType } from '@domain/Gym';

const roleLine = (codeType: CodeType) =>
  codeType === 'instructor' ? 'Você vai entrar como professor' : 'Você vai entrar como aluno';

/** Academy logo + name (+ the role the code gives), as shown after a code is recognized. */
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
      accessibilityLabel={`Academia ${gymName}${codeType ? `. ${roleLine(codeType)}` : ''}`}
    >
      <AcademyLogo name={gymName} url={logoUrl} />
      <Box flex={1} gap="s4">
        {caption ? <Text variant="captionCaps">{caption}</Text> : null}
        <Text variant="title" numberOfLines={3}>
          {gymName}
        </Text>
        {codeType ? (
          <Text variant="bodyStrong" color="accent">
            {roleLine(codeType)}
          </Text>
        ) : null}
      </Box>
    </Card>
  );
}
