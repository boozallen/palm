import { UserRole } from '@/features/shared/types/user';
import { ContextType } from '@/server/trpc-context';
import sharedRouter from '@/features/shared/routes/index';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';

describe('acknowledgeSecurityPolicy', () => {
  const mockAuditor = {
    createAuditRecord: jest.fn(),
  };

  const ctx = {
    userRole: UserRole.User,
    userId: 'test-user-id',
    auditor: mockAuditor,
  } as unknown as ContextType;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create an audit record when user acknowledges security policy', async () => {
    const caller = sharedRouter.createCaller(ctx);

    const result = await caller.acknowledgeSecurityPolicy({
      policyContent: 'This is the security policy content that the user is acknowledging.',
    });

    expect(result.success).toBe(true);
    expect(mockAuditor.createAuditRecord).toHaveBeenCalledWith({
      event: AuditRecordEvent.AcknowledgeSecurityPolicy,
      outcome: AuditRecordOutcome.Success,
      description: expect.stringContaining('User acknowledged security policy'),
    });
  });

  it('should store the entire policy content in audit description', async () => {
    const caller = sharedRouter.createCaller(ctx);
    const longPolicyContent = 'A'.repeat(200);

    await caller.acknowledgeSecurityPolicy({
      policyContent: longPolicyContent,
    });

    const auditCall = mockAuditor.createAuditRecord.mock.calls[0][0];
    expect(auditCall.description).toContain(longPolicyContent);
    expect(auditCall.description).toBe(`User acknowledged security policy: ${longPolicyContent}`);
  });
});
