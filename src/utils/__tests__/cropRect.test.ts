import { cropRectFor } from '../cropRect';

describe('cropRectFor', () => {
  const tall = { width: 1000, height: 2000 };
  const wide = { width: 2000, height: 1000 };

  it('takes the centered square of the shorter side at zoom 1', () => {
    expect(cropRectFor(tall, 300, 1, 0, 0, false)).toEqual({ originX: 0, originY: 500, width: 1000, height: 1000 });
    expect(cropRectFor(wide, 300, 1, 0, 0, false)).toEqual({ originX: 500, originY: 0, width: 1000, height: 1000 });
  });

  it('moving the image down shows its upper part', () => {
    // 0.3 screen px per image px: 100 px down = 333 image px up.
    expect(cropRectFor(tall, 300, 1, 0, 100, false).originY).toBe(167);
  });

  it('zoom crops a smaller region around the same center', () => {
    expect(cropRectFor(tall, 300, 2, 0, 0, false)).toEqual({ originX: 250, originY: 750, width: 500, height: 500 });
  });

  it('never leaves the image', () => {
    const r = cropRectFor(tall, 300, 1, 0, 10_000, false);
    expect(r.originY).toBe(0);
    expect(cropRectFor(tall, 300, 1, 0, -10_000, false).originY).toBe(1000);
  });

  it('mirrored: the region seen on screen is taken from the other side', () => {
    // Moving right shows the left of the flipped picture = the right of the raw one.
    const seen = cropRectFor(wide, 300, 1, 50, 0, false);
    const raw = cropRectFor(wide, 300, 1, 50, 0, true);
    expect(seen.originX).toBe(333);
    expect(raw.originX).toBe(2000 - 333 - 1000);
  });
});
