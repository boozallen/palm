import AzureADProvider from 'next-auth/providers/azure-ad';
import KeycloakProvider from 'next-auth/providers/keycloak';
import CredentialsProvider from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';

import db from '@/server/db';
import logger from '@/server/logger';
import { isValidUserRole, UserRole } from '@/features/shared/types/user';
import { getConfig } from '@/server/config';

const config = getConfig();

type AuthProviderKey = 'azure-ad' | 'keycloak' | 'credentials';

const isValidProviderKey = (key: string): key is AuthProviderKey =>
  ['azure-ad', 'keycloak', 'credentials'].includes(key);

const enabledAuthProviders: AuthProviderKey[] = config.enabledNextAuthProviders
  .split(',')
  .map((key) => key.trim().toLowerCase())
  .filter((key): key is AuthProviderKey => isValidProviderKey(key));

/**
 * Check if the given auth provider is enabled
 * @param {string} key the key of the auth provider
 */
export function isAuthProviderEnabled(key: AuthProviderKey): boolean {
  return enabledAuthProviders.includes(key);
}

const getAzureADProvider = () =>
  AzureADProvider({
    clientId: config.azureAd.clientId,
    clientSecret: config.azureAd.clientSecret,
    tenantId: config.azureAd.tenantId,
    authorization: { params: { scope: 'openid profile email' } },
    issuer: `https://login.microsoftonline.us/${config.azureAd.tenantId}/oauth2/v2.0`,
    profile(profile) {
      return {
        id: profile.sub,
        name: profile.name,
        email: profile.email,
        image: null,
        role: UserRole.User,
      };
    },
  });

const getKeycloakProvider = () =>
  KeycloakProvider({
    clientId: config.keycloak.id,
    clientSecret: config.keycloak.secret,
    issuer: config.keycloak.issuer,
    httpOptions: {
      timeout: 10000,
    },
  });

export function getOAuthRole(profile: any): UserRole | null {
  const pathToUserRole = config.inheritedOAuthRolePath;

  if (!pathToUserRole) {
    logger.info('Role inheritance from OAuth provider disabled');
    return null;
  }

  // Traverse profile object and access nested path to find the role
  let role: UserRole | undefined = pathToUserRole
    .split('.')
    .reduce(
      (currentObject, currentKey) => currentObject && currentObject[currentKey],
      profile
    );

  // If the resulting role is an array, find the first valid user role in the array.
  if (Array.isArray(role)) {
    role = role.find((item) => isValidUserRole(item));
  }

  if (isValidUserRole(role)) {
    logger.info(`Role found in OAuth profile: ${role}`);
    return role;
  } else {
    logger.warn(`Invalid role from OAuth profile: ${role}`);
    return null;
  }
}

const getCredentialsProvider = () =>
  CredentialsProvider({
    name: 'Credentials',
    credentials: {
      email: { label: 'Email' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials) {
      if (!credentials) {
        logger.debug('No credentials provided');
        return null;
      }

      let user = undefined;
      try {
        user = await db.user.findUnique({
          where: { email: credentials.email },
        });
      } catch (error) {
        logger.error('Error finding user for authorization', error);
        throw new Error(
          'An unexpected error occurred. Please try again later.'
        );
      }

      if (!user) {
        logger.warn('Provided email not found in user table', {
          email: credentials.email,
        });
        return null;
      }

      if (!user.hashedPassword) {
        logger.warn('User does not have a hashed password', {
          email: credentials.email,
          userId: user.id,
        });
        return null;
      }

      if (await compare(credentials.password, user.hashedPassword)) {
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role as UserRole,
        };
      } else {
        logger.warn('Failed password compare', {
          email: credentials.email,
          userId: user.id,
        });
      }

      return null;
    },
  });

const providerFactories: Record<AuthProviderKey, any> = {
  'azure-ad': getAzureADProvider, // Azure AD Provider: https://next-auth.js.org/providers/azure-ad
  keycloak: getKeycloakProvider, // Keycloak Provider: https://next-auth.js.org/providers/keycloak
  credentials: getCredentialsProvider, // Credentials Provider: https://next-auth.js.org/providers/credentials
};

export function getEnabledProviders(): any[] {
  return enabledAuthProviders
    .filter((key) => isAuthProviderEnabled(key))
    .map((key) => providerFactories[key]());
}

export const useSecureCookies = config.enableSecureCookies;
