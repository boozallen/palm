import settingsRouter from '@/features/settings/routes';
import { ContextType } from '@/server/trpc-context';
import updateSystemConfig from '@/features/settings/dal/updateSystemConfig';
import { SystemConfigFields } from '@/features/shared/types';
import { TRPCError } from '@trpc/server';
import { UserRole } from '@/features/shared/types/user';

jest.mock('@/features/settings/dal/updateSystemConfig', () => jest.fn());

const mockUpdateSystemConfig = updateSystemConfig as jest.Mock;

describe('updateSystemConfig', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should successfully update system message config for admin user', async () => {
    const ctx = {
      userRole: UserRole.Admin,
    } as ContextType;

    const systemMessage = 'New message';

    mockUpdateSystemConfig.mockResolvedValue({
      count: 1,
      updatedField: SystemConfigFields.SystemMessage,
      updatedValue: systemMessage,
    });
    const input = {
      configField: SystemConfigFields.SystemMessage,
      configValue: systemMessage,
    };
    const caller = settingsRouter.createCaller(ctx);
    const result = await caller.updateSystemConfig(input);

    expect(mockUpdateSystemConfig).toHaveBeenCalledWith(
      SystemConfigFields.SystemMessage,
      systemMessage
    );
    expect(result).toEqual({
      count: 1,
      updatedField: SystemConfigFields.SystemMessage,
      updatedValue: systemMessage,
    });
  });

  it('should update system config with null user group', async () => {
    const ctx = {
      userRole: UserRole.Admin,
    } as ContextType;

    const input = {
      configField: SystemConfigFields.DefaultUserGroupId,
      configValue: null,
    };

    mockUpdateSystemConfig.mockResolvedValue({
      count: 1,
      updatedField: SystemConfigFields.DefaultUserGroupId,
      updatedValue: null,
    });

    const caller = settingsRouter.createCaller(ctx);
    const result = await caller.updateSystemConfig(input);

    expect(mockUpdateSystemConfig).toHaveBeenCalledWith(
      SystemConfigFields.DefaultUserGroupId,
      null
    );
    expect(result).toEqual({
      count: 1,
      updatedField: SystemConfigFields.DefaultUserGroupId,
      updatedValue: null,
    });
  });

  it('should successfully update term of use header config for admin user', async () => {
    const ctx = {
      userRole: UserRole.Admin,
    } as ContextType;

    const termsofUseHeader = 'New Header';

    mockUpdateSystemConfig.mockResolvedValue({
      count: 1,
      updatedField: SystemConfigFields.TermsOfUseHeader,
      updatedValue: termsofUseHeader,
    });
    const input = {
      configField: SystemConfigFields.TermsOfUseHeader,
      configValue: termsofUseHeader,
    };
    const caller = settingsRouter.createCaller(ctx);
    const result = await caller.updateSystemConfig(input);

    expect(mockUpdateSystemConfig).toHaveBeenCalledWith(
      SystemConfigFields.TermsOfUseHeader,
      termsofUseHeader
    );
    expect(result).toEqual({
      count: 1,
      updatedField: SystemConfigFields.TermsOfUseHeader,
      updatedValue: termsofUseHeader,
    });
  });

  it('should successfully update term of use body config for admin user', async () => {
    const ctx = {
      userRole: UserRole.Admin,
    } as ContextType;

    const termsofUseBody = 'New Body';

    mockUpdateSystemConfig.mockResolvedValue({
      count: 1,
      updatedField: SystemConfigFields.TermsOfUseBody,
      updatedValue: termsofUseBody,
    });
    const input = {
      configField: SystemConfigFields.TermsOfUseBody,
      configValue: termsofUseBody,
    };
    const caller = settingsRouter.createCaller(ctx);
    const result = await caller.updateSystemConfig(input);

    expect(mockUpdateSystemConfig).toHaveBeenCalledWith(
      SystemConfigFields.TermsOfUseBody,
      termsofUseBody
    );
    expect(result).toEqual({
      count: 1,
      updatedField: SystemConfigFields.TermsOfUseBody,
      updatedValue: termsofUseBody,
    });
  });

  it('should successfully update term of use checkbox label config for admin user', async () => {
    const ctx = {
      userRole: UserRole.Admin,
    } as ContextType;

    const termsofUseCheckboxLabel = 'New Checkbox Label';

    mockUpdateSystemConfig.mockResolvedValue({
      count: 1,
      updatedField: SystemConfigFields.TermsOfUseCheckboxLabel,
      updatedValue: termsofUseCheckboxLabel,
    });
    const input = {
      configField: SystemConfigFields.TermsOfUseCheckboxLabel,
      configValue: termsofUseCheckboxLabel,
    };
    const caller = settingsRouter.createCaller(ctx);
    const result = await caller.updateSystemConfig(input);

    expect(mockUpdateSystemConfig).toHaveBeenCalledWith(
      SystemConfigFields.TermsOfUseCheckboxLabel,
      termsofUseCheckboxLabel
    );
    expect(result).toEqual({
      count: 1,
      updatedField: SystemConfigFields.TermsOfUseCheckboxLabel,
      updatedValue: termsofUseCheckboxLabel,
    });
  });

  it('should successfully update feature management prompt generator config for admin user', async () => {
    const ctx = {
      userRole: UserRole.Admin,
    } as ContextType;

    const featureManagementPromptGenerator = true;

    mockUpdateSystemConfig.mockResolvedValue({
      count: 1,
      updatedField: SystemConfigFields.FeatureManagementPromptGenerator,
      updatedValue: featureManagementPromptGenerator,
    });
    const input = {
      configField: SystemConfigFields.FeatureManagementPromptGenerator,
      configValue: featureManagementPromptGenerator,
    };
    const caller = settingsRouter.createCaller(ctx);
    const result = await caller.updateSystemConfig(input);

    expect(mockUpdateSystemConfig).toHaveBeenCalledWith(
      SystemConfigFields.FeatureManagementPromptGenerator,
      featureManagementPromptGenerator
    );
    expect(result).toEqual({
      count: 1,
      updatedField: SystemConfigFields.FeatureManagementPromptGenerator,
      updatedValue: featureManagementPromptGenerator,
    });
  });

  it('should successfully update feature management chat summarization config for admin user', async () => {
    const ctx = {
      userRole: UserRole.Admin,
    } as ContextType;

    const featureManagementChatSummarization = true;

    mockUpdateSystemConfig.mockResolvedValue({
      count: 1,
      updatedField: SystemConfigFields.FeatureManagementChatSummarization,
      updatedValue: featureManagementChatSummarization,
    });
    const input = {
      configField: SystemConfigFields.FeatureManagementChatSummarization,
      configValue: featureManagementChatSummarization,
    };
    const caller = settingsRouter.createCaller(ctx);
    const result = await caller.updateSystemConfig(input);

    expect(mockUpdateSystemConfig).toHaveBeenCalledWith(
      SystemConfigFields.FeatureManagementChatSummarization,
      featureManagementChatSummarization
    );
    expect(result).toEqual({
      count: 1,
      updatedField: SystemConfigFields.FeatureManagementChatSummarization,
      updatedValue: featureManagementChatSummarization,
    });
  });

  it('should successfully update feature management prompt tag suggestions config for admin user', async () => {
    const ctx = {
      userRole: UserRole.Admin,
    } as ContextType;

    const featureManagementPromptTagSuggestions = true;

    mockUpdateSystemConfig.mockResolvedValue({
      count: 1,
      updatedField: SystemConfigFields.FeatureManagementPromptTagSuggestions,
      updatedValue: featureManagementPromptTagSuggestions,
    });
    const input = {
      configField: SystemConfigFields.FeatureManagementPromptTagSuggestions,
      configValue: featureManagementPromptTagSuggestions,
    };
    const caller = settingsRouter.createCaller(ctx);
    const result = await caller.updateSystemConfig(input);

    expect(mockUpdateSystemConfig).toHaveBeenCalledWith(
      SystemConfigFields.FeatureManagementPromptTagSuggestions,
      featureManagementPromptTagSuggestions
    );
    expect(result).toEqual({
      count: 1,
      updatedField: SystemConfigFields.FeatureManagementPromptTagSuggestions,
      updatedValue: featureManagementPromptTagSuggestions,
    });
  });

  it('should throw error for non-admin users when attempting to update system message', async () => {
    const ctx = {
      userRole: UserRole.User,
    } as ContextType;

    const systemMessage = 'New message';

    const input = {
      configField: SystemConfigFields.SystemMessage,
      configValue: systemMessage,
    };
    const caller = settingsRouter.createCaller(ctx);

    await expect(caller.updateSystemConfig(input)).rejects.toThrowError(
      TRPCError
    );

    expect(mockUpdateSystemConfig).not.toHaveBeenCalled();
  });

  it('should throw error for non-admin users when attempting to update terms of use header', async () => {
    const ctx = {
      userRole: UserRole.User,
    } as ContextType;

    const termsofUseHeader = 'New Header';

    const input = {
      configField: SystemConfigFields.TermsOfUseHeader,
      configValue: termsofUseHeader,
    };
    const caller = settingsRouter.createCaller(ctx);

    await expect(caller.updateSystemConfig(input)).rejects.toThrowError(
      TRPCError
    );

    expect(mockUpdateSystemConfig).not.toHaveBeenCalled();
  });

  it('should throw error for non-admin users when attempting to update terms of use body', async () => {
    const ctx = {
      userRole: UserRole.User,
    } as ContextType;

    const termsofUseBody = 'New Body';

    const input = {
      configField: SystemConfigFields.TermsOfUseBody,
      configValue: termsofUseBody,
    };
    const caller = settingsRouter.createCaller(ctx);

    await expect(caller.updateSystemConfig(input)).rejects.toThrowError(
      TRPCError
    );

    expect(mockUpdateSystemConfig).not.toHaveBeenCalled();
  });

  it('should throw error for non-admin users when attempting to update terms of use checkbox label', async () => {
    const ctx = {
      userRole: UserRole.User,
    } as ContextType;

    const termsofUseCheckboxLabel = 'New Checkbox Label';

    const input = {
      configField: SystemConfigFields.TermsOfUseCheckboxLabel,
      configValue: termsofUseCheckboxLabel,
    };
    const caller = settingsRouter.createCaller(ctx);

    await expect(caller.updateSystemConfig(input)).rejects.toThrowError(
      TRPCError
    );

    expect(mockUpdateSystemConfig).not.toHaveBeenCalled();
  });

  it('should handle failure in updating system message system config', async () => {
    const ctx = {
      userRole: UserRole.Admin,
    } as ContextType;

    const systemMessage = 'New message';

    const errorMessage = 'Error updating System Config';
    mockUpdateSystemConfig.mockRejectedValue(new Error(errorMessage));

    const input = {
      configField: SystemConfigFields.SystemMessage,
      configValue: systemMessage,
    };
    const caller = settingsRouter.createCaller(ctx);

    await expect(caller.updateSystemConfig(input)).rejects.toThrow(
      errorMessage
    );

    expect(mockUpdateSystemConfig).toHaveBeenCalledWith(
      SystemConfigFields.SystemMessage,
      systemMessage
    );
  });

  it('should handle failure in updating terms of use header system config', async () => {
    const ctx = {
      userRole: UserRole.Admin,
    } as ContextType;

    const termsofUseHeader = 'New Header';

    const errorMessage = 'Error updating System Config';
    mockUpdateSystemConfig.mockRejectedValue(new Error(errorMessage));

    const input = {
      configField: SystemConfigFields.TermsOfUseHeader,
      configValue: termsofUseHeader,
    };
    const caller = settingsRouter.createCaller(ctx);

    await expect(caller.updateSystemConfig(input)).rejects.toThrow(
      errorMessage
    );

    expect(mockUpdateSystemConfig).toHaveBeenCalledWith(
      SystemConfigFields.TermsOfUseHeader,
      termsofUseHeader
    );
  });

  it('should handle failure in updating terms of use body system config', async () => {
    const ctx = {
      userRole: UserRole.Admin,
    } as ContextType;

    const termsofUseBody = 'New Body';

    const errorMessage = 'Error updating System Config';
    mockUpdateSystemConfig.mockRejectedValue(new Error(errorMessage));

    const input = {
      configField: SystemConfigFields.TermsOfUseBody,
      configValue: termsofUseBody,
    };
    const caller = settingsRouter.createCaller(ctx);

    await expect(caller.updateSystemConfig(input)).rejects.toThrow(
      errorMessage
    );

    expect(mockUpdateSystemConfig).toHaveBeenCalledWith(
      SystemConfigFields.TermsOfUseBody,
      termsofUseBody
    );
  });

  it('should handle failure in updating terms of use checkbox label system config', async () => {
    const ctx = {
      userRole: UserRole.Admin,
    } as ContextType;

    const termsofUseCheckboxLabel = 'New Checkbox Label';

    const errorMessage = 'Error updating System Config';
    mockUpdateSystemConfig.mockRejectedValue(new Error(errorMessage));

    const input = {
      configField: SystemConfigFields.TermsOfUseCheckboxLabel,
      configValue: termsofUseCheckboxLabel,
    };
    const caller = settingsRouter.createCaller(ctx);

    await expect(caller.updateSystemConfig(input)).rejects.toThrow(
      errorMessage
    );

    expect(mockUpdateSystemConfig).toHaveBeenCalledWith(
      SystemConfigFields.TermsOfUseCheckboxLabel,
      termsofUseCheckboxLabel
    );
  });

  it('should successfully update legal policy header config for admin user', async () => {
    const ctx = {
      userRole: UserRole.Admin,
    } as ContextType;

    const legalPolicyHeader = 'New Legal Header';

    mockUpdateSystemConfig.mockResolvedValue({
      count: 1,
      updatedField: SystemConfigFields.LegalPolicyHeader,
      updatedValue: legalPolicyHeader,
    });
    const input = {
      configField: SystemConfigFields.LegalPolicyHeader,
      configValue: legalPolicyHeader,
    };
    const caller = settingsRouter.createCaller(ctx);
    const result = await caller.updateSystemConfig(input);

    expect(mockUpdateSystemConfig).toHaveBeenCalledWith(
      SystemConfigFields.LegalPolicyHeader,
      legalPolicyHeader
    );
    expect(result).toEqual({
      count: 1,
      updatedField: SystemConfigFields.LegalPolicyHeader,
      updatedValue: legalPolicyHeader,
    });
  });

  it('should successfully update legal policy body config for admin user', async () => {
    const ctx = {
      userRole: UserRole.Admin,
    } as ContextType;

    const legalPolicyBody = 'New Legal Body';

    mockUpdateSystemConfig.mockResolvedValue({
      count: 1,
      updatedField: SystemConfigFields.LegalPolicyBody,
      updatedValue: legalPolicyBody,
    });
    const input = {
      configField: SystemConfigFields.LegalPolicyBody,
      configValue: legalPolicyBody,
    };
    const caller = settingsRouter.createCaller(ctx);
    const result = await caller.updateSystemConfig(input);

    expect(mockUpdateSystemConfig).toHaveBeenCalledWith(
      SystemConfigFields.LegalPolicyBody,
      legalPolicyBody
    );
    expect(result).toEqual({
      count: 1,
      updatedField: SystemConfigFields.LegalPolicyBody,
      updatedValue: legalPolicyBody,
    });
  });

  it('should handle failure in updating legal policy header system config', async () => {
    const ctx = {
      userRole: UserRole.Admin,
    } as ContextType;

    const legalPolicyHeader = 'New Legal Header';

    const errorMessage = 'Error updating System Config';
    mockUpdateSystemConfig.mockRejectedValue(new Error(errorMessage));

    const input = {
      configField: SystemConfigFields.LegalPolicyHeader,
      configValue: legalPolicyHeader,
    };
    const caller = settingsRouter.createCaller(ctx);

    await expect(caller.updateSystemConfig(input)).rejects.toThrow(
      errorMessage
    );

    expect(mockUpdateSystemConfig).toHaveBeenCalledWith(
      SystemConfigFields.LegalPolicyHeader,
      legalPolicyHeader
    );
  });

  it('should handle failure in updating legal policy body system config', async () => {
    const ctx = {
      userRole: UserRole.Admin,
    } as ContextType;

    const legalPolicyBody = 'New Legal Body';

    const errorMessage = 'Error updating System Config';
    mockUpdateSystemConfig.mockRejectedValue(new Error(errorMessage));

    const input = {
      configField: SystemConfigFields.LegalPolicyBody,
      configValue: legalPolicyBody,
    };
    const caller = settingsRouter.createCaller(ctx);

    await expect(caller.updateSystemConfig(input)).rejects.toThrow(
      errorMessage
    );

    expect(mockUpdateSystemConfig).toHaveBeenCalledWith(
      SystemConfigFields.LegalPolicyBody,
      legalPolicyBody
    );
  });

});
