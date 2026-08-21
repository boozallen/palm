import { ContextType } from '@/server/trpc-context';
import settingsRouter from '@/features/settings/routes';
import { UserRole } from '@/features/shared/types/user';
import logger from '@/server/logger';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import generatePolicyRequirements from '@/features/settings/system-ai/ai-agents/certa/generatePolicyRequirements';

jest.mock('@/features/settings/system-ai/ai-agents/certa/generatePolicyRequirements');

describe('get-policy-requirements', () => {
  const mockUserId = 'ec4dd2cf-c867-4a81-b940-d22d98544a0c';

  const mockInput = {
    policyContent:
      'The website must have a privacy policy linked from the footer. The privacy policy must disclose data collection practices.',
  };

  const mockRequirements =
    '- The website must have a privacy policy linked from the footer\n' +
    '- The privacy policy must disclose data collection practices';

  const mockGeneratePolicyRequirements =
    generatePolicyRequirements as jest.MockedFunction<
      typeof generatePolicyRequirements
    >;

  let mockCtx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    mockGeneratePolicyRequirements.mockResolvedValue({
      requirements: mockRequirements,
    });

    mockCtx = {
      userId: mockUserId,
      userRole: UserRole.Admin,
      ai: {
        buildSystemSource: jest.fn(),
        buildUserSource: jest.fn(),
      },
      logger: logger,
    } as unknown as ContextType;
  });

  it('allows admin to generate policy requirements', async () => {
    const caller = settingsRouter.createCaller(mockCtx);

    await expect(caller.getPolicyRequirements(mockInput)).resolves.toEqual({
      requirements: mockRequirements,
    });

    expect(mockGeneratePolicyRequirements).toHaveBeenCalledWith(
      mockCtx.ai,
      mockInput.policyContent
    );
  });

  it('does not allow a non-admin user to generate policy requirements', async () => {
    mockCtx.userRole = UserRole.User;

    const error = Forbidden(
      'You do not have permission to access this resource.'
    );

    const caller = settingsRouter.createCaller(mockCtx);

    await expect(caller.getPolicyRequirements(mockInput)).rejects.toThrow(
      error
    );

    expect(mockGeneratePolicyRequirements).not.toHaveBeenCalled();
  });

  it('returns properly formatted requirements', async () => {
    mockCtx.userRole = UserRole.Admin;

    const caller = settingsRouter.createCaller(mockCtx);
    const result = await caller.getPolicyRequirements(mockInput);

    expect(typeof result.requirements).toBe('string');
    expect(result.requirements).toEqual(mockRequirements);
    expect(result.requirements.includes('- ')).toBe(true);
  });
});
