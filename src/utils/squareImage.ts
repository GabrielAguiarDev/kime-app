import { FlipType, ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { ImagePickerOptions } from 'expo-image-picker';

import type { CropRect } from './cropRect';

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
 * Picker options for a square image: never the system crop. The app's own crop
 * screen (PhotoCropper, move and pinch like WhatsApp) comes right after, on
 * both platforms and for camera and library. Without `allowsEditing` iOS also
 * keeps the fast PHPicker for the library.
 */
export function squarePickerOptions(_from: 'camera' | 'library'): ImagePickerOptions {
  return {
    mediaTypes: 'images',
    allowsEditing: false,
    quality: 1,
  };
}

/** Side of the image the crop screen hands back (the uploads resize it again). */
const CROPPED_SIZE = 1024;


/** Pixel size of an image as the manipulator sees it (orientation applied). */
export async function imagePixelSize(uri: string): Promise<{ width: number; height: number }> {
  const image = await ImageManipulator.manipulate(uri).renderAsync();
  return { width: image.width, height: image.height };
}

/** Crops the region chosen on the crop screen and returns a local JPEG (at most 1024×1024). */
export async function cropSquareImage(uri: string, rect: CropRect): Promise<string> {
  const context = ImageManipulator.manipulate(uri);
  context.crop(rect);
  if (rect.width > CROPPED_SIZE) context.resize({ width: CROPPED_SIZE, height: CROPPED_SIZE });
  const image = await context.renderAsync();
  const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.92 });
  return result.uri;
}
