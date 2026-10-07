import { Prisma } from '@prisma/client';

import updatePulseJobOutputs from '@/features/ai-agents/dal/pulse/updatePulseJobOutputs';
import db from '@/server/db';
import logger from '@/server/logger';
import type { PulseResultsOutputs } from '@/features/ai-agents/types/pulse/results';

jest.mock('@/server/db', () => ({
  __esModule: true,
  default: { agentPulseJob: { update: jest.fn() } },
}));

jest.mock('@/server/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('@/features/shared/errors/prismaErrors', () => ({
  handlePrismaError: jest.fn(() => 'Database error'),
}));

const mockUpdate = db.agentPulseJob.update as jest.Mock;

const outputs: PulseResultsOutputs = {
  profile: {
    columns: [{
      key: 'survey:A',
      label: 'A – Id',
      source: 'survey',
      answeredCount: 2,
      rowCount: 2,
      fallbackCount: 0,
      kind: 'identifier',
      distinctCount: 2,
    }],
    breakdowns: [],
    quotes: [],
  },
  narrative: {
    headline: 'Mentoring leads.',
    overview: 'Most respondents valued mentoring.',
    keyFindings: [],
    recommendedActions: [{ action: 'Expand mentoring.', rationale: 'It was named most.', finding: null }],
    columnNotes: {},
    featuredColumns: [],
    quoteIds: [],
  },
  dashboardHtml: '<html>dashboard</html>',
  slidesHtml: '<html>slides</html>',
  executiveSummaryPdf: Buffer.from('%PDF-1.7'),
  errors: {},
};

const completedAt = new Date('2026-09-25T12:00:00Z');

describe('updatePulseJobOutputs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdate.mockResolvedValue({ id: 'job-1' });
  });

  it('saves every output, the row counts, and the finish time on the run', async () => {
    await updatePulseJobOutputs('job-1', { outputs, failedRowCount: 1, completedAt });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: {
        resultsProfile: outputs.profile,
        resultsNarrative: outputs.narrative,
        resultsDashboardHtml: '<html>dashboard</html>',
        slidesHtml: '<html>slides</html>',
        executiveSummaryPdf: outputs.executiveSummaryPdf,
        outputErrors: {},
        failedRowCount: 1,
        completedAt,
      },
      select: { id: true },
    });
  });

  it('stores a missing narrative and the reasons outputs were skipped', async () => {
    await updatePulseJobOutputs('job-1', {
      outputs: {
        ...outputs,
        narrative: null,
        executiveSummaryPdf: null,
        errors: { pdf: 'The PDF could not be rendered.' },
      },
      failedRowCount: 0,
      completedAt,
    });

    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        resultsNarrative: Prisma.DbNull,
        executiveSummaryPdf: null,
        outputErrors: { pdf: 'The PDF could not be rendered.' },
      }),
    }));
  });

  it('reports a save failure without exposing database details', async () => {
    mockUpdate.mockRejectedValue(new Error('column "slidesHtml" does not exist'));

    await expect(
      updatePulseJobOutputs('job-1', { outputs, failedRowCount: 0, completedAt }),
    ).rejects.toThrow(/^Failed to save the PULSE results outputs$/);
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to save the PULSE results outputs',
      expect.objectContaining({ jobId: 'job-1' }),
    );
  });
});
