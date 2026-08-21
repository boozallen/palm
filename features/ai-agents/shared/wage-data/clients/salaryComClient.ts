/**
 * Salary.com API Client
 *
 * IMPORTANT: This is a temporary integration with rate limits (50 calls/day)
 * Do not use in production without proper configuration and rate limiting
 */

import axios from 'axios';
import logger from '@/server/logger';
import {
  SalaryComTokenResponse,
  SalaryComJobPricingRequest,
  SalaryComJobPricingResponse,
  SalaryComWageData,
} from '../types/salaryComTypes';
import { getConfig } from '@/server/config';

const SALARY_COM_TOKEN_URL = 'https://daasjobmatchapi.salary.com/token';
const SALARY_COM_JOB_PRICING_URL = 'https://daasjobmatchapi.salary.com/DaaS/jobpricing';

// In-memory token cache (consider using Redis in production)
let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Get authentication token from Salary.com
 * Caches token until expiration
 * Uses pre-configured token from env if available to save API calls
 */
async function getAuthToken(): Promise<string | null> {
  const config = getConfig();

  // First, check if we have a pre-configured token (saves API calls)
  if (config.wageData.salaryComToken) {
    logger.info('Using pre-configured Salary.com token from environment');
    return config.wageData.salaryComToken;
  }

  if (!config.wageData.salaryComClientId || !config.wageData.salaryComClientSecret) {
    logger.warn('Salary.com API credentials not configured');
    return null;
  }

  // Check if we have a valid cached token
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  try {
    logger.info('Fetching new Salary.com auth token');

    const response = await axios.get<SalaryComTokenResponse>(SALARY_COM_TOKEN_URL, {
      params: {
        ClientID: config.wageData.salaryComClientId,
        ClientSecret: config.wageData.salaryComClientSecret,
      },
      headers: {
        'accept': '*/*',
      },
      timeout: 10000,
    });

    const { access_token, expires_in } = response.data;

    // Cache token with 5 minute buffer before expiration
    cachedToken = {
      token: access_token,
      expiresAt: Date.now() + (expires_in - 300) * 1000,
    };

    logger.info('Successfully obtained Salary.com auth token');
    return access_token;

  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error('Error fetching Salary.com auth token', {
        status: error.response?.status,
        data: error.response?.data,
      });
    } else {
      logger.error('Error fetching Salary.com auth token', error);
    }
    return null;
  }
}

/**
 * Fetch wage data from Salary.com API
 *
 * @param jobTitle - Job title to search for
 * @param jobDescription - Detailed job description (optional but recommended for better matching)
 * @param state - State code (e.g., "CA", "NY") for geographic pricing
 * @returns Normalized wage data or null if request fails
 */
export async function fetchSalaryComData(
  jobTitle: string,
  jobDescription?: string,
  state?: string
): Promise<SalaryComWageData | null> {
  try {
    const token = await getAuthToken();
    if (!token) {
      logger.warn('Cannot fetch Salary.com data without valid token');
      return null;
    }

    // Construct request body
    const requestBody: SalaryComJobPricingRequest = {
      JobTitle: jobTitle,
      JobDesc: jobDescription || jobTitle, // Use title if no description provided
      CompanyName: '',
      DataScope: {
        CountryCode: 'USA',
        State: state || '',
        City: '',
        ZipCode: '',
        NAICSCode: '',
        FTEValue: 0,
        Revenue: 0,
      },
    };

    logger.info(`Fetching Salary.com data for: ${jobTitle}${state ? ` in ${state}` : ''}`);

    const response = await axios.post<SalaryComJobPricingResponse>(
      SALARY_COM_JOB_PRICING_URL,
      requestBody,
      {
        headers: {
          'accept': '*/*',
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );

    const { Code, Data } = response.data;

    if (Code !== 1 || !Data) {
      logger.warn(`Salary.com API returned non-success code: ${Code}`);
      return null;
    }

    // Normalize the response
    return {
      jobTitle,
      benchmarkJobTitle: Data.BenchmarkJobTitle,
      jobLevelName: Data.JobLevelName,
      jobFamilyName: Data.JobFamilyName,
      matchRating: Data.MatchRating,
      salary10: Math.round(Data.Salary10),
      salary25: Math.round(Data.Salary25),
      salary50: Math.round(Data.Salary50),
      salary75: Math.round(Data.Salary75),
      salary90: Math.round(Data.Salary90),
      dataScope: {
        countryCode: Data.DataScope_CountryCode,
        state: state,
        industryCode: Data.DataScope_IndustryCode,
        industryName: Data.DataScope_IndustryName,
      },
      fetchedAt: new Date().toISOString(),
    };

  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error(`Salary.com API error for ${jobTitle}`, {
        status: error.response?.status,
        data: error.response?.data,
      });
    } else {
      logger.error(`Error fetching Salary.com data for ${jobTitle}`, error);
    }
    return null;
  }
}

/**
 * Clear cached token (useful for testing or forcing re-authentication)
 */
export function clearTokenCache(): void {
  cachedToken = null;
}
