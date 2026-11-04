import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/** Square logos are stored at this size: small enough for the 2 MB bucket limit. */
export const LOGO_SIZE = 512;

/** base64 → bytes (Hermes ships atob). */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/** Resizes the picked (already square-cropped) image and encodes it as JPEG. */
export async function prepareLogo(uri: string): Promise<{ bytes: ArrayBuffer; contentType: string; extension: string }> {
  const context = ImageManipulator.manipulate(uri);
  context.resize({ width: LOGO_SIZE, height: null });
  const image = await context.renderAsync();
  const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
  if (!result.base64) throw new Error('unknown');
  return { bytes: base64ToArrayBuffer(result.base64), contentType: 'image/jpeg', extension: 'jpg' };
}
