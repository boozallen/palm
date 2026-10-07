// Maps OPM locality pay area names to their 2026 locality payment percentages and
// normalized multipliers for use in rate calculations.
//
// localityMultiplier = (1 + localityPercent/100) / (1 + 0.1706)
// where 17.06% is the 2026 "Rest of U.S." baseline, making Rest of U.S. = 1.0000.
//
// Source: OPM 2026 General Schedule Locality Pay Tables
//   https://www.opm.gov/policy-data-oversight/pay-leave/salaries-wages/2026/general-schedule/

export type RegionMapping = {
  localityPercent: number;   // OPM 2026 locality payment percentage
  localityMultiplier: number; // normalized to Rest of U.S. = 1.0
};

export const REGION_MAPPINGS: Record<string, RegionMapping> = {
  'US Baseline':                                           { localityPercent: 17.06, localityMultiplier: 1.0000 },

  // Northeast
  'Albany-Schenectady, NY-MA':                             { localityPercent: 20.77, localityMultiplier: 1.0317 },
  'Boston-Worcester-Providence, MA-RI-NH-CT-ME-VT':        { localityPercent: 32.58, localityMultiplier: 1.1325 },
  'Buffalo-Cheektowaga-Olean, NY':                         { localityPercent: 22.41, localityMultiplier: 1.0457 },
  'Burlington-South Burlington-Barre, VT':                 { localityPercent: 19.45, localityMultiplier: 1.0204 },
  'Hartford-East Hartford, CT-MA':                         { localityPercent: 32.08, localityMultiplier: 1.1283 },
  'New York-Newark, NY-NJ-CT-PA':                          { localityPercent: 37.95, localityMultiplier: 1.1785 },
  'Philadelphia-Reading-Camden, PA-NJ-DE-MD':              { localityPercent: 28.99, localityMultiplier: 1.1019 },
  'Pittsburgh-New Castle-Weirton, PA-OH-WV':               { localityPercent: 21.03, localityMultiplier: 1.0339 },
  'Rochester-Batavia-Seneca Falls, NY':                    { localityPercent: 17.88, localityMultiplier: 1.0070 },

  // Mid-Atlantic / Southeast
  'Charlotte-Concord, NC-SC':                              { localityPercent: 19.67, localityMultiplier: 1.0223 },
  'Harrisburg-Lebanon, PA':                                { localityPercent: 19.43, localityMultiplier: 1.0202 },
  'Raleigh-Durham-Cary, NC':                               { localityPercent: 22.24, localityMultiplier: 1.0443 },
  'Richmond, VA':                                          { localityPercent: 22.28, localityMultiplier: 1.0446 },
  'Virginia Beach-Norfolk, VA-NC':                         { localityPercent: 18.80, localityMultiplier: 1.0149 },
  'Washington-Baltimore-Arlington, DC-MD-VA-WV-PA':        { localityPercent: 33.94, localityMultiplier: 1.1442 },

  // South
  'Atlanta--Athens-Clarke County--Sandy Springs, GA-AL':   { localityPercent: 23.79, localityMultiplier: 1.0575 },
  'Birmingham-Hoover-Talladega, AL':                       { localityPercent: 18.24, localityMultiplier: 1.0101 },
  'Corpus Christi-Kingsville-Alice, TX':                   { localityPercent: 17.63, localityMultiplier: 1.0049 },
  'Dallas-Fort Worth, TX-OK':                              { localityPercent: 27.26, localityMultiplier: 1.0871 },
  'Houston-The Woodlands, TX':                             { localityPercent: 35.00, localityMultiplier: 1.1533 },
  'Huntsville-Decatur, AL-TN':                             { localityPercent: 21.91, localityMultiplier: 1.0414 },
  'Laredo, TX':                                            { localityPercent: 21.59, localityMultiplier: 1.0387 },
  'Miami-Port St. Lucie-Fort Lauderdale, FL':              { localityPercent: 24.67, localityMultiplier: 1.0650 },
  'Palm Bay-Melbourne-Titusville, FL':                     { localityPercent: 17.93, localityMultiplier: 1.0074 },
  'San Antonio-New Braunfels-Pearsall, TX':                { localityPercent: 18.78, localityMultiplier: 1.0147 },

  // Midwest
  'Chicago-Naperville, IL-IN-WI':                          { localityPercent: 30.86, localityMultiplier: 1.1179 },
  'Cincinnati-Wilmington-Maysville, OH-KY-IN':             { localityPercent: 21.93, localityMultiplier: 1.0416 },
  'Cleveland-Akron-Canton, OH-PA':                         { localityPercent: 22.23, localityMultiplier: 1.0442 },
  'Columbus-Marion-Zanesville, OH':                        { localityPercent: 22.15, localityMultiplier: 1.0435 },
  'Davenport-Moline, IA-IL':                               { localityPercent: 18.93, localityMultiplier: 1.0160 },
  'Dayton-Springfield-Kettering, OH':                      { localityPercent: 21.42, localityMultiplier: 1.0373 },
  'Des Moines-Ames-West Des Moines, IA':                   { localityPercent: 18.01, localityMultiplier: 1.0081 },
  'Detroit-Warren-Ann Arbor, MI':                          { localityPercent: 29.12, localityMultiplier: 1.1030 },
  'Indianapolis-Carmel-Muncie, IN':                        { localityPercent: 18.15, localityMultiplier: 1.0093 },
  'Kansas City-Overland Park-Kansas City, MO-KS':          { localityPercent: 18.97, localityMultiplier: 1.0163 },
  'Milwaukee-Racine-Waukesha, WI':                         { localityPercent: 22.42, localityMultiplier: 1.0458 },
  'Minneapolis-St. Paul, MN-WI':                           { localityPercent: 27.62, localityMultiplier: 1.0902 },
  'Omaha-Council Bluffs-Fremont, NE-IA':                   { localityPercent: 18.23, localityMultiplier: 1.0100 },
  'St. Louis-St. Charles-Farmington, MO-IL':               { localityPercent: 20.03, localityMultiplier: 1.0254 },

  // Mountain / Southwest
  'Albuquerque-Santa Fe-Las Vegas, NM':                    { localityPercent: 18.33, localityMultiplier: 1.0109 },
  'Austin-Round Rock-Georgetown, TX':                      { localityPercent: 20.35, localityMultiplier: 1.0281 },
  'Colorado Springs, CO':                                  { localityPercent: 20.15, localityMultiplier: 1.0264 },
  'Denver-Aurora, CO':                                     { localityPercent: 30.52, localityMultiplier: 1.1150 },
  'Las Vegas-Henderson, NV-AZ':                            { localityPercent: 19.57, localityMultiplier: 1.0214 },
  'Phoenix-Mesa, AZ':                                      { localityPercent: 22.45, localityMultiplier: 1.0461 },
  'Reno-Fernley, NV':                                      { localityPercent: 17.52, localityMultiplier: 1.0039 },
  'Tucson-Nogales, AZ':                                    { localityPercent: 19.28, localityMultiplier: 1.0190 },

  // West Coast / Pacific
  'Fresno-Madera-Hanford, CA':                             { localityPercent: 17.65, localityMultiplier: 1.0050 },
  'Los Angeles-Long Beach, CA':                            { localityPercent: 36.47, localityMultiplier: 1.1658 },
  'Portland-Vancouver-Salem, OR-WA':                       { localityPercent: 26.13, localityMultiplier: 1.0775 },
  'Sacramento-Roseville, CA-NV':                           { localityPercent: 29.76, localityMultiplier: 1.1085 },
  'San Diego-Chula Vista-Carlsbad, CA':                    { localityPercent: 33.72, localityMultiplier: 1.1423 },
  'San Jose-San Francisco-Oakland, CA':                    { localityPercent: 46.34, localityMultiplier: 1.2501 },
  'Seattle-Tacoma, WA':                                    { localityPercent: 31.57, localityMultiplier: 1.1240 },
  'Spokane-Spokane Valley-Coeur d\'Alene, WA-ID':          { localityPercent: 17.67, localityMultiplier: 1.0052 },

  // States with special locality tables
  'Alaska':                                                { localityPercent: 32.36, localityMultiplier: 1.1307 },
  'Hawaii':                                                { localityPercent: 22.21, localityMultiplier: 1.0440 },
};

export function getRegionMapping(region: string): RegionMapping {
  return REGION_MAPPINGS[region] ?? REGION_MAPPINGS['US Baseline'];
}
