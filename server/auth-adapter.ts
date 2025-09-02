import { PrismaClient } from '@prisma/client';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { Profile, Session, User, Account } from 'next-auth';
import { JWT } from 'next-auth/jwt';

import logger from '@/server/logger';
import addUserToDefaultUserGroup from '@/features/settings/dal/user-groups/addUserToDefaultUserGroup';
import updateUserLoginAtRecord from '@/features/shared/dal/updateUserLoginAtRecord';
import getUserForJWT, { UserForJWT } from '@/features/shared/dal/getUserForJWT';
import {
  getEnabledProviders,
  getOAuthRole,
  useSecureCookies,
} from '@/server/auth-config';
import { createAuditor } from '@/server/auditor';
import { UserRole } from '@/features/shared/types/user';
import { AdapterAccount } from 'next-auth/adapters';
import { getConfig } from '@/server/config';
import db from '@/server/db';

const config = getConfig();

const adapter = PrismaAdapter(new PrismaClient());
// Keycloak returns an item 'not-before-policy', which is not a valid column name.
// Solution found here: https://stackoverflow.com/questions/69910570/prisma-with-next-auth-user-creation-fails-cause-of-keycloaks-api-response-key
const _linkAccount = adapter.linkAccount!;
adapter.linkAccount = (account: AdapterAccount) => {
  const { 'not-before-policy': _, ...data } = account;
  return _linkAccount(data);
};

export const authOptions = {
  providers: getEnabledProviders(),
  adapter,
  secret: config.nextAuthSecret,
  session: {
    strategy: 'jwt' as const,
    maxAge: 900, // 15 minutes
  },
  events: {
    async createUser({ user }: { user: User }) {
      const auditor = createAuditor({
        userId: user.id,
      });
      auditor.createAuditRecord({
        outcome: 'SUCCESS',
        description: `User created: ${user.name}`,
        event: 'CREATE_USER',
      });
      try {
        await addUserToDefaultUserGroup(user.id);
        auditor.createAuditRecord({
          outcome: 'SUCCESS',
          description: `${user.name} added to default user group`,
          event: 'CREATE_USER_GROUP_MEMBERSHIP',
        });
      } catch (error) {
        if ((error as Error).message === 'No default user group ID found') {
          auditor.createAuditRecord({
            outcome: 'INFO',
            description: `Could not add ${user.name} to default user group, no designated user group`,
            event: 'CREATE_USER_GROUP_MEMBERSHIP',
          });
        } else {
          auditor.createAuditRecord({
            outcome: 'ERROR',
            description: `Error adding ${user.name} to default user group: ${
              (error as Error).message
            }`,
            event: 'CREATE_USER_GROUP_MEMBERSHIP',
          });
        }
      }
    },
    async signIn({ user }: { user: User }) {
      const auditor = createAuditor({
        userId: user.id,
      });
      auditor.createAuditRecord({
        outcome: 'SUCCESS',
        description: `User signed in: ${user.name}`,
        event: 'USER_SIGN_IN',
      });

      try {
        await updateUserLoginAtRecord(user.id);
      } catch (error) {
        // do not interrupt the signin process if recording last login at date fails
      }
    },
    async signOut({ token }: { token: JWT }) {
      const auditor = createAuditor({
        userId: token.sub!,
      });
      auditor.createAuditRecord({
        outcome: 'SUCCESS',
        description: `User signed out: ${token.name}`,
        event: 'USER_SIGN_OUT',
      });
    },
  },
  callbacks: {
    async signIn({
      account,
      profile,
    }: {
      user: User;
      account: Account | null;
      profile?: Profile;
    }) {
      if (account?.provider === 'azure-ad' && profile) {
        // Azure's unique identifier for this user account
        // This maps to Account.providerAccountId in our database
        const profileProviderId = profile.sub;

        try {
          // Find existing account with old Azure ID
          logger.debug(`Searching for user with email ${profile.email}`);
          const existingAccount = await db.account.findFirst({
            where: {
              provider: 'azure-ad',
              NOT: { providerAccountId: profileProviderId },
              user: {
                email: {
                  equals: profile.email,
                  mode: 'insensitive',
                },
              },
            },
            include: { user: true },
          });

          if (existingAccount) {
            logger.debug(`Found record with outdated account ${existingAccount.id}`);
            const auditor = createAuditor({
              userId: existingAccount.userId,
            });

            logger.debug('Updating existing account with new account details');
            await db.account.update({
              where: { id: existingAccount.id },
              data: account,
            });

            auditor.createAuditRecord({
              outcome: 'SUCCESS',
              description: `AzureAD account migration: updated providerAccountId from ${existingAccount.providerAccountId} to ${profileProviderId} for user ID ${existingAccount.userId}`,
              event: 'MODIFY_ACCOUNT',
            });

            logger.info(
              `Updated Account ProviderAccountId from ${existingAccount.providerAccountId} to ${profileProviderId}`
            );
          }
        } catch (error) {
          logger.error(
            'Error updating account Account ProviderAccountId:',
            error
          );
        }
      }
      return true;
    },
    async jwt({
      token,
      profile,
    }: {
      token: JWT;
      profile?: Profile;
    }): Promise<JWT> {
      let profileRole: UserRole | null = null;

      if (profile) {
        profileRole = getOAuthRole(profile);
      }

      const userId = token.sub;
      if (userId) {
        let user: UserForJWT | null = null;
        try {
          user = await getUserForJWT(userId);
        } catch (error) {
          // continue
        }

        if (!token.role) {
          // overwrite the role if it is not already set
          token.role = profileRole ?? user?.role ?? UserRole.User;
        }
        if (token.lastLoginAt === undefined) {
          token.lastLoginAt = user?.lastLoginAt ?? null;
        }
        token.isUserGroupLead = user?.isUserGroupLead ?? false;
      }

      return token;
    },
    async session({
      session,
      token,
    }: {
      session: Session;
      token: JWT;
    }): Promise<Session> {
      const userId = token.sub;
      if (!userId) {
        throw new Error(
          'An unexpected error occurred. Please try again later.'
        );
      }
      session.user.id = userId;
      session.user.role = token.role;
      session.user.lastLoginAt = token.lastLoginAt;
      return session;
    },
  },
  useSecureCookies: useSecureCookies,
  logger: {
    warn: (code: any) => logger.warn(code),
    error: (code: any, meta: any) => {
      if (meta.error?.error_description) {
        logger.error(code, {
          providerId: meta.providerId,
          error: meta.error.error_description,
          code,
        });
        return;
      }
      logger.error(code, {
        error: meta.message || meta.error?.message || 'Unknown error',
        url: meta.url,
        client: meta.client,
      });
    },
    debug: (code: any, meta: any) => logger.debug(code, meta),
  },
};
