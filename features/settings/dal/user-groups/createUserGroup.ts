import db from '@/server/db';
import { UserGroup } from '@/features/shared/types/user-group';
import logger from '@/server/logger';
import { handlePrismaError } from '@/features/shared/errors/prismaErrors';

type CreateUserGroupInput = {
  label: string;
};

// Distinguished from a raw DB error so the catch block below can rethrow it as-is
// instead of routing it through handlePrismaError's sanitization, which is meant
// for genuine database errors, not this business-rule rejection.
class DuplicateUserGroupNameError extends Error {}

/**
 * Creates a new user group
 * @param input - The user group to create
 * @returns The created user group
 */
export default async function createUserGroup(
  input: CreateUserGroupInput
): Promise<UserGroup> {
  try {
    return await db.$transaction(async (tx) => {
      // label has no DB-level uniqueness (see schema.prisma), so this advisory lock
      // is what keeps two concurrent creates for the same name from both passing the
      // check below before either commits. Scoped to the transaction and keyed on the
      // lowercased label to match the case-insensitive check.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(lower(${input.label})))`;

      const existingUserGroup = await tx.userGroup.findFirst({
        where: {
          deletedAt: null,
          label: {
            equals: input.label,
            mode: 'insensitive',
          },
        },
      });

      if (existingUserGroup) {
        throw new DuplicateUserGroupNameError('A user group with that name already exists');
      }

      const response = await tx.userGroup.create({
        data: {
          label: input.label,
        },
      });

      return {
        id: response.id,
        label: response.label,
        createdAt: response.createdAt,
        updatedAt: response.updatedAt,
        graphDatabaseEnabled: response.graphDatabaseEnabled,
        workflowsEnabled: response.workflowsEnabled,
        agenticChatEnabled: response.agenticChatEnabled,
        contextStudioEnabled: response.contextStudioEnabled,
        memberCount: 0,
      };
    });
  } catch (error) {
    logger.error('Error creating user group', error);
    if (error instanceof DuplicateUserGroupNameError) {
      throw error;
    }
    throw new Error(handlePrismaError(error));
  }
}
