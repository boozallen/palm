import { UserRole } from '@/features/shared/types/user';
import { ContextType } from '@/server/trpc-context';
import settingsRouter from '@/features/settings/routes/index';
import createUserGroup from '@/features/settings/dal/user-groups/createUserGroup';
import { InternalServerError, Unauthorized } from '@/features/shared/errors/routeErrors';
import getUser from '@/features/settings/dal/shared/getUser';

jest.mock('@/features/settings/dal/user-groups/createUserGroup');
jest.mock('@/features/settings/dal/shared/getUser');

describe('addUserGroupRoute', () => {
  const mockCurrentUser = {
    id: '79af9111-516c-48a7-b9a3-0ef6914e5c7e',
    name: 'Test User',
    role: UserRole.Admin,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (getUser as jest.Mock).mockResolvedValue(mockCurrentUser);
  });

  const mockInput = {
    label: 'New User Group',
  };

  const ctx = {
    userId: mockCurrentUser.id,
    userRole: UserRole.Admin,
    auditor: {
      createAuditRecord: jest.fn(),
    },
  } as unknown as ContextType;

  const mockReturnValue = {
    id: 'ec4dd2cf-c867-4a81-b940-d22d98544a0c',
    label: mockInput.label,
    createdAt: new Date('2021-07-13T12:34:56.000Z'),
    updatedAt: new Date('2021-07-13T12:34:56.000Z'),
    memberCount: 0,
  };

  it('should create user group if user is an Admin', async () => {
    ctx.userRole = UserRole.Admin;

    (createUserGroup as jest.Mock).mockResolvedValue(mockReturnValue);

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.createUserGroup(mockInput)).resolves.toEqual(
      mockReturnValue
    );

    expect(ctx.auditor.createAuditRecord).toBeCalledWith({
      outcome: 'SUCCESS',
      description: `User ${mockCurrentUser.name} created a user group with label ${mockInput.label}`,
      event: 'CREATE_USER_GROUP',
    });
  });

  it('should throw error if user is not an Admin', async () => {
    ctx.userRole = UserRole.User;

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.createUserGroup(mockInput)).rejects.toThrow(
      Unauthorized('You do not have permission to create a user group')
    );

    expect(createUserGroup).not.toBeCalled();
    expect(ctx.auditor.createAuditRecord).toBeCalledWith({
      outcome: 'WARN',
      description: `User ${mockCurrentUser.name} attempted to create a user group with label ${mockInput.label} but lacked permissions`,
      event: 'CREATE_USER_GROUP',
    });
  });

  it('should throw error if label is not defined', async () => {
    ctx.userRole = UserRole.Admin;

    (createUserGroup as jest.Mock).mockRejectedValueOnce(
      InternalServerError('Error creating user group')
    );

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.createUserGroup(mockInput)).rejects.toThrow(
      'Error creating user group'
    );

    expect(createUserGroup).toBeCalledWith(mockInput);
    expect(ctx.auditor.createAuditRecord).toBeCalledWith({
      outcome: 'ERROR',
      description: `User ${mockCurrentUser.name} failed to create a user group with label ${mockInput.label}: Error creating user group`,
      event: 'CREATE_USER_GROUP',
    });
  });

  it('should throw error if creating user group fails due to Prisma error', async () => {
    ctx.userRole = UserRole.Admin;
    const caller = settingsRouter.createCaller(ctx);

    const mockPrismaError = new Error('Database query execution error');
    (createUserGroup as jest.Mock).mockRejectedValue(mockPrismaError);

    await expect(caller.createUserGroup(mockInput)).rejects.toThrow('Error creating user group');

    expect(ctx.auditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: 'ERROR',
      description: `User ${mockCurrentUser.name} failed to create a user group with label ${mockInput.label}: ${mockPrismaError.message}`,
      event: 'CREATE_USER_GROUP',
    });
  });

  it('should throw error if creating user group fails due to an existing group with the same name', async () => {
    ctx.userRole = UserRole.Admin;
    const caller = settingsRouter.createCaller(ctx);

    const mockError = new Error('A user group with that name already exists');
    (createUserGroup as jest.Mock).mockRejectedValue(mockError);

    await expect(caller.createUserGroup(mockInput)).rejects.toThrow('A user group with that name already exists');

    expect(ctx.auditor.createAuditRecord).toHaveBeenCalledWith({
      outcome: 'ERROR',
      description: `User ${mockCurrentUser.name} failed to create a user group with label ${mockInput.label}: ${mockError.message}`,
      event: 'CREATE_USER_GROUP',
    });
  });
});
