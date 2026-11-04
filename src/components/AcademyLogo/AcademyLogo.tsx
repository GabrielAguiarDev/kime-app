import { Image } from 'expo-image';

import { useAppTheme } from '@theme';

import { Box } from '../Box/Box';
import { Text } from '../Text/Text';

interface AcademyLogoProps {
  name: string;
  /** Public URL; null shows the academy initials instead. */
  url: string | null | undefined;
  /** hero: academy settings; large: entry cards; small: lists; header: circular header button (Início). */
  size?: 'hero' | 'large' | 'small' | 'header';
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? `${words[0]![0]}${words[1]![0]}` : (words[0] ?? '').slice(0, 2);
  return letters.toUpperCase();
}

/**
 * Academy logo (square, radius-lg, 2px border). Without a logo: the academy
 * initials in accent on a surface-raised square with radius-md.
 */
export function AcademyLogo({ name, url, size = 'large' }: AcademyLogoProps) {
  const theme = useAppTheme();
  const px =
    size === 'hero'
      ? theme.size.academyLogoHero
      : size === 'large'
        ? theme.size.academyLogo
        : size === 'header'
          ? theme.size.headerLogo
          : theme.size.academyLogoSmall;
  const circle = size === 'header';
  return (
    <Box
      width={px}
      height={px}
      borderRadius={circle ? undefined : url ? 'lg' : 'md'}
      borderWidth={url && !circle ? theme.border.width : 0}
      style={circle ? { borderRadius: px / 2 } : undefined}
      borderColor="border"
      backgroundColor={url ? 'surface' : 'surfaceRaised'}
      alignItems="center"
      justifyContent="center"
      overflow="hidden"
      accessibilityRole="image"
      accessibilityLabel={`Logo da ${name}`}
    >
      {url ? (
        <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={0} />
      ) : (
        <Text variant={size === 'header' ? 'caption' : size === 'small' ? 'heading' : 'title'} color="accent">
          {initials(name)}
        </Text>
      )}
    </Box>
  );
}
