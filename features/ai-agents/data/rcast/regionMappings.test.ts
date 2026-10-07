import { getRegionMapping, REGION_MAPPINGS } from './regionMappings';

describe('getRegionMapping', () => {
  it('US Baseline has a localityMultiplier of 1.0', () => {
    expect(getRegionMapping('US Baseline').localityMultiplier).toBe(1.0000);
  });

  it.each([
    ['Washington-Baltimore-Arlington, DC-MD-VA-WV-PA', 33.94, 1.1442],
    ['New York-Newark, NY-NJ-CT-PA', 37.95, 1.1785],
    ['Boston-Worcester-Providence, MA-RI-NH-CT-ME-VT', 32.58, 1.1325],
    ['San Jose-San Francisco-Oakland, CA', 46.34, 1.2501],
    ['Los Angeles-Long Beach, CA', 36.47, 1.1658],
    ['Seattle-Tacoma, WA', 31.57, 1.1240],
    ['Dallas-Fort Worth, TX-OK', 27.26, 1.0871],
    ['Atlanta--Athens-Clarke County--Sandy Springs, GA-AL', 23.79, 1.0575],
    ['Huntsville-Decatur, AL-TN', 21.91, 1.0414],
  ])('"%s" has localityPercent %d and localityMultiplier %d', (region, percent, multiplier) => {
    const mapping = getRegionMapping(region);
    expect(mapping.localityPercent).toBe(percent);
    expect(mapping.localityMultiplier).toBe(multiplier);
  });

  it('falls back to US Baseline values for an unknown region', () => {
    expect(getRegionMapping('Atlantis').localityMultiplier).toBe(1.0000);
    expect(getRegionMapping('Atlantis').localityPercent).toBe(17.06);
    expect(getRegionMapping('').localityMultiplier).toBe(1.0000);
  });

  it('every entry has a positive localityPercent and localityMultiplier', () => {
    for (const [, mapping] of Object.entries(REGION_MAPPINGS)) {
      expect(mapping.localityPercent).toBeGreaterThan(0);
      expect(mapping.localityMultiplier).toBeGreaterThan(0);
      expect(Number.isFinite(mapping.localityMultiplier)).toBe(true);
    }
  });

  it('covers all 2026 OPM locality areas (at least 58 entries)', () => {
    expect(Object.keys(REGION_MAPPINGS).length).toBeGreaterThanOrEqual(58);
  });
});
