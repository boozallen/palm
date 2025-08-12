import db from '@/server/db';
import updateCertaPolicy from '@/features/settings/dal/ai-agents/certa/updateCertaPolicy';

jest.mock('@/server/db', () => ({
  agentCertaPolicy: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
}));

const mockFindUnique = db.agentCertaPolicy.findUnique as jest.Mock;
const mockUpdate = db.agentCertaPolicy.update as jest.Mock;

const policyId = '8e9a6aab-15ad-4c30-ab10-bdbd3df52150';
const aiAgentId = '123e4567-e89b-12d3-a456-426614174000';

const policyInput = {
  id: policyId,
  title: 'Updated Policy Title',
  content: 'Updated Policy Content',
  requirements: 'Updated Requirements',
};

describe('updateCertaPolicy DAL function', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should update CERTA policy successfully', async () => {
    mockFindUnique.mockResolvedValue({ id: policyId });
    
    mockUpdate.mockResolvedValue({
      id: policyId,
      title: policyInput.title,
      content: policyInput.content,
      requirements: policyInput.requirements,
      aiAgentId: aiAgentId,
    });

    const result = await updateCertaPolicy(policyInput);

    expect(result).toEqual({
      id: policyId,
      title: policyInput.title,
      content: policyInput.content,
      requirements: policyInput.requirements,
      aiAgentId: aiAgentId,
    });

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: policyId },
      select: { id: true },
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: policyId },
      data: {
        title: policyInput.title,
        content: policyInput.content,
        requirements: policyInput.requirements,
      },
      select: {
        id: true,
        title: true,
        content: true,
        requirements: true,
        aiAgentId: true,
      },
    });
  });

  it('should throw an error if policy is not found', async () => {
    mockFindUnique.mockResolvedValue(null);
    
    await expect(updateCertaPolicy(policyInput)).rejects.toThrow();
    
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('should throw an error if update fails', async () => {
    mockFindUnique.mockResolvedValue({ id: policyId });
    
    const error = new Error('Database error');
    mockUpdate.mockRejectedValue(error);
    
    await expect(updateCertaPolicy(policyInput)).rejects.toThrow();
  });
});
