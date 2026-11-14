/** A region of an image, in its pixels (after the EXIF orientation). */
export interface CropRect {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

export function clampValue(value: number, min: number, max: number) {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

/**
 * Crop rectangle (image pixels) for what is inside the frame: the image is
 * drawn at `base * zoom` px per image pixel, centered on the frame and moved by
 * (tx, ty). `mirrored`: the screen shows the image flipped, so the region is
 * taken from the other side (the upload flips it afterwards).
 */
export function cropRectFor(
  image: { width: number; height: number },
  frame: number,
  zoom: number,
  tx: number,
  ty: number,
  mirrored: boolean,
): CropRect {
  const perPixel = Math.max(frame / image.width, frame / image.height) * zoom;
  const side = Math.min(frame / perPixel, image.width, image.height);
  const shownX = (image.width * perPixel) / 2 - frame / 2 - tx;
  const originY = (image.height * perPixel) / 2 - frame / 2 - ty;
  const x = clampValue(Math.round(shownX / perPixel), 0, image.width - side);
  return {
    originX: mirrored ? Math.round(image.width - x - side) : x,
    originY: clampValue(Math.round(originY / perPixel), 0, image.height - side),
    width: Math.round(side),
    height: Math.round(side),
  };
}
