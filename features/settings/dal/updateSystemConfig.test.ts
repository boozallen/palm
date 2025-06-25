import db from '@/server/db';
import logger from '@/server/logger';
import updateSystemConfig from './updateSystemConfig';
import { SystemConfigFields } from '@/features/shared/types';

jest.mock('@/server/db', () => ({
  systemConfig: {
    updateMany: jest.fn(),
  },
}));

describe('updateSystemConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should update system message config successfully', async () => {
    (db.systemConfig.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    const systemMessage = 'New message';
    const response = await updateSystemConfig(
      SystemConfigFields.SystemMessage,
      systemMessage
    );

    expect(db.systemConfig.updateMany).toHaveBeenCalledWith({
      data: {
        [SystemConfigFields.SystemMessage]: systemMessage,
      },
    });
    expect(response).toEqual({
      count: 1,
      updatedField: SystemConfigFields.SystemMessage,
      updatedValue: systemMessage,
    });
    expect(logger.info).toHaveBeenCalledWith(
      `System configuration ${SystemConfigFields.SystemMessage} updated.`
    );
  });

  it('should update the terms of use header config successfully', async () => {
    (db.systemConfig.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    const termsofUseHeader = 'New Header';
    const response = await updateSystemConfig(
      SystemConfigFields.TermsOfUseHeader,
      termsofUseHeader
    );

    expect(db.systemConfig.updateMany).toHaveBeenCalledWith({
      data: {
        [SystemConfigFields.TermsOfUseHeader]: termsofUseHeader,
      },
    });
    expect(response).toEqual({
      count: 1,
      updatedField: SystemConfigFields.TermsOfUseHeader,
      updatedValue: termsofUseHeader,
    });
    expect(logger.info).toHaveBeenCalledWith(
      `System configuration ${SystemConfigFields.TermsOfUseHeader} updated.`
    );
  });

  it('should update the terms of use body config successfully', async () => {
    (db.systemConfig.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    const termsofUseBody = 'New Body';
    const response = await updateSystemConfig(
      SystemConfigFields.TermsOfUseBody,
      termsofUseBody
    );

    expect(db.systemConfig.updateMany).toHaveBeenCalledWith({
      data: {
        [SystemConfigFields.TermsOfUseBody]: termsofUseBody,
      },
    });
    expect(response).toEqual({
      count: 1,
      updatedField: SystemConfigFields.TermsOfUseBody,
      updatedValue: termsofUseBody,
    });
    expect(logger.info).toHaveBeenCalledWith(
      `System configuration ${SystemConfigFields.TermsOfUseBody} updated.`
    );
  });

  it('should update the terms of use checkbox label config successfully', async () => {
    (db.systemConfig.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    const termsofUseCheckboxLabel = 'New Checkbox Label';
    const response = await updateSystemConfig(
      SystemConfigFields.TermsOfUseCheckboxLabel,
      termsofUseCheckboxLabel
    );

    expect(db.systemConfig.updateMany).toHaveBeenCalledWith({
      data: {
        [SystemConfigFields.TermsOfUseCheckboxLabel]: termsofUseCheckboxLabel,
      },
    });
    expect(response).toEqual({
      count: 1,
      updatedField: SystemConfigFields.TermsOfUseCheckboxLabel,
      updatedValue: termsofUseCheckboxLabel,
    });
    expect(logger.info).toHaveBeenCalledWith(
      `System configuration ${SystemConfigFields.TermsOfUseCheckboxLabel} updated.`
    );
  });

  it('should update the legal policy header config successfully', async () => {
    (db.systemConfig.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    const legalPolicyHeader = 'New Legal Header';
    const response = await updateSystemConfig(
      SystemConfigFields.LegalPolicyHeader,
      legalPolicyHeader
    );

    expect(db.systemConfig.updateMany).toHaveBeenCalledWith({
      data: {
        [SystemConfigFields.LegalPolicyHeader]: legalPolicyHeader,
      },
    });
    expect(response).toEqual({
      count: 1,
      updatedField: SystemConfigFields.LegalPolicyHeader,
      updatedValue: legalPolicyHeader,
    });
    expect(logger.info).toHaveBeenCalledWith(
      `System configuration ${SystemConfigFields.LegalPolicyHeader} updated.`
    );
  });

  it('should update the legal policy body config successfully', async () => {
    (db.systemConfig.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    const legalPolicyBody = 'New Legal Body';
    const response = await updateSystemConfig(
      SystemConfigFields.LegalPolicyBody,
      legalPolicyBody
    );

    expect(db.systemConfig.updateMany).toHaveBeenCalledWith({
      data: {
        [SystemConfigFields.LegalPolicyBody]: legalPolicyBody,
      },
    });
    expect(response).toEqual({
      count: 1,
      updatedField: SystemConfigFields.LegalPolicyBody,
      updatedValue: legalPolicyBody,
    });
    expect(logger.info).toHaveBeenCalledWith(
      `System configuration ${SystemConfigFields.LegalPolicyBody} updated.`
    );
  });

  it('should update the feature management prompt generator config successfully', async () => {
    (db.systemConfig.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    const featureManagementPromptGenerator = false;
    const response = await updateSystemConfig(
      SystemConfigFields.FeatureManagementPromptGenerator,
      featureManagementPromptGenerator
    );

    expect(db.systemConfig.updateMany).toHaveBeenCalledWith({
      data: {
        [SystemConfigFields.FeatureManagementPromptGenerator]: false,
      },
    });
    expect(response).toEqual({
      count: 1,
      updatedField: SystemConfigFields.FeatureManagementPromptGenerator,
      updatedValue: false,
    });
    expect(logger.info).toHaveBeenCalledWith(
      `System configuration ${SystemConfigFields.FeatureManagementPromptGenerator} updated.`
    );
  });

  it('should update the feature management chat summarization config successfully', async () => {
    (db.systemConfig.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    const featureManagementChatSummarization = false;
    const response = await updateSystemConfig(
      SystemConfigFields.FeatureManagementChatSummarization,
      featureManagementChatSummarization
    );

    expect(db.systemConfig.updateMany).toHaveBeenCalledWith({
      data: {
        [SystemConfigFields.FeatureManagementChatSummarization]: false,
      },
    });
    expect(response).toEqual({
      count: 1,
      updatedField: SystemConfigFields.FeatureManagementChatSummarization,
      updatedValue: false,
    });
    expect(logger.info).toHaveBeenCalledWith(
      `System configuration ${SystemConfigFields.FeatureManagementChatSummarization} updated.`
    );
  });

  it('should update the feature management prompt tag suggestions config successfully', async () => {
    (db.systemConfig.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    const featureManagementPromptTagSuggestions = false;
    const response = await updateSystemConfig(
      SystemConfigFields.FeatureManagementPromptTagSuggestions,
      featureManagementPromptTagSuggestions
    );

    expect(db.systemConfig.updateMany).toHaveBeenCalledWith({
      data: {
        [SystemConfigFields.FeatureManagementPromptTagSuggestions]: false,
      },
    });
    expect(response).toEqual({
      count: 1,
      updatedField: SystemConfigFields.FeatureManagementPromptTagSuggestions,
      updatedValue: false,
    });
    expect(logger.info).toHaveBeenCalledWith(
      `System configuration ${SystemConfigFields.FeatureManagementPromptTagSuggestions} updated.`
    );
  });

  it('should update the document library KB provider ID config successfully', async () => {
    (db.systemConfig.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    const documentLibraryKbProviderId = 'SomeOtherProviderId';
    const response = await updateSystemConfig(
      SystemConfigFields.DocumentLibraryKbProviderId,
      documentLibraryKbProviderId
    );

    expect(db.systemConfig.updateMany).toHaveBeenCalledWith({
      data: {
        [SystemConfigFields.DocumentLibraryKbProviderId]: documentLibraryKbProviderId.length ? documentLibraryKbProviderId : null,
      },
    });
    expect(response).toEqual({
      count: 1,
      updatedField: SystemConfigFields.DocumentLibraryKbProviderId,
      updatedValue: documentLibraryKbProviderId,
    });
    expect(logger.info).toHaveBeenCalledWith(
      `System configuration ${SystemConfigFields.DocumentLibraryKbProviderId} updated.`
    );
  });

  it('should throw error when no records are updated', async () => {
    const systemMessage = 'New message';
    const error = new Error(
      'Update failed: No matching records found to update.'
    );

    (db.systemConfig.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

    await expect(
      updateSystemConfig(SystemConfigFields.SystemMessage, systemMessage)
    ).rejects.toThrow('Error updating System Config');
    expect(logger.error).toBeCalledWith('Error updating System Config', error);
  });

  it('should handle database update errors', async () => {
    const systemMessage = 'New message';
    const termsofUseHeader = 'New Header';
    const termsofUseBody = 'New Body';
    const termsofUseCheckboxLabel = 'New Checkbox Label';
    const legalPolicyHeader = 'New Legal Header';
    const legalPolicyBody = 'New Legal Body';

    (db.systemConfig.updateMany as jest.Mock).mockRejectedValue(
      new Error('Error updating System Config')
    );

    await expect(
      updateSystemConfig(SystemConfigFields.SystemMessage, systemMessage)
    ).rejects.toThrow('Error updating System Config');
    await expect(
      updateSystemConfig(SystemConfigFields.TermsOfUseHeader, termsofUseHeader)
    ).rejects.toThrow('Error updating System Config');
    await expect(
      updateSystemConfig(SystemConfigFields.TermsOfUseBody, termsofUseBody)
    ).rejects.toThrow('Error updating System Config');
    await expect(
      updateSystemConfig(
        SystemConfigFields.TermsOfUseCheckboxLabel,
        termsofUseCheckboxLabel
      )
    ).rejects.toThrow('Error updating System Config');
    await expect(
      updateSystemConfig(SystemConfigFields.LegalPolicyHeader, legalPolicyHeader)
    ).rejects.toThrow('Error updating System Config');
    await expect(
      updateSystemConfig(SystemConfigFields.LegalPolicyBody, legalPolicyBody)
    ).rejects.toThrow('Error updating System Config');
    expect(logger.error).toHaveBeenCalledWith(
      'Error updating System Config',
      expect.any(Error)
    );
  });
});
