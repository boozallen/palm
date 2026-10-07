import db from '@/server/db';
import logger from '@/server/logger';
import updatePrismJobInsights from '@/features/ai-agents/dal/prism/updatePrismJobInsights';
import type { ProposalInsights } from '@/features/ai-agents/types/shared/proposalInsights';

jest.mock('@/server/db', () => ({
  agentPrismJob: {
    update: jest.fn(),
  },
}));
jest.mock('@/server/logger');

describe('updatePrismJobInsights', () => {
  const jobId = '123e4567-e89b-12d3-a456-426614174000';
  const insights: ProposalInsights = {
    proposalName: 'Enterprise Cloud Migration BPA',
    clientName: 'DHS CISA',
    opportunitySummary: 'Five-year BPA to migrate mission systems.',
    financialValue: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (db.agentPrismJob.update as jest.Mock).mockResolvedValue({});
  });

  it('writes the four insight fields to the job', async () => {
    await updatePrismJobInsights(jobId, insights);

    expect(db.agentPrismJob.update).toHaveBeenCalledWith({
      where: { id: jobId },
      data: insights,
    });
  });

  it('throws a sanitized error and logs the cause when the update fails', async () => {
    const dbError = new Error('DB error');
    (db.agentPrismJob.update as jest.Mock).mockRejectedValue(dbError);

    await expect(updatePrismJobInsights(jobId, insights)).rejects.toThrow('Error updating PRISM job insights');
    expect(logger.error).toHaveBeenCalledWith('Error updating PRISM job insights: ', dbError);
  });
});
