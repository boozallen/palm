/**
 * Salary.com API Types
 * Documentation: https://daasjobmatchapi.salary.com/
 */

export interface SalaryComTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export interface SalaryComDataScope {
  CountryCode: string;
  State?: string;
  City?: string;
  ZipCode?: string;
  NAICSCode?: string;
  FTEValue?: number;
  Revenue?: number;
}

export interface SalaryComJobPricingRequest {
  JobTitle: string;
  JobDesc: string;
  CompanyName?: string;
  DataScope: SalaryComDataScope;
}

export interface SalaryComJobPricingResponse {
  Code: number;
  Data: {
    MatchRating: string; // "Potential", "Good", "Excellent", etc.
    Salary10: number;
    Salary25: number;
    Salary50: number;
    Salary75: number;
    Salary90: number;
    Comp10: number;
    Comp25: number;
    Comp50: number;
    Comp75: number;
    Comp90: number;
    BonusTarget50: number;
    BonusTargetAvg: number;
    LTIValue50: number;
    LTIValueAvg: number;
    LTIEligPercent: number;
    CurrencyCode: string;
    DataScope_IndustryCode: string;
    DataScope_IndustryName: string;
    DataScope_FTERange: string;
    DataScope_CountryCode: string;
    BenchmarkJobTitle: string;
    JobFamilyName: string;
    JobLevelName: string;
  };
}

/**
 * Normalized wage data from Salary.com
 */
export interface SalaryComWageData {
  jobTitle: string;
  benchmarkJobTitle: string;
  jobLevelName: string;
  jobFamilyName: string;
  matchRating: string;
  salary10: number;
  salary25: number;
  salary50: number;
  salary75: number;
  salary90: number;
  dataScope: {
    countryCode: string;
    state?: string;
    industryCode: string;
    industryName: string;
  };
  fetchedAt: string;
}
