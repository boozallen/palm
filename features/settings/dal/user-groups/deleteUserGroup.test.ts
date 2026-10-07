import db from '@/server/db';
import logger from '@/server/logger';
import deleteUserGroup from './deleteUserGroup';
import { handlePrismaError } from '@/features/shared/errors/prismaErrors';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

const mockMembershipDeleteMany = jest.fn();
const mockAdminDocumentGroupDeleteMany = jest.fn();
const mockSystemConfigUpdateMany = jest.fn();
const mockChatUpdateMany = jest.fn();
const mockAgentPrismJobUpdateMany = jest.fn();
const mockAgentOdramJobUpdateMany = jest.fn();
const mockAgentPulseJobUpdateMany = jest.fn();
const mockRateCardUpdateMany = jest.fn();
const mockWorkflowUpdateMany = jest.fn();
const mockWorkflowExecutionUpdateMany = jest.fn();
const mockUpdate = jest.fn();

jest.mock('@/server/db', () => ({
  $transaction: jest.fn(),
}));

jest.mock('@/features/shared/errors/prismaErrors');

describe('deleteUserGroup DAL', () => {

  const userGroupId = 'd8283f19-fc06-40d2-ab82-52f7f02f2025';
  const mockLoggerError = 'Error deleting user group';

  const mockResolve = {
    id: userGroupId,
    label: 'Test User Group',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSystemConfigUpdateMany.mockResolvedValue({ count: 0 });
    mockChatUpdateMany.mockResolvedValue({ count: 0 });
    mockAgentPrismJobUpdateMany.mockResolvedValue({ count: 0 });
    mockAgentOdramJobUpdateMany.mockResolvedValue({ count: 0 });
    mockAgentPulseJobUpdateMany.mockResolvedValue({ count: 0 });
    mockRateCardUpdateMany.mockResolvedValue({ count: 0 });
    mockWorkflowUpdateMany.mockResolvedValue({ count: 0 });
    mockWorkflowExecutionUpdateMany.mockResolvedValue({ count: 0 });
    (db.$transaction as jest.Mock).mockImplementation(async (callback) => {
      return callback({
        userGroupMembership: { deleteMany: mockMembershipDeleteMany },
        adminDocumentGroup: { deleteMany: mockAdminDocumentGroupDeleteMany },
        systemConfig: { updateMany: mockSystemConfigUpdateMany },
        chat: { updateMany: mockChatUpdateMany },
        agentPrismJob: { updateMany: mockAgentPrismJobUpdateMany },
        agentOdramJob: { updateMany: mockAgentOdramJobUpdateMany },
        agentPulseJob: { updateMany: mockAgentPulseJobUpdateMany },
        rateCard: { updateMany: mockRateCardUpdateMany },
        workflow: { updateMany: mockWorkflowUpdateMany },
        workflowExecution: { updateMany: mockWorkflowExecutionUpdateMany },
        userGroup: { update: mockUpdate },
      });
    });
  });

  it('deletes all memberships and document access grants, clears the system default, then soft-deletes the user group', async () => {
    mockUpdate.mockResolvedValue(mockResolve);

    const result = await deleteUserGroup(userGroupId);
    expect(result).toEqual({ id: userGroupId });

    expect(mockMembershipDeleteMany).toHaveBeenCalledWith({ where: { userGroupId } });
    expect(mockAdminDocumentGroupDeleteMany).toHaveBeenCalledWith({ where: { userGroupId } });
    expect(mockSystemConfigUpdateMany).toHaveBeenCalledWith({
      where: { defaultUserGroupId: userGroupId },
      data: { defaultUserGroupId: null },
    });
    // These SetNull FKs mirror what a hard delete's cascade used to clear. AiProviderUsage's
    // own userGroupId is deliberately left untouched — that's the field this soft delete exists
    // to preserve.
    expect(mockChatUpdateMany).toHaveBeenCalledWith({ where: { userGroupId }, data: { userGroupId: null } });
    expect(mockAgentPrismJobUpdateMany).toHaveBeenCalledWith({ where: { userGroupId }, data: { userGroupId: null } });
    expect(mockAgentOdramJobUpdateMany).toHaveBeenCalledWith({ where: { userGroupId }, data: { userGroupId: null } });
    expect(mockAgentPulseJobUpdateMany).toHaveBeenCalledWith({ where: { userGroupId }, data: { userGroupId: null } });
    expect(mockRateCardUpdateMany).toHaveBeenCalledWith({ where: { userGroupId }, data: { userGroupId: null } });
    expect(mockWorkflowUpdateMany).toHaveBeenCalledWith({ where: { pinnedUserGroupId: userGroupId }, data: { pinnedUserGroupId: null } });
    expect(mockWorkflowExecutionUpdateMany).toHaveBeenCalledWith({ where: { userGroupId }, data: { userGroupId: null } });
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: userGroupId },
      data: {
        deletedAt: expect.any(Date),
        joinCode: null,
        agentProviders: { set: [] },
        aiAgents: { set: [] },
        aiProviders: { set: [] },
        githubProviders: { set: [] },
        kbProviders: { set: [] },
        workflows: { set: [] },
        artifactTemplates: { set: [] },
      },
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('throws an error with a sanitized Prisma error message if query fails with Prisma code: P2015', async () => {
    const sanitizedPrismaError = 'Required record not found';
    const mockPrismaError = new PrismaClientKnownRequestError(
      'A related record could not be found',
      {
        code: 'P2015',
        clientVersion: '4.0.0',
      }
    );

    mockUpdate.mockRejectedValue(mockPrismaError);
    (handlePrismaError as jest.Mock).mockReturnValue(sanitizedPrismaError);

    await expect(deleteUserGroup(userGroupId)).rejects.toThrow(sanitizedPrismaError);

    expect(logger.error).toHaveBeenCalledWith(mockLoggerError, mockPrismaError);
    expect(handlePrismaError).toHaveBeenCalledWith(mockPrismaError);
  });

  it('throws a generic error for an unknown Prisma error', async () => {
    const sanitizedPrismaError = 'An unexpected database error occurred';
    const mockUnknownPrismaError = new PrismaClientKnownRequestError(
      'Unknown error',
      {
        code: 'P9999',
        clientVersion: '4.0.0',
      }
    );

    mockUpdate.mockRejectedValue(mockUnknownPrismaError);
    (handlePrismaError as jest.Mock).mockReturnValue(sanitizedPrismaError);

    await expect(deleteUserGroup(userGroupId)).rejects.toThrow(sanitizedPrismaError);

    expect(logger.error).toHaveBeenCalledWith(mockLoggerError, mockUnknownPrismaError);
    expect(handlePrismaError).toHaveBeenCalledWith(mockUnknownPrismaError);
  });

});
