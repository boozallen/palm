import { UserRole } from '@/features/shared/types/user';

describe('getOAuthRole', () => {
  let getOAuthRole: (profile: any) => UserRole | null;
  let profile: any;

  beforeEach(() => {
    // Clear the module cache to ensure fresh imports
    jest.resetModules();
    profile = {};
  });

  it('should return null if searchKey is not provided', () => {
    jest.doMock('@/server/config', () => ({
      getConfig: jest.fn().mockReturnValue({
        inheritedOAuthRolePath: '',
        enabledNextAuthProviders: 'azure-ad,keycloak,credentials',
      }),
    }));

    // Import getOAuthRole AFTER setting up the mock
    getOAuthRole = require('./auth-config').getOAuthRole;

    profile.role = UserRole.Admin;
    expect(getOAuthRole(profile)).toBeNull();
  });

  it('should return null if an invalid role is found', () => {
    jest.doMock('@/server/config', () => ({
      getConfig: jest.fn().mockReturnValue({
        inheritedOAuthRolePath: 'role',
        enabledNextAuthProviders: 'azure-ad,keycloak,credentials',
      }),
    }));

    getOAuthRole = require('./auth-config').getOAuthRole;

    profile = {
      role: 'invalid',
    };

    expect(getOAuthRole(profile)).toBeNull();
  });

  it('should return the correct role based on the searchKey', () => {
    jest.doMock('@/server/config', () => ({
      getConfig: jest.fn().mockReturnValue({
        inheritedOAuthRolePath: 'resources.client.role',
        enabledNextAuthProviders: 'azure-ad,keycloak,credentials',
      }),
    }));

    getOAuthRole = require('./auth-config').getOAuthRole;

    profile = {
      resources: {
        client: {
          role: 'Admin',
        },
      },
    };

    expect(getOAuthRole(profile)).toBe(UserRole.Admin);

    jest.resetModules();

    jest.doMock('@/server/config', () => ({
      getConfig: jest.fn().mockReturnValue({
        inheritedOAuthRolePath: 'role',
        enabledNextAuthProviders: 'azure-ad,keycloak,credentials',
      }),
    }));

    getOAuthRole = require('./auth-config').getOAuthRole;

    profile = {
      role: 'Admin',
    };

    expect(getOAuthRole(profile)).toBe(UserRole.Admin);
  });

  it('should find the first valid role in an array', () => {
    jest.doMock('@/server/config', () => ({
      getConfig: jest.fn().mockReturnValue({
        inheritedOAuthRolePath: 'client.roles',
        enabledNextAuthProviders: 'azure-ad,keycloak,credentials',
      }),
    }));

    getOAuthRole = require('./auth-config').getOAuthRole;

    profile = {
      client: {
        roles: [
          'random-role',
          'Admin',
          'User',
        ],
      },
    };

    expect(getOAuthRole(profile)).toBe(UserRole.Admin);
  });

  it('should return null if no valid roles are found in an array', () => {
    jest.doMock('@/server/config', () => ({
      getConfig: jest.fn().mockReturnValue({
        inheritedOAuthRolePath: 'client.roles',
        enabledNextAuthProviders: 'azure-ad,keycloak,credentials',
      }),
    }));

    getOAuthRole = require('./auth-config').getOAuthRole;

    profile = {
      client: {
        roles: [
          'random-role',
          'invalid-role',
        ],
      },
    };

    expect(getOAuthRole(profile)).toBeNull();
  });
});
