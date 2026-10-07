import db from '@/server/db';
import deleteCertaPolicy from '@/features/settings/dal/ai-agents/certa/deleteCertaPolicy';

jest.mock('@/server/db', () => ({
  agentCertaPolicy: {
    delete: jest.fn(),
  },
}));

jest.mock('@/features/shared/errors/prismaErrors', () => ({
  handlePrismaError: jest.fn((error) => error.message),
}));

const mockDelete = db.agentCertaPolicy.delete as jest.Mock;

const policyId = '8e9a6aab-15ad-4c30-ab10-bdbd3df52150';
const aiAgentId = '123e4567-e89b-12d3-a456-426614174000';

describe('deleteCertaPolicy DAL function', () => {
  it('should delete CERTA policy successfully', async () => {
    mockDelete.mockResolvedValue({ 
      id: policyId,
      aiAgentId: aiAgentId,
    });

    const result = await deleteCertaPolicy(policyId);

    expect(result).toEqual({ 
      id: policyId,
      aiAgentId: aiAgentId,
    });
    expect(mockDelete).toHaveBeenCalledWith({
      where: { id: policyId },
      select: {
        id: true,
        aiAgentId: true,
      },
    });
  });

  it('should throw an error if delete fails', async () => {
    const error = new Error('Database error');
    mockDelete.mockRejectedValueOnce(error);

    await expect(deleteCertaPolicy(policyId)).rejects.toThrow();
  });
});
