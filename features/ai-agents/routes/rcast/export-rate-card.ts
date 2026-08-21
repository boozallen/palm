import { z } from 'zod';
import * as ExcelJS from 'exceljs';

import { procedure } from '@/server/trpc';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import { AiAgentType } from '@/features/shared/types';
import { getRateCardForExport } from '@/features/ai-agents/dal/rcast';
import { BlsWageData, DolWageData } from '@/features/ai-agents/shared/wage-data';
import {
  calculateAdjustedRate,
  getPercentileForExperienceLevel,
  getPercentileLabel,
  createBlsExtractor,
  createDolExtractor,
  getWageForPercentile,
  formatJuniorWagesForExport,
} from '@/features/ai-agents/utils/rcast/wageCalculations';
import { PercentileKey } from '@/features/ai-agents/types/rcast/experienceLevel';

const input = z.object({
  aiAgentId: z.string().uuid(),
  rateCardId: z.string().uuid(),
});

const output = z.object({
  filename: z.string(),
  data: z.string(),
  mimeType: z.string(),
});

export default procedure
  .input(input)
  .output(output)
  .mutation(async ({ ctx, input }) => {
    const agents = await getAvailableAgents(ctx.userId);
    const agent = agents.find(
      (agent) => agent.id === input.aiAgentId && agent.type === AiAgentType.RCAST
    );

    if (!agent) {
      throw new Error('RCAST-TWO agent not found');
    }

    const rateCard = await getRateCardForExport(input.rateCardId, input.aiAgentId);

    if (!rateCard) {
      throw new Error('Rate card not found');
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Rate Card Analysis');

    worksheet.columns = [
      { header: 'Labor Category', key: 'laborCategory', width: 35 },
      { header: 'Experience Level', key: 'experienceLevel', width: 18 },
      { header: 'Adjusted Rate ($/hr)', key: 'billRate', width: 20 },
      { header: 'SOC Code', key: 'socCode', width: 12 },
      { header: 'SOC Title', key: 'socTitle', width: 40 },
      { header: 'BLS Wage ($/hr)', key: 'blsWage', width: 20 },
      { header: 'BLS Percentile', key: 'blsPercentile', width: 14 },
      { header: 'DOL Wage ($/hr)', key: 'dolWage', width: 20 },
      { header: 'DOL Percentile', key: 'dolPercentile', width: 14 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    rateCard.categories.forEach((category) => {
      const blsData = category.blsSalaryData as BlsWageData | null;
      const dolData = category.dolSalaryData as DolWageData | null;
      const percentile = getPercentileForExperienceLevel(category.experienceLevel);
      const percentileLabel = getPercentileLabel(percentile);

      let blsWage: number | string | null = null;
      let dolWage: number | string | null = null;

      if (blsData) {
        const extractor = createBlsExtractor(blsData);
        blsWage = percentile === PercentileKey.JUNIOR
          ? formatJuniorWagesForExport(extractor)
          : getWageForPercentile(extractor, percentile);
      }

      if (dolData) {
        const extractor = createDolExtractor(dolData);
        dolWage = percentile === PercentileKey.JUNIOR
          ? formatJuniorWagesForExport(extractor)
          : getWageForPercentile(extractor, percentile);
      }

      worksheet.addRow({
        laborCategory: category.laborCategoryName,
        experienceLevel: category.experienceLevel,
        billRate: category.billRate != null ? calculateAdjustedRate(category.billRate) : null,
        socCode: category.mappedSocCode || '',
        socTitle: category.mappedSocTitle || '',
        blsWage,
        blsPercentile: blsData ? percentileLabel : '',
        dolWage,
        dolPercentile: dolData ? percentileLabel : '',
      });
    });

    worksheet.getColumn('billRate').numFmt = '"$"#,##0.00';
    worksheet.getColumn('blsWage').numFmt = '"$"#,##0.00';
    worksheet.getColumn('dolWage').numFmt = '"$"#,##0.00';
    worksheet.getColumn('blsWage').alignment = { horizontal: 'right' };
    worksheet.getColumn('blsPercentile').alignment = { horizontal: 'right' };
    worksheet.getColumn('dolWage').alignment = { horizontal: 'right' };
    worksheet.getColumn('dolPercentile').alignment = { horizontal: 'right' };

    const buffer = await workbook.xlsx.writeBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const originalName = rateCard.filename.replace(/\.[^/.]+$/, '');
    const filename = `${originalName}_analysis.xlsx`;

    return {
      filename,
      data: base64,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  });
