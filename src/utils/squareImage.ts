import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

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
 * The picker crops to a square (`aspect: [1, 1]`), but some cameras ignore
 * it: center-crops to the shorter side anyway, then resizes to 512×512 and
 * compresses as JPEG before the upload.
 */
export async function prepareSquareImage(
  uri: string,
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
  context.resize({ width: SQUARE_IMAGE_SIZE, height: SQUARE_IMAGE_SIZE });
  const image = await context.renderAsync();
  const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
  if (!result.base64) throw new Error('unknown');
  return { bytes: base64ToArrayBuffer(result.base64), contentType: 'image/jpeg', extension: 'jpg' };
}
