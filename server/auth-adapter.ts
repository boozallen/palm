import { PrismaClient } from '@prisma/client';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { Profile, Session, User, Account } from 'next-auth';
import { JWT } from 'next-auth/jwt';

import logger from '@/server/logger';
import { createErrorAuditor } from '@/server/errorAuditor';
import addUserToDefaultUserGroup from '@/features/settings/dal/user-groups/addUserToDefaultUserGroup';
import updateUserLoginAtRecord from '@/features/shared/dal/updateUserLoginAtRecord';
import getUserForJWT, { UserForJWT } from '@/features/shared/dal/getUserForJWT';
import {
  getAzureAdScopes,
  getEnabledProviders,
  getOAuthRole,
  isAuthProviderEnabled,
  useSecureCookies,
} from '@/server/auth-config';
import { createAuditor } from '@/server/auditor';
import { UserRole } from '@/features/shared/types/user';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';
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

export const authOptions = async () => {
  // Fetched once per request and reused below for provider construction and the jwt
  // callback, rather than each querying SystemConfig independently.
  const azureAdScopes = isAuthProviderEnabled('azure-ad') ? await getAzureAdScopes() : [];

  return {
    providers: await getEnabledProviders(azureAdScopes),
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
          outcome: AuditRecordOutcome.Success,
          description: `User created: ${user.name}`,
          event: AuditRecordEvent.CreateUser,
        });
        try {
          await addUserToDefaultUserGroup(user.id);
          auditor.createAuditRecord({
            outcome: AuditRecordOutcome.Success,
            description: `${user.name} added to default user group`,
            event: AuditRecordEvent.CreateUserGroupMembership,
          });
        } catch (error) {
          if ((error as Error).message === 'No default user group ID found') {
            auditor.createAuditRecord({
              outcome: AuditRecordOutcome.Info,
              description: `Could not add ${user.name} to default user group, no designated user group`,
              event: AuditRecordEvent.CreateUserGroupMembership,
            });
          } else {
            auditor.createAuditRecord({
              outcome: AuditRecordOutcome.Error,
              description: `Error adding ${user.name} to default user group: ${
                (error as Error).message
              }`,
              event: AuditRecordEvent.CreateUserGroupMembership,
            });
          }
        }
      },
      async signIn({ user }: { user: User }) {
        const auditor = createAuditor({
          userId: user.id,
        });
        auditor.createAuditRecord({
          outcome: AuditRecordOutcome.Success,
          description: `User signed in: ${user.name}`,
          event: AuditRecordEvent.UserSignIn,
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
          outcome: AuditRecordOutcome.Success,
          description: `User signed out: ${token.name}`,
          event: AuditRecordEvent.UserSignOut,
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
                outcome: AuditRecordOutcome.Success,
                description: `AzureAD account migration: updated providerAccountId from ${existingAccount.providerAccountId} to ${profileProviderId} for user ID ${existingAccount.userId}`,
                event: AuditRecordEvent.ModifyAccount,
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
        account,
      }: {
        token: JWT;
        profile?: Profile;
        account?: Account | null;
      }): Promise<JWT> {
        let profileRole: UserRole | null = null;

        if (profile) {
          profileRole = getOAuthRole(profile);
        }

        // Configured Azure AD scopes are recalculated on every JWT call (login and refresh)
        // below, using the value fetched once at the top of authOptions() for this request.
        const configuredAzureAdScopes = azureAdScopes;

        // Store access token from Azure AD
        if (account?.provider === 'azure-ad' && account.access_token) {
          token.accessToken = account.access_token;

          // Parse the scopes from the account
          // The scope is stored as a space-separated string in the account object
          const tokenScopes = account.scope?.split(' ') ?? [];

          // Store what scopes the token actually has (for future JWT refresh calls)
          token.tokenAzureAdScopes = tokenScopes;

          // Store the configured scopes that match what the token has
          token.azureAdScopes = configuredAzureAdScopes.filter(scope => tokenScopes.includes(scope));

          logger.info('[Azure AD Scopes] Stored Azure AD access token in JWT', {
            userId: token.sub,
            hasToken: !!account.access_token,
            tokenScopes,
            configuredAzureAdScopes,
            azureAdScopes: token.azureAdScopes,
          });
        } else if (account?.provider === 'credentials') {
          // Credentials provider has no Azure AD scopes
          token.azureAdScopes = [];
          token.tokenAzureAdScopes = [];
        } else if (!account) {
          // JWT refresh (no account object) - recalculate azureAdScopes based on current config
          // Use the stored tokenAzureAdScopes value from initial login
          const tokenScopes = token.tokenAzureAdScopes ?? [];
          token.azureAdScopes = configuredAzureAdScopes.filter(scope => tokenScopes.includes(scope));

          logger.silly('[Azure AD Scopes] JWT refresh - recalculated azureAdScopes', {
            userId: token.sub,
            tokenScopes,
            configuredAzureAdScopes,
            azureAdScopes: token.azureAdScopes,
          });
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

        // accessToken deliberately stays server-side only (in the JWT, not the client-facing
        // session) — it's a Microsoft Graph token and there's no client-side consumer for it.
        session.azureAdScopes = token.azureAdScopes;

        return session;
      },
    },
    useSecureCookies: useSecureCookies,
    logger: {
      warn: (code: any) => logger.warn(code),
      // NextAuth's own chokepoint for internal errors (OAuth callback failures,
      // JWT errors, etc.) — it handles these itself and redirects to an error
      // page rather than throwing, so wrapping the handler wouldn't catch them.
      error: (code: any, meta: any) => {
        const message = meta.error?.error_description || meta.message || meta.error?.message || 'Unknown error';

        if (meta.error?.error_description) {
          logger.error(code, {
            providerId: meta.providerId,
            error: meta.error.error_description,
            code,
          });
        } else {
          logger.error(code, {
            error: message,
            url: meta.url,
            client: meta.client,
          });
        }

        createErrorAuditor({ userId: null }).createErrorRecord({
          source: 'rest-api',
          route: '/api/auth/[...nextauth]',
          code: 'AUTH_ERROR',
          message,
          stack: meta.error instanceof Error ? meta.error.stack ?? null : null,
          metadata: { nextAuthCode: code, providerId: meta.providerId, url: meta.url },
        });
      },
      debug: (code: any, meta: any) => logger.silly(code, meta),
    },
  };
};
