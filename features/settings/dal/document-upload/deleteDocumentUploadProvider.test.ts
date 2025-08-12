import db from '@/server/db';
import logger from '@/server/logger';
import deleteDocumentUploadProvider from './deleteDocumentUploadProvider';
import { documentUploadProviderConfigSchema, DocumentUploadProviderType } from '@/features/shared/types';

jest.mock('@/server/db', () => ({
  $transaction: jest.fn(),
}));

jest.mock('@/features/shared/types/document-upload-provider', () => {
  const actual = jest.requireActual('@/features/shared/types/document-upload-provider');
  return {
    ...actual,
    documentUploadProviderConfigSchema: {
      parse: jest.fn(),
    },
  };
});

const mockProvider = {
  id: 'c2c7f050-c58f-40eb-94af-fbaecabdc6f4',
  label: 'Test Provider',
  config: {
    providerType: DocumentUploadProviderType.AWS,
    accessKeyId: 'AKAI....',
    secretAccessKey: 'SecretAccessKey',
    region: 'us-east-1',
    s3Uri: 's3://hello-world',
  },
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: new Date(),
};

const mockSystemConfig = {
  id: 'system-config-id',
  documentLibraryDocumentUploadProviderId: mockProvider.id,
};

describe('deleteDocumentUploadProvider', () => {
  const providerId = mockProvider.id;
  let tx: any;

  beforeEach(() => {
    jest.clearAllMocks();
    tx = {
      documentUploadProvider: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      document: {
        deleteMany: jest.fn(),
      },
      systemConfig: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    (db.$transaction as jest.Mock).mockImplementation((fn) => fn(tx));
    (documentUploadProviderConfigSchema.parse as jest.Mock).mockReturnValue(mockProvider.config);
  });

  it('should soft delete the provider and delete documents if provider exists', async () => {
    tx.documentUploadProvider.findUnique.mockResolvedValue({ ...mockProvider, deletedAt: null });
    tx.documentUploadProvider.update.mockResolvedValue(mockProvider);
    tx.systemConfig.findUnique.mockResolvedValue(mockSystemConfig);
    tx.systemConfig.update.mockResolvedValue({});
    tx.document.deleteMany.mockResolvedValue({});

    await deleteDocumentUploadProvider(providerId);

    expect(tx.documentUploadProvider.findUnique).toHaveBeenCalledWith({
      where: { id: providerId, deletedAt: null },
    });
    expect(tx.documentUploadProvider.update).toHaveBeenCalledWith({
      where: { id: providerId },
      data: { deletedAt: expect.any(Date) },
    });
    expect(tx.systemConfig.findUnique).toHaveBeenCalledWith({
      where: { documentLibraryDocumentUploadProviderId: providerId },
    });
    expect(tx.systemConfig.update).toHaveBeenCalledWith({
      where: { documentLibraryDocumentUploadProviderId: providerId },
      data: { documentLibraryDocumentUploadProviderId: null },
    });
    expect(tx.document.deleteMany).toHaveBeenCalledWith({
      where: { documentUploadProviderId: providerId },
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('should return the deleted provider', async () => {
    tx.documentUploadProvider.findUnique.mockResolvedValue({ ...mockProvider, deletedAt: null });
    tx.documentUploadProvider.update.mockResolvedValue(mockProvider);
    tx.systemConfig.findUnique.mockResolvedValue(mockSystemConfig);
    tx.systemConfig.update.mockResolvedValue({});
    tx.document.deleteMany.mockResolvedValue({});

    await expect(deleteDocumentUploadProvider(providerId)).resolves.toEqual({
      id: mockProvider.id,
      label: mockProvider.label,
      config: mockProvider.config,
    });
  });

  it('should log and throw if findUnique throws', async () => {
    const error = new Error('find error');
    tx.documentUploadProvider.findUnique.mockRejectedValue(error);

    await expect(deleteDocumentUploadProvider(providerId)).rejects.toThrow(
      'There was a problem deleting the provider.'
    );
    expect(logger.error).toHaveBeenCalledWith(
      `There was a problem fetching the provider: ${providerId}`,
      error
    );
  });

  it('should log and throw if provider not found', async () => {
    tx.documentUploadProvider.findUnique.mockResolvedValue(null);

    await expect(deleteDocumentUploadProvider(providerId)).rejects.toThrow(
      'The request document upload provider was not found.'
    );
    expect(logger.error).toHaveBeenCalledWith(
      `Unable to find provider with id: ${providerId}`
    );
  });

  it('should log and throw if update throws', async () => {
    tx.documentUploadProvider.findUnique.mockResolvedValue({ id: providerId });
    const error = new Error('update error');
    tx.documentUploadProvider.update.mockRejectedValue(error);

    await expect(deleteDocumentUploadProvider(providerId)).rejects.toThrow(
      'There was a problem deleting the provider.'
    );
    expect(logger.error).toHaveBeenCalledWith(
      `There was a problem deleting the provider: ${providerId}`,
      error
    );
  });

  it('updates system config when system config record exists', async () => {
    tx.documentUploadProvider.findUnique.mockResolvedValue({ ...mockProvider, deletedAt: null });
    tx.documentUploadProvider.update.mockResolvedValue(mockProvider);
    tx.systemConfig.findUnique.mockResolvedValue(mockSystemConfig);
    tx.systemConfig.update.mockResolvedValue({});
    tx.document.deleteMany.mockResolvedValue({});

    await deleteDocumentUploadProvider(providerId);

    expect(tx.systemConfig.findUnique).toHaveBeenCalledWith({
      where: { documentLibraryDocumentUploadProviderId: providerId },
    });
    expect(tx.systemConfig.update).toHaveBeenCalledWith({
      where: { documentLibraryDocumentUploadProviderId: providerId },
      data: { documentLibraryDocumentUploadProviderId: null },
    });
  });

  it('does not update system config when system config record does not exist', async () => {
    tx.documentUploadProvider.findUnique.mockResolvedValue({ ...mockProvider, deletedAt: null });
    tx.documentUploadProvider.update.mockResolvedValue(mockProvider);
    tx.systemConfig.findUnique.mockResolvedValue(null);
    tx.document.deleteMany.mockResolvedValue({});

    await deleteDocumentUploadProvider(providerId);

    expect(tx.systemConfig.findUnique).toHaveBeenCalledWith({
      where: { documentLibraryDocumentUploadProviderId: providerId },
    });
    expect(tx.systemConfig.update).not.toHaveBeenCalled();
  });

  it('should log and throw if deleteMany throws', async () => {
    tx.documentUploadProvider.findUnique.mockResolvedValue({ id: providerId });
    tx.documentUploadProvider.update.mockResolvedValue({});
    tx.systemConfig.findUnique.mockResolvedValue(mockSystemConfig);
    tx.systemConfig.update.mockResolvedValue({});
    const error = new Error('deleteMany error');
    tx.document.deleteMany.mockRejectedValue(error);

    await expect(deleteDocumentUploadProvider(providerId)).rejects.toThrow(
      'There was a problem deleting the provider.'
    );
    expect(logger.error).toHaveBeenCalledWith(
      `There was a problem deleting the provider: ${providerId}`,
      error
    );
  });
});
