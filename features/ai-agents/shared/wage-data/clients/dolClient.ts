/**
 * DOL (Department of Labor) API Client
 * U.S. Department of Labor Career Information API
 *
 * Registration: https://www.careeronestop.org/Developers/WebAPI/registration.aspx
 * Documentation: https://www.careeronestop.org/Developers/WebAPI/web-api.aspx
 */

import axios from 'axios';
import logger from '@/server/logger';
import {
  DolWageData,
  DolApiResponse,
} from '../types/dolTypes';
import { getConfig } from '@/server/config';
import { ANNUAL_WORK_HOURS } from '../constants';

const DOL_API_BASE = 'https://api.careeronestop.org/v1';

/**
 * Validate SOC code format
 * Valid formats: XX-XXXX or XX-XXXX.XX
 */
function isValidSocCode(socCode: string): boolean {
  // SOC codes are in format: XX-XXXX or XX-XXXX.XX
  const socPattern = /^\d{2}-\d{4}(\.\d{2})?$/;
  return socPattern.test(socCode);
}

/**
 * Validate location parameter
 * Must be either "US" (national) or valid 2-letter state code
 */
function isValidLocation(location: string): boolean {
  const validStates = [
    'US', // National
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
    'DC', 'PR', // DC and Puerto Rico
  ];
  return validStates.includes(location.toUpperCase());
}

/**
 * Build O*NET code from SOC code
 * DOL API uses O*NET codes which are similar to SOC codes
 * Format: XX-XXXX.XX (e.g., 15-1252.00)
 */
export function socToOnetCode(socCode: string): string {
  // Most O*NET codes are just SOC codes with .00 appended
  return socCode.includes('.') ? socCode : `${socCode}.00`;
}

/**
 * Fetch wage data from DOL API
 */
export async function fetchDolWageData(
  socCode: string,
  location: string = 'US' // US for national, or state abbreviation
): Promise<DolWageData | null> {
  const config = getConfig();

  if (!config.wageData.dolUserId || !config.wageData.dolApiKey) {
    logger.warn('DOL API credentials not configured');
    return null;
  }

  // Validate inputs to prevent SSRF attacks
  if (!isValidSocCode(socCode)) {
    logger.error(`Invalid SOC code format: ${socCode}`);
    return null;
  }

  const normalizedLocation = location.toUpperCase();
  if (!isValidLocation(normalizedLocation)) {
    logger.error(`Invalid location code: ${location}`);
    return null;
  }

  const onetCode = socToOnetCode(socCode);

  const result = await fetchDolWageDataForCode(onetCode, normalizedLocation, config);

  // If the specific sub-code returned no data, fall back to the base .00 code
  if (!result && onetCode.endsWith('.00') === false) {
    const baseCode = `${onetCode.split('.')[0]}.00`;
    logger.info(`No DOL data for ${onetCode}, retrying with base code ${baseCode}`);
    return fetchDolWageDataForCode(baseCode, normalizedLocation, config);
  }

  return result;
}

async function fetchDolWageDataForCode(
  onetCode: string,
  normalizedLocation: string,
  config: ReturnType<typeof getConfig>
): Promise<DolWageData | null> {
  // Use URL encoding to safely construct the URL
  const userId = encodeURIComponent(config.wageData.dolUserId);
  const encodedOnetCode = encodeURIComponent(onetCode);
  const encodedLocation = encodeURIComponent(normalizedLocation);
  const url = `${DOL_API_BASE}/occupation/${userId}/${encodedOnetCode}/${encodedLocation}`;

  try {
    logger.info(`Fetching DOL data for ${onetCode} in ${normalizedLocation}`);

    const response = await axios.get<DolApiResponse>(url, {
      headers: {
        'Authorization': `Bearer ${config.wageData.dolApiKey}`,
        'Content-Type': 'application/json',
      },
      params: {
        training: false, // Don't include training data
        interest: false, // Don't include interest data
        wages: true,     // Include wage data
      },
      timeout: 10000,
    });

    const data = response.data;

    if (!data || !data.OccupationDetail || data.OccupationDetail.length === 0) {
      logger.warn(`No occupation data returned for ${onetCode}`);
      return null;
    }

    const occupationDetail = data.OccupationDetail[0];
    const wages = occupationDetail.Wages;

    if (!wages || !wages.NationalWagesList || wages.NationalWagesList.length === 0) {
      logger.warn(`No wage data returned for ${onetCode}`);
      return null;
    }

    // Find hourly and annual wages
    const hourlyWages = wages.NationalWagesList.find(w => w.RateType === 'Hourly');
    const annualWages = wages.NationalWagesList.find(w => w.RateType === 'Annual');

    if (!hourlyWages && !annualWages) {
      logger.warn(`No hourly or annual wage data for ${onetCode}`);
      return null;
    }

    // Parse string values to numbers and calculate missing data
    let hourlyData: { Pct10: number; Pct25: number; Median: number; Pct75: number; Pct90: number; };
    let annualData: { Pct10: number; Pct25: number; Median: number; Pct75: number; Pct90: number; };

    if (hourlyWages) {
      hourlyData = {
        Pct10: parseFloat(hourlyWages.Pct10),
        Pct25: parseFloat(hourlyWages.Pct25),
        Median: parseFloat(hourlyWages.Median),
        Pct75: parseFloat(hourlyWages.Pct75),
        Pct90: parseFloat(hourlyWages.Pct90),
      };
    } else {
      // Convert annual to hourly (ANNUAL_WORK_HOURS = 48 weeks × 40 hours)
      hourlyData = {
        Pct10: parseFloat(annualWages!.Pct10) / ANNUAL_WORK_HOURS,
        Pct25: parseFloat(annualWages!.Pct25) / ANNUAL_WORK_HOURS,
        Median: parseFloat(annualWages!.Median) / ANNUAL_WORK_HOURS,
        Pct75: parseFloat(annualWages!.Pct75) / ANNUAL_WORK_HOURS,
        Pct90: parseFloat(annualWages!.Pct90) / ANNUAL_WORK_HOURS,
      };
    }

    if (annualWages) {
      annualData = {
        Pct10: parseFloat(annualWages.Pct10),
        Pct25: parseFloat(annualWages.Pct25),
        Median: parseFloat(annualWages.Median),
        Pct75: parseFloat(annualWages.Pct75),
        Pct90: parseFloat(annualWages.Pct90),
      };
    } else {
      // Convert hourly to annual (ANNUAL_WORK_HOURS = 48 weeks × 40 hours)
      annualData = {
        Pct10: hourlyData.Pct10 * ANNUAL_WORK_HOURS,
        Pct25: hourlyData.Pct25 * ANNUAL_WORK_HOURS,
        Median: hourlyData.Median * ANNUAL_WORK_HOURS,
        Pct75: hourlyData.Pct75 * ANNUAL_WORK_HOURS,
        Pct90: hourlyData.Pct90 * ANNUAL_WORK_HOURS,
      };
    }

    // Extract and log wage year for debugging
    const wageYear = wages.WageYear;
    logger.info(`DOL WageYear for ${onetCode}:`, { wageYear });

    return {
      onetCode,
      socCode: onetCode, // Use the 8-digit O*NET code since that's what DOL/CareerOneStop uses
      occupationTitle: occupationDetail.OnetTitle || occupationDetail.SocInfo?.SocTitle || '',
      hourlyMedian: parseFloat(hourlyData.Median.toFixed(2)),
      hourlyPct10: parseFloat(hourlyData.Pct10.toFixed(2)),
      hourlyPct25: parseFloat(hourlyData.Pct25.toFixed(2)),
      hourlyPct75: parseFloat(hourlyData.Pct75.toFixed(2)),
      hourlyPct90: parseFloat(hourlyData.Pct90.toFixed(2)),
      annualMedian: parseFloat(annualData.Median.toFixed(0)),
      annualPct10: parseFloat(annualData.Pct10.toFixed(0)),
      annualPct25: parseFloat(annualData.Pct25.toFixed(0)),
      annualPct75: parseFloat(annualData.Pct75.toFixed(0)),
      annualPct90: parseFloat(annualData.Pct90.toFixed(0)),
      location: normalizedLocation,
      dataSource: 'DOL',
      dataYear: wageYear || 'Current',
      fetchedAt: new Date().toISOString(),
    };

  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error(`DOL API error for ${onetCode}`, {
        status: error.response?.status,
        data: error.response?.data,
      });
    } else {
      logger.error(`Error fetching DOL data for ${onetCode}`, error);
    }
    return null;
  }
}

/**
 * Fetch wage data for multiple SOC codes with rate limiting
 */
export async function fetchBulkDolData(
  socCodes: string[],
  delayMs: number = 500
): Promise<Map<string, DolWageData>> {
  const results = new Map<string, DolWageData>();

  for (const socCode of socCodes) {
    const data = await fetchDolWageData(socCode);
    if (data) {
      results.set(socCode, data);
    }

    // Rate limiting
    if (socCodes.indexOf(socCode) < socCodes.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return results;
}
