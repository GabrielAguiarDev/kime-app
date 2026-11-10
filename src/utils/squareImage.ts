import { FlipType, ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { ImagePickerOptions } from 'expo-image-picker';
import { Platform } from 'react-native';

/** Square images (academy logo, profile photo) are stored at this size: small enough for the 2 MB buckets. */
export const SQUARE_IMAGE_SIZE = 512;

/** base64 → bytes (Hermes ships atob). */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/**
 * The picker may crop to a square (`aspect: [1, 1]`), but not always (iOS
 * library, cameras that ignore it): center-crops to the shorter side anyway, then resizes to 512×512 and
 * compresses as JPEG before the upload.
 */
export async function prepareSquareImage(
  uri: string,
  size: number = SQUARE_IMAGE_SIZE,
  mirror = false,
): Promise<{ bytes: ArrayBuffer; contentType: string; extension: string }> {
  const original = await ImageManipulator.manipulate(uri).renderAsync();
  const side = Math.min(original.width, original.height);
  const context = ImageManipulator.manipulate(original);
  if (original.width !== original.height) {
    context.crop({
      originX: Math.floor((original.width - side) / 2),
      originY: Math.floor((original.height - side) / 2),
      width: side,
      height: side,
    });
  }
  if (mirror) context.flip(FlipType.Horizontal);
  context.resize({ width: size, height: size });
  const image = await context.renderAsync();
  const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
  if (!result.base64) throw new Error('unknown');
  return { bytes: base64ToArrayBuffer(result.base64), contentType: 'image/jpeg', extension: 'jpg' };
}

/**
 * Picker options for a square image. On iOS `allowsEditing` swaps the fast
 * PHPicker for the legacy UIImagePickerController, which loads the whole
 * library before showing up (seconds on a real device): the library opens
 * without the crop screen there and `prepareSquareImage` center-crops. The
 * camera always uses the legacy controller, so it keeps the crop.
 */
export function squarePickerOptions(from: 'camera' | 'library'): ImagePickerOptions {
  return {
    mediaTypes: 'images',
    allowsEditing: from === 'camera' || Platform.OS !== 'ios',
    aspect: [1, 1],
    quality: 1,
  };
}
