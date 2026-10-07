/**
 * tRPC Route: Fetch Salary.com Data
 * Fetches salary data from Salary.com API for a given job title
 */

import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { fetchSalaryComData } from '@/features/ai-agents/shared/wage-data/clients';
import logger from '@/server/logger';

const inputSchema = z.object({
  jobTitle: z.string().min(1, 'Job title is required'),
  state: z.string().optional(),
});

const outputSchema = z.object({
  success: z.boolean(),
  data: z.object({
    jobTitle: z.string(),
    benchmarkJobTitle: z.string(),
    jobLevelName: z.string(),
    jobFamilyName: z.string(),
    matchRating: z.string(),
    salary10: z.number(),
    salary25: z.number(),
    salary50: z.number(),
    salary75: z.number(),
    salary90: z.number(),
  }).nullable(),
  error: z.string().optional(),
});

export type FetchSalaryComDataInput = z.infer<typeof inputSchema>;
export type FetchSalaryComDataOutput = z.infer<typeof outputSchema>;

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .mutation(async ({ input }) => {
    const { jobTitle, state } = input;

    logger.info(`Fetching Salary.com data for: ${jobTitle}`, { state });

    try {
      const salaryComData = await fetchSalaryComData(jobTitle, undefined, state);

      if (!salaryComData) {
        return {
          success: false,
          data: null,
          error: 'No data returned from Salary.com API',
        };
      }

      return {
        success: true,
        data: {
          jobTitle: salaryComData.jobTitle,
          benchmarkJobTitle: salaryComData.benchmarkJobTitle,
          jobLevelName: salaryComData.jobLevelName,
          jobFamilyName: salaryComData.jobFamilyName,
          matchRating: salaryComData.matchRating,
          salary10: salaryComData.salary10,
          salary25: salaryComData.salary25,
          salary50: salaryComData.salary50,
          salary75: salaryComData.salary75,
          salary90: salaryComData.salary90,
        },
      };
    } catch (error) {
      logger.error(`Error fetching Salary.com data for ${jobTitle}:`, error);
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });
