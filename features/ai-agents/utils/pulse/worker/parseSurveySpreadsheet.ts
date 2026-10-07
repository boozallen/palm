import * as ExcelJS from 'exceljs';

import loadWorkbook from '@/features/ai-agents/utils/pulse/loadWorkbook';
import readSurveyColumns from '@/features/ai-agents/utils/pulse/readSurveyColumns';
import readSurveyRows from '@/features/ai-agents/utils/pulse/readSurveyRows';
import {
  PulseUserError,
  surveyUnreadableError,
} from '@/features/ai-agents/utils/pulse/pulseErrors';
import type {
  ParsedSurveyRow,
  PulseInputMapping,
} from '@/features/ai-agents/types/pulse/surveyAnalysis';
import type { PulseSurveyColumn } from '@/features/ai-agents/types/pulse/results';

type ParsedSurveySpreadsheet = {
  workbook: ExcelJS.Workbook;
  rows: ParsedSurveyRow[];
  surveyColumns: PulseSurveyColumn[];
};

export default async function parseSurveySpreadsheet(
  buffer: Buffer,
  mapping: PulseInputMapping,
): Promise<ParsedSurveySpreadsheet> {
  let workbook: ExcelJS.Workbook;

  try {
    workbook = await loadWorkbook(buffer);
  } catch {
    throw PulseUserError.from(surveyUnreadableError());
  }

  const rows = readSurveyRows(workbook, mapping);

  return { workbook, rows, surveyColumns: readSurveyColumns(workbook, mapping, rows) };
}
