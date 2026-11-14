import { formatVolume } from '../waterRules';

describe('formatVolume', () => {
  it('ml below 1 liter', () => {
    expect(formatVolume(0)).toBe('0 ml');
    expect(formatVolume(500)).toBe('500 ml');
    expect(formatVolume(999)).toBe('999 ml');
  });
  it('liters with one decimal from 1 liter on', () => {
    expect(formatVolume(1000)).toBe('1 L');
    expect(formatVolume(1250)).toBe('1,3 L');
    expect(formatVolume(2279)).toBe('2,3 L');
    expect(formatVolume(4500)).toBe('4,5 L');
    expect(formatVolume(12000)).toBe('12 L');
  });
});
