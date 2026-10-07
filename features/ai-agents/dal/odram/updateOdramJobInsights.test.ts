import db from '@/server/db';
import logger from '@/server/logger';
import updateOdramJobInsights from '@/features/ai-agents/dal/odram/updateOdramJobInsights';
import type { ProposalInsights } from '@/features/ai-agents/types/shared/proposalInsights';

jest.mock('@/server/db', () => ({
  agentOdramJob: {
    update: jest.fn(),
  },
}));
jest.mock('@/server/logger');

describe('updateOdramJobInsights', () => {
  const jobId = '123e4567-e89b-12d3-a456-426614174000';
  const insights: ProposalInsights = {
    proposalName: 'NGEN Recompete',
    clientName: 'U.S. Navy',
    opportunitySummary: null,
    financialValue: '$9.2M per year over 5 years',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (db.agentOdramJob.update as jest.Mock).mockResolvedValue({});
  });

  it('writes the four insight fields to the job', async () => {
    await updateOdramJobInsights(jobId, insights);

    expect(db.agentOdramJob.update).toHaveBeenCalledWith({
      where: { id: jobId },
      data: insights,
    });
  });

  it('throws a sanitized error and logs the cause when the update fails', async () => {
    const dbError = new Error('DB error');
    (db.agentOdramJob.update as jest.Mock).mockRejectedValue(dbError);

    await expect(updateOdramJobInsights(jobId, insights)).rejects.toThrow('Error updating ODRAM job insights');
    expect(logger.error).toHaveBeenCalledWith('Error updating ODRAM job insights: ', dbError);
  });
});
