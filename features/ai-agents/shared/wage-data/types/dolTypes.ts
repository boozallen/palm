/**
 * DOL (Department of Labor) API Types
 * Official U.S. Department of Labor wage data API
 */

export interface DolWageData {
  onetCode: string;
  socCode: string;
  occupationTitle: string;
  hourlyMedian: number;
  hourlyPct10: number;
  hourlyPct25: number;
  hourlyPct75: number;
  hourlyPct90: number;
  annualMedian: number;
  annualPct10: number;
  annualPct25: number;
  annualPct75: number;
  annualPct90: number;
  location: string;
  dataSource: 'DOL';
  dataYear: string;
  fetchedAt: string;
}

export interface DolApiResponse {
  OccupationDetail: {
    OnetTitle: string;
    OnetCode: string;
    OnetDescription: string;
    Wages: {
      NationalWagesList: {
        RateType: string; // 'Hourly' or 'Annual'
        Pct10: string;
        Pct25: string;
        Median: string;
        Pct75: string;
        Pct90: string;
        StFips: string;
        Area: string;
        AreaName: string;
      }[];
      StateWagesList: any[];
      BLSAreaWagesList: any[];
      WageYear: string;
      SocData: string;
      SocWageInfo: {
        SocCode: string;
        SocTitle: string;
        SocDescription: string | null;
      };
    };
    BrightOutlook: string;
    Green: string;
    SocInfo: {
      SocCode: string;
      SocTitle: string;
      SocDescription: string;
    };
  }[];
  RecordCount: number;
  DidYouMean: string;
  AutoCorrection: string;
}
