import axios from 'axios';
import { BlsWageData } from '../types/blsTypes';
import logger from '@/server/logger';
import { getConfig } from '@/server/config';
import { ANNUAL_WORK_HOURS } from '../constants';

const BLS_API_BASE_URL = 'https://api.bls.gov/publicAPI/v2/timeseries/data/';

/**
 * BLS OEWS data type codes
 * Format: OEUN0000000000000{occupation}{dataType}
 * - OEUN: Occupational Employment and Wage Statistics, National
 * - 0000000000000: National area code (13 zeros)
 * - {occupation}: 6-digit SOC code
 * - {dataType}: 2-digit data type code
 */
const DATA_TYPE_CODES = {
  ANNUAL_MEAN: '04',
  // Note: Series 06 is NOT the 50th percentile - BLS doesn't provide 50th percentile
  // Series 06 is "median hourly" but uses different methodology and doesn't match percentile distribution
  PERCENTILE_10: '11',
  PERCENTILE_25: '12',
  PERCENTILE_75: '13',
  PERCENTILE_90: '14',
} as const;

/**
 * Build BLS OEWS series ID for a specific data type
 * Strips O*NET suffix (.00, .01, etc.) to get base SOC code
 */
function buildSeriesId(socCode: string, dataType: string): string {
  // Remove O*NET suffix (.00, .01, etc.) and dashes
  const cleanCode = socCode.split('.')[0].replace(/-/g, '');
  const occupation = cleanCode.padEnd(6, '0').substring(0, 6);
  return `OEUN0000000000000${occupation}${dataType}`;
}

/**
 * Build all series IDs for a SOC code (mean and percentiles)
 * Note: BLS does not provide a 50th percentile series - we interpolate from 25th and 75th
 */
export function buildAllSeriesIds(socCode: string): {
  annualMean: string;
  percentile10: string;
  percentile25: string;
  percentile75: string;
  percentile90: string;
} {
  return {
    annualMean: buildSeriesId(socCode, DATA_TYPE_CODES.ANNUAL_MEAN),
    percentile10: buildSeriesId(socCode, DATA_TYPE_CODES.PERCENTILE_10),
    percentile25: buildSeriesId(socCode, DATA_TYPE_CODES.PERCENTILE_25),
    percentile75: buildSeriesId(socCode, DATA_TYPE_CODES.PERCENTILE_75),
    percentile90: buildSeriesId(socCode, DATA_TYPE_CODES.PERCENTILE_90),
  };
}

interface BlsApiRequestBody {
  seriesid: string[];
  startyear: string;
  endyear: string;
  registrationkey?: string;
}

/**
 * Fetch all wage data for a SOC code from BLS API in a single batch request
 * Returns the latest data including mean wages and percentiles (25th, 75th, 90th)
 * Note: BLS does not provide 50th percentile data (we interpolate it from 25th and 75th)
 */
export async function fetchWageData(socCode: string): Promise<BlsWageData | null> {
  try {
    const currentYear = new Date().getFullYear();
    // Request last 5 years to ensure we capture the latest available data
    // BLS API requires startyear/endyear parameters, can't just request "latest"
    // Data typically has 1-2 year publication lag, so we cast a wide net
    // and let the code find the data point marked with latest: true
    const startYear = currentYear - 5;
    const endYear = currentYear;
    const seriesIds = buildAllSeriesIds(socCode);
    const allSeriesIds = Object.values(seriesIds);

    const requestBody: BlsApiRequestBody = {
      seriesid: allSeriesIds,
      startyear: startYear.toString(),
      endyear: endYear.toString(),
    };

    // Add API key if available for higher rate limits
    const config = getConfig();
    if (config.wageData.blsApiKey) {
      requestBody.registrationkey = config.wageData.blsApiKey;
    }

    const response = await axios.post(BLS_API_BASE_URL, requestBody, {
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'PALM-Pricing-Estimator/1.0',
      },
    });

    const data = response.data;

    if (data.status === 'REQUEST_SUCCEEDED') {
      const series = data.Results?.series;

      if (!series || series.length === 0) {
        logger.warn(`No data returned for SOC code: ${socCode}`);
        return null;
      }

      // Parse all series data and map by series ID
      const seriesMap = new Map<string, number | null>();
      let dataYear = currentYear.toString();

      for (const s of series) {
        const seriesData = s.data;
        if (seriesData && seriesData.length > 0) {
          // Find the latest data point (marked with latest: true)
          const latestData = seriesData.find((d: any) => d.latest === 'true') || seriesData[0];
          const value = parseFloat(latestData.value);
          dataYear = latestData.year;

          seriesMap.set(s.seriesID, !isNaN(value) ? value : null);
        } else {
          seriesMap.set(s.seriesID, null);
        }
      }

      // Extract values for each wage type
      const meanAnnualWage = seriesMap.get(seriesIds.annualMean);

      // We need at least the mean annual wage to be valid
      if (meanAnnualWage == null) {
        logger.warn(`No mean annual wage data for SOC code: ${socCode}`);
        return null;
      }

      // Calculate hourly wage from annual wage
      const meanHourlyWage = meanAnnualWage / ANNUAL_WORK_HOURS;

      // Get percentile values
      const percentile10Annual = seriesMap.get(seriesIds.percentile10) ?? null;
      const percentile25Annual = seriesMap.get(seriesIds.percentile25) ?? null;
      const percentile75Annual = seriesMap.get(seriesIds.percentile75) ?? null;

      // Calculate 50th percentile (median) via linear interpolation from 25th and 75th
      // Note: BLS series 06 is unreliable, so we interpolate instead
      let percentile50Annual: number | null = null;
      let percentile50Hourly: number | null = null;

      if (percentile25Annual !== null && percentile75Annual !== null) {
        // Linear interpolation: 25th + (75th - 25th) × 0.5
        percentile50Annual = percentile25Annual + (percentile75Annual - percentile25Annual) * 0.5;
        percentile50Hourly = percentile50Annual / ANNUAL_WORK_HOURS;
      }

      // Store the 6-digit SOC code (without O*NET suffix) since that's what BLS uses
      const baseSocCode = socCode.split('.')[0];

      return {
        socCode: baseSocCode,
        meanAnnualWage,
        meanHourlyWage,
        percentile10Annual,
        percentile25Annual,
        percentile50Annual,
        percentile50Hourly,
        percentile75Annual,
        percentile90Annual: seriesMap.get(seriesIds.percentile90) ?? null,
        dataYear,
        fetchedAt: new Date().toISOString(),
      };
    } else {
      logger.warn(`BLS API returned status: ${data.status} for SOC code ${socCode}`, {
        message: data.message,
      });
    }

    return null;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error(`Error fetching BLS data for SOC code ${socCode}`, {
        status: error.response?.status,
        data: error.response?.data,
      });
    } else {
      logger.error(`Error fetching BLS data for SOC code ${socCode}`, error);
    }
    return null;
  }
}

/**
 * Fetch wage data for multiple SOC codes with rate limiting
 * Adds delay between requests to respect BLS API limits
 */
export async function fetchMultipleWageData(
  socCodes: string[],
  delayMs: number = 500
): Promise<Map<string, BlsWageData>> {
  const results = new Map<string, BlsWageData>();

  for (const socCode of socCodes) {
    const data = await fetchWageData(socCode);
    if (data) {
      results.set(socCode, data);
    }

    // Add delay between requests to respect API rate limits
    if (socCodes.indexOf(socCode) < socCodes.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return results;
}
