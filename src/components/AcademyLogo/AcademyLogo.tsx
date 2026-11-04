import { Image } from 'expo-image';

import { useAppTheme } from '@theme';

import { Box } from '../Box/Box';
import { Text } from '../Text/Text';

interface AcademyLogoProps {
  name: string;
  /** Public URL; null shows the academy initials instead. */
  url: string | null | undefined;
  size?: 'large' | 'small';
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? `${words[0]![0]}${words[1]![0]}` : (words[0] ?? '').slice(0, 2);
  return letters.toUpperCase();
}

/** Academy logo (square, radius-lg, 2px border) or its initials when there is none. */
export function AcademyLogo({ name, url, size = 'large' }: AcademyLogoProps) {
  const theme = useAppTheme();
  const px = size === 'large' ? theme.size.academyLogo : theme.size.academyLogoSmall;
  return (
    <Box
      width={px}
      height={px}
      borderRadius="lg"
      borderWidth={theme.border.width}
      borderColor="border"
      backgroundColor="surface"
      alignItems="center"
      justifyContent="center"
      overflow="hidden"
      accessibilityRole="image"
      accessibilityLabel={`Logo da ${name}`}
    >
      {url ? (
        <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={0} />
      ) : (
        <Text variant={size === 'large' ? 'title' : 'heading'} color="textMuted">
          {initials(name)}
        </Text>
      )}
    </Box>
  );
}
