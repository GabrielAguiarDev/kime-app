import { Image } from 'expo-image';
import { useState } from 'react';

import { useAvatarUrl } from '@domain/Profile';
import { useAppTheme } from '@theme';

import { Box } from '../Box/Box';
import { Icon } from '../Icon/Icon';
import { Text } from '../Text/Text';

interface AvatarProps {
  name: string;
  /** Path in the private `avatars` bucket; null shows the initials. */
  path: string | null | undefined;
  size?: 'large' | 'small' | number;
  /** Small trophy badge on the bottom-right corner: competes (in the modality shown). */
  competitor?: boolean;
}

export function nameInitials(name: string): string {
  // Only words that start with a letter: "Ana Lima (você)" → "AL", not "A(".
  const words = name.trim().split(/\s+/).filter((w) => w[0]!.toLowerCase() !== w[0]!.toUpperCase());
  if (words.length === 0) return '?';
  const first = words[0]![0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1]![0] ?? '') : '';
  return `${first}${last}`.toUpperCase();
}

/**
 * Profile photo in a circle (signed URL from the private bucket). Without a
 * photo, or while it loads: the name's initials in accent on surface-raised.
 */
export function Avatar({ name, path, size = 'small', competitor = false }: AvatarProps) {
  const theme = useAppTheme();
  const [failedThumbnailPath, setFailedThumbnailPath] = useState<string | null>(null);
  const thumbnailPath = path?.replace('/avatar-', '/thumb-');
  const wantsThumbnail = size !== 'large' && !!path && thumbnailPath !== path && failedThumbnailPath !== thumbnailPath;
  const thumbUrl = useAvatarUrl(thumbnailPath, wantsThumbnail);
  const useThumbnail = wantsThumbnail && !thumbUrl.isError;
  const fullUrl = useAvatarUrl(path, !useThumbnail);
  const url = useThumbnail ? thumbUrl : fullUrl;
  const px = typeof size === 'number' ? size : size === 'large' ? theme.size.avatar : theme.size.avatarSmall;
  const photo = (
    <Box
      width={px}
      height={px}
      backgroundColor="surfaceRaised"
      borderWidth={theme.border.width}
      borderColor="border"
      alignItems="center"
      justifyContent="center"
      overflow="hidden"
      style={{ borderRadius: px / 2 }}
      accessibilityRole="image"
      accessibilityLabel={path ? `Foto de ${name}` : `Iniciais de ${name}`}
    >
      {url.data ? (
        <Image source={{ uri: url.data, cacheKey: path ?? undefined }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={0} onError={() => setFailedThumbnailPath(thumbnailPath ?? null)} />
      ) : (
        <Text variant={size === 'large' ? 'title' : 'bodyStrong'} color="accent">
          {nameInitials(name)}
        </Text>
      )}
    </Box>
  );
  if (!competitor) return photo;
  // Competitor seal: just the trophy, in a small accent circle cut out of the photo's corner.
  const badge = Math.round(px * 0.36);
  return (
    <Box width={px} height={px} accessible accessibilityLabel={`${path ? `Foto de ${name}` : `Iniciais de ${name}`}, competidor`}>
      {photo}
      <Box
        position="absolute"
        right={-badge / 8}
        bottom={-badge / 8}
        width={badge}
        height={badge}
        backgroundColor="accent"
        borderWidth={theme.border.width}
        borderColor="bg"
        alignItems="center"
        justifyContent="center"
        style={{ borderRadius: badge / 2 }}
      >
        <Icon name="trophy" size={Math.round(badge * 0.58)} color="onAccent" active />
      </Box>
    </Box>
  );
}
