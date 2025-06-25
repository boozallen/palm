import { render, screen } from '@testing-library/react';
import ProviderRow from './ProviderRow';
import { AiProviderType } from '@/features/shared/types';
import useGetAiProvider from '@/features/settings/api/get-ai-provider';
import useDeleteAiProvider from '@/features/settings/api/delete-ai-provider';

jest.mock('@/features/settings/api/get-ai-provider');
jest.mock('@/features/settings/api/delete-ai-provider');

describe('ProviderRow', () => {
  const mockProvider = {
    id: '1',
    label: 'Test Provider',
    createdAt: '2022-01-01',
    updatedAt: '2022-01-02',
  };
  beforeEach(() => {

    (useGetAiProvider as jest.Mock).mockReturnValue({
      data: {
        provider: {
          id: 'c2f5e94e-9048-450f-adf8-6e2de630a799',
          typeId: AiProviderType.OpenAi,
          label: 'OpenAI Provider',
          config: {
            id: '8a00cd11-daf7-4291-88ba-87431ff573da',
            apiEndpoint: null,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
      isPending: false,
      error: null,
    });

    (useDeleteAiProvider as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
      error: null,
    });

    jest.clearAllMocks();
  });

  it('should render provider row', () => {
    render(
      <table>
        <thead></thead>
        <tbody>
          <ProviderRow provider={mockProvider} setShowAddModelRow={() => {}} />
        </tbody>
      </table>,
    );
    const providerRow = screen.getByTestId('1-provider-row');
    expect(providerRow).toBeInTheDocument();
  });

  it('renders provider label', () => {
    render(
      <table>
        <thead></thead>
        <tbody>
          <ProviderRow provider={mockProvider} setShowAddModelRow={() => {}} />
        </tbody>
      </table>,
    );
    const providerLabel = screen.getByText('Test Provider');
    expect(providerLabel).toBeInTheDocument();
  });
});
