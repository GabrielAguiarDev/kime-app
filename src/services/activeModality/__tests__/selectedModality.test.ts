import { resolveSelectedModality } from '../selectedModality';

describe('resolveSelectedModality', () => {
  it('keeps the stored modality while the student is linked to it', () => {
    expect(resolveSelectedModality(['bjj', 'nogi'], 'nogi')).toBe('nogi');
  });
  it('falls back to the first modality when the stored one is gone', () => {
    expect(resolveSelectedModality(['bjj', 'nogi'], 'muay')).toBe('bjj');
  });
  it('uses the first modality with nothing stored', () => {
    expect(resolveSelectedModality(['bjj'], null)).toBe('bjj');
  });
  it('is null without modalities', () => {
    expect(resolveSelectedModality([], 'bjj')).toBeNull();
  });
});
