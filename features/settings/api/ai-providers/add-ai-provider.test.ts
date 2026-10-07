import { trpc } from '@/libs';
import useAddAiProvider from './add-ai-provider';
import { AiProviderType } from '@/features/shared/types';

const mockSetAiProvidersData = jest.fn();
const mockSetAiProviderData = jest.fn();
const mockInvalidateGetModels = jest.fn();
const mockUseMutation = jest.fn();

jest.mock('@/libs', () => ({
  trpc: {
    useContext: jest.fn(),
    settings: {
      addAiProvider: {
        useMutation: jest.fn(),
      },
    },
  },
}));

type MutationOptions = {
  onSuccess: (data: { provider: { id: string; label: string; createdAt: Date; updatedAt: Date } }) => void;
};

const mockProvider = {
  id: 'provider-1',
  typeId: AiProviderType.Bedrock,
  label: 'AWS Bedrock',
  createdAt: new Date('2026-08-06T00:00:00Z'),
  updatedAt: new Date('2026-08-06T00:00:00Z'),
};

// The hook's behavior lives entirely in the onSuccess handler it hands to
// useMutation, so capture that handler and invoke it directly. Named as a hook
// because it calls one; every trpc dependency is mocked, so there is no renderer.
const useCapturedOnSuccess = (): MutationOptions['onSuccess'] => {
  useAddAiProvider();

  return (mockUseMutation.mock.calls[0][0] as MutationOptions).onSuccess;
};

describe('useAddAiProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (trpc.useContext as jest.Mock).mockReturnValue({
      settings: {
        getAiProviders: { setData: mockSetAiProvidersData },
        getAiProvider: { setData: mockSetAiProviderData },
        getModels: { invalidate: mockInvalidateGetModels },
      },
    });

    (trpc.settings.addAiProvider.useMutation as unknown as jest.Mock) = mockUseMutation;
  });

  it('should invalidate the models query so a newly created embedding model appears without a reload', () => {
    const onSuccess = useCapturedOnSuccess();

    onSuccess({ provider: mockProvider });

    expect(mockInvalidateGetModels).toHaveBeenCalledTimes(1);
  });

  it('should append the new provider to the providers cache', () => {
    const onSuccess = useCapturedOnSuccess();

    onSuccess({ provider: mockProvider });

    expect(mockSetAiProvidersData).toHaveBeenCalledWith({}, expect.any(Function));

    const updater = mockSetAiProvidersData.mock.calls[0][1];

    expect(updater({ aiProviders: [{ id: 'existing' }] })).toEqual({
      aiProviders: [
        { id: 'existing' },
        {
          id: mockProvider.id,
          label: mockProvider.label,
          createdAt: mockProvider.createdAt,
          updatedAt: mockProvider.updatedAt,
        },
      ],
    });
  });

  it('should leave the providers cache untouched when it has not been populated', () => {
    const onSuccess = useCapturedOnSuccess();

    onSuccess({ provider: mockProvider });

    const updater = mockSetAiProvidersData.mock.calls[0][1];

    expect(updater(undefined)).toBeUndefined();
  });

  it('should seed the single-provider cache for the new provider', () => {
    const onSuccess = useCapturedOnSuccess();

    onSuccess({ provider: mockProvider });

    expect(mockSetAiProviderData).toHaveBeenCalledWith(
      { id: mockProvider.id },
      expect.any(Function),
    );

    const updater = mockSetAiProviderData.mock.calls[0][1];

    expect(updater()).toEqual({ provider: mockProvider });
  });
});
