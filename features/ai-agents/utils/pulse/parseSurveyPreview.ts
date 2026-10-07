import loadWorkbook from '@/features/ai-agents/utils/pulse/loadWorkbook';
import readSurveyRows, { readSurveyHeaders } from '@/features/ai-agents/utils/pulse/readSurveyRows';
import {
  PulseUserError,
  surveyUnreadableError,
} from '@/features/ai-agents/utils/pulse/pulseErrors';
import type {
  ParsedSurveyRow,
  PulseInputMapping,
  SurveyCell,
} from '@/features/ai-agents/types/pulse/surveyAnalysis';

export type SurveyPreview = {
  responseCount: number;
  headers: SurveyCell[];
  rows: ParsedSurveyRow[];
};

export default async function parseSurveyPreview(
  file: File,
  mapping: PulseInputMapping,
): Promise<SurveyPreview> {
  let workbook;

  try {
    workbook = await loadWorkbook(await file.arrayBuffer());
  } catch {
    throw PulseUserError.from(surveyUnreadableError());
  }

  // Returns every row so the single-row test can target any response; the upload preview slices its own display.
  const rows = readSurveyRows(workbook, mapping);

  return {
    responseCount: rows.length,
    headers: readSurveyHeaders(workbook, mapping),
    rows,
  };
}
