import { formatBirthDate, maskBirthDate, parseBirthDate } from '../profileRules';

describe('birth date', () => {
  it('masks digits as DD/MM/AAAA', () => {
    expect(maskBirthDate('1')).toBe('1');
    expect(maskBirthDate('150')).toBe('15/0');
    expect(maskBirthDate('15031990')).toBe('15/03/1990');
    expect(maskBirthDate('15/03/1990999')).toBe('15/03/1990');
  });

  it('parses real past dates only', () => {
    expect(parseBirthDate('15/03/1990', '2026-11-04')).toBe('1990-03-15');
    expect(parseBirthDate('29/02/2000', '2026-11-04')).toBe('2000-02-29');
    expect(parseBirthDate('29/02/2001', '2026-11-04')).toBeNull();
    expect(parseBirthDate('31/04/1990', '2026-11-04')).toBeNull();
    expect(parseBirthDate('01/01/1899', '2026-11-04')).toBeNull();
    expect(parseBirthDate('05/11/2026', '2026-11-04')).toBeNull();
    expect(parseBirthDate('04/11/2026', '2026-11-04')).toBe('2026-11-04');
    expect(parseBirthDate('1990-03-15', '2026-11-04')).toBeNull();
  });

  it('formats ISO back to DD/MM/AAAA', () => {
    expect(formatBirthDate('1990-03-15')).toBe('15/03/1990');
    expect(formatBirthDate(null)).toBe('');
  });
});
