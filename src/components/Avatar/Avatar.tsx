import { Image } from 'expo-image';
import { useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { useAvatarUrl } from '@domain/Profile';
import { useAppTheme } from '@theme';

import { Box } from '../Box/Box';
import { PhotoViewer, type PhotoOrigin } from '../PhotoViewer/PhotoViewer';
import { Icon } from '../Icon/Icon';
import { Text } from '../Text/Text';

interface AvatarProps {
  name: string;
  /** Path in the private `avatars` bucket; null shows the initials. */
  path: string | null | undefined;
  size?: 'large' | 'small' | number;
  /** Small trophy badge on the bottom-right corner: competes (in the modality shown). */
  competitor?: boolean;
  /** With a photo: a tap opens it full screen, growing from the avatar (PhotoViewer). */
  expandable?: boolean;
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
export function Avatar({ name, path, size = 'small', competitor = false, expandable = false }: AvatarProps) {
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
  // Competitor seal: just the trophy, in a small accent circle cut out of the photo's corner.
  const badge = Math.round(px * 0.36);
  const content = !competitor ? (
    photo
  ) : (
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
  if (!expandable || !path) return content;
  return (
    <ExpandablePhoto name={name} path={path} px={px}>
      {content}
    </ExpandablePhoto>
  );
}

/** Wraps the avatar: a tap measures it and opens the full-size photo from there. */
function ExpandablePhoto({ name, path, px, children }: { name: string; path: string; px: number; children: ReactNode }) {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const [origin, setOrigin] = useState<PhotoOrigin | null>(null);
  const full = useAvatarUrl(path, true);
  const open = () =>
    ref.current?.measureInWindow((x, y) => setOrigin({ x, y, width: px, height: px }));
  return (
    <>
      <Pressable
        onPress={full.data ? open : undefined}
        disabled={!full.data}
        accessibilityRole="imagebutton"
        accessibilityLabel={`Foto de ${name}. Ampliar`}
      >
        <View ref={ref} collapsable={false}>
          {children}
        </View>
      </Pressable>
      {full.data ? (
        <PhotoViewer
          uri={full.data}
          cacheKey={path}
          origin={origin}
          accessibilityLabel={`Foto de ${name}`}
          onClose={() => setOrigin(null)}
        />
      ) : null}
    </>
  );
}
