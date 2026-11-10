import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { ImagePickerOptions } from 'expo-image-picker';
import { Platform } from 'react-native';

/** Event covers are stored at 1280×720 JPEG: well under the 2 MB bucket limit. */
export const COVER_WIDTH = 1280;
export const COVER_HEIGHT = 720;
export const COVER_ASPECT = COVER_WIDTH / COVER_HEIGHT;

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/** Center-crops to 16:9 (the picker does not always crop), resizes to 1280×720 and compresses as JPEG. */
export async function prepareCoverImage(uri: string): Promise<{ bytes: ArrayBuffer; contentType: string; extension: string }> {
  const original = await ImageManipulator.manipulate(uri).renderAsync();
  const context = ImageManipulator.manipulate(original);
  const ratio = original.width / original.height;
  if (Math.abs(ratio - COVER_ASPECT) > 0.01) {
    const width = ratio > COVER_ASPECT ? Math.floor(original.height * COVER_ASPECT) : original.width;
    const height = ratio > COVER_ASPECT ? original.height : Math.floor(original.width / COVER_ASPECT);
    context.crop({
      originX: Math.floor((original.width - width) / 2),
      originY: Math.floor((original.height - height) / 2),
      width,
      height,
    });
  }
  context.resize({ width: COVER_WIDTH, height: COVER_HEIGHT });
  const image = await context.renderAsync();
  const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
  if (!result.base64) throw new Error('unknown');
  return { bytes: base64ToArrayBuffer(result.base64), contentType: 'image/jpeg', extension: 'jpg' };
}

/** Same trade-off as `squarePickerOptions`: no crop screen on the iOS library (slow legacy picker). */
export function coverPickerOptions(from: 'camera' | 'library'): ImagePickerOptions {
  return {
    mediaTypes: 'images',
    allowsEditing: from === 'camera' || Platform.OS !== 'ios',
    aspect: [16, 9],
    quality: 1,
  };
}
