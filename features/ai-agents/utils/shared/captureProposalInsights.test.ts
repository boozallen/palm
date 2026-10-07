import captureProposalInsights, {
  INSIGHTS_EXTRACTION_FAILED_CODE,
  INSIGHTS_SAVE_FAILED_CODE,
} from '@/features/ai-agents/utils/shared/captureProposalInsights';
import extractProposalInsights, {
  type InsightsCompletionAdapter,
} from '@/features/ai-agents/utils/shared/extractProposalInsights';
import type { ProposalInsights } from '@/features/ai-agents/types/shared/proposalInsights';
import type { ErrorAuditorDetails } from '@/server/errorAuditor';

jest.mock('@/features/ai-agents/utils/shared/extractProposalInsights', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock('@/server/errorAuditor', () => ({
  createErrorAuditor: jest.fn(() => ({ createErrorRecord: mockCreateErrorRecord })),
}));

const mockCreateErrorRecord = jest.fn<Promise<void>, [ErrorAuditorDetails]>();
const mockExtract = jest.mocked(extractProposalInsights);

const INSIGHTS: ProposalInsights = {
  proposalName: 'NGEN Recompete',
  clientName: 'U.S. Navy',
  opportunitySummary: 'Enterprise network services.',
  financialValue: '$2.5B ceiling',
};

const EMPTY: ProposalInsights = {
  proposalName: null,
  clientName: null,
  opportunitySummary: null,
  financialValue: null,
};

function params(saveInsights = jest.fn<Promise<void>, [string, ProposalInsights]>().mockResolvedValue(undefined)) {
  const completionAdapter: InsightsCompletionAdapter = { complete: jest.fn() };
  return {
    saveInsights,
    input: { jobId: 'job-1', userId: 'user-1', queueName: 'prism-jobs', text: 'doc', completionAdapter, saveInsights },
  };
}

describe('captureProposalInsights', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('saves extracted insights against the job', async () => {
    mockExtract.mockResolvedValue(INSIGHTS);
    const { input, saveInsights } = params();

    await captureProposalInsights(input);

    expect(saveInsights).toHaveBeenCalledWith('job-1', INSIGHTS);
    expect(mockCreateErrorRecord).not.toHaveBeenCalled();
  });

  it('records an error and keeps going when extraction fails', async () => {
    mockExtract.mockResolvedValue(null);
    const { input, saveInsights } = params();

    await expect(captureProposalInsights(input)).resolves.toBeUndefined();

    expect(saveInsights).not.toHaveBeenCalled();
    expect(mockCreateErrorRecord).toHaveBeenCalledWith(expect.objectContaining({
      source: 'background-job',
      route: 'prism-jobs',
      code: INSIGHTS_EXTRACTION_FAILED_CODE,
      metadata: { jobId: 'job-1' },
    }));
  });

  it('records an error and keeps going when extraction throws', async () => {
    mockExtract.mockRejectedValue(new Error('Prompt building failed'));
    const { input, saveInsights } = params();

    await expect(captureProposalInsights(input)).resolves.toBeUndefined();

    expect(saveInsights).not.toHaveBeenCalled();
    expect(mockCreateErrorRecord).toHaveBeenCalledWith(expect.objectContaining({
      code: INSIGHTS_EXTRACTION_FAILED_CODE,
      message: 'Prompt building failed',
      metadata: { jobId: 'job-1' },
    }));
  });

  it('skips the write without an error when the documents stated nothing', async () => {
    mockExtract.mockResolvedValue(EMPTY);
    const { input, saveInsights } = params();

    await captureProposalInsights(input);

    expect(saveInsights).not.toHaveBeenCalled();
    expect(mockCreateErrorRecord).not.toHaveBeenCalled();
  });

  it('records an error and keeps going when saving fails', async () => {
    mockExtract.mockResolvedValue(INSIGHTS);
    const failingSave = jest.fn<Promise<void>, [string, ProposalInsights]>().mockRejectedValue(new Error('Error updating PRISM job insights'));
    const { input } = params(failingSave);

    await expect(captureProposalInsights(input)).resolves.toBeUndefined();

    expect(mockCreateErrorRecord).toHaveBeenCalledWith(expect.objectContaining({
      code: INSIGHTS_SAVE_FAILED_CODE,
      message: 'Error updating PRISM job insights',
      metadata: { jobId: 'job-1' },
    }));
  });
});
