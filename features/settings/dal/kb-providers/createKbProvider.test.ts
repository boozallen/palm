import db from '@/server/db';
import createKbProvider from './createKbProvider';
import logger from '@/server/logger';
import { KbProviderForm, KbProviderType } from '@/features/shared/types';

jest.mock('@/server/db', () => ({
  kbProvider: {
    create: jest.fn(),
  },
}));

const mockResolvedValue = {
  id: 'd8283f19-fc06-40d2-ab82-52f7f02f2025',
  label: 'Test KB Provider',
  kbProviderType: KbProviderType.KbProviderPalm,
  config: { apiKey: '123', apiEndpoint: 'http://endpoint.com' },
  createdAt: '2021-07-13T12:34:56.000Z',
  updatedAt: '2021-07-13T12:34:56.000Z',
};

const input: KbProviderForm = {
  label: mockResolvedValue.label,
  kbProviderType: mockResolvedValue.kbProviderType,
  config: mockResolvedValue.config,
};

describe('createKbProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    expect(db.kbProvider.create).toHaveBeenCalledWith({
      data: {
        label: input.label,
        kbProviderType: input.kbProviderType,
        config: input.config,
      },
    });
  });

  it('creates KB provider successfully', async () => {
    (db.kbProvider.create as jest.Mock).mockResolvedValue(mockResolvedValue);

    const response = await createKbProvider(input);

    expect(response).toEqual({
      id: mockResolvedValue.id,
      label: mockResolvedValue.label,
      kbProviderType: mockResolvedValue.kbProviderType,
      config: mockResolvedValue.config,
      createdAt: mockResolvedValue.createdAt,
      updatedAt: mockResolvedValue.updatedAt,
    });
  });

  it('handles errors successfully', async () => {
    const error = new Error('Error creating KB provider');
    (db.kbProvider.create as jest.Mock).mockRejectedValue(error);

    await expect(createKbProvider(input)).rejects.toThrow('Error creating knowledge base provider');

    expect(logger.error).toHaveBeenCalledWith('Error creating knowledge base provider', error);
  });
});
