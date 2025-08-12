import { render, screen } from '@testing-library/react';
import { JSX } from 'react';

import useGetModels from '@/features/settings/api/get-models';
import AiProvidersTableBody from './AiProvidersTableBody';

jest.mock('@/features/settings/api/get-models');
jest.mock('./ProviderRow', () => {
  return jest.fn(() => <tr data-testid='provider-row'><td>Provider Row</td></tr>);
});

jest.mock('./ModelRow', () => {
  return jest.fn(() => <tr data-testid='model-row'><td>Model Row</td></tr>);
});

jest.mock('./AddModelRow', () => {
  return jest.fn(() => <tr data-testid='add-model-row'><td>Add Model Row</td></tr>);
});

function TableWrapper({ children }: Readonly<{ children: JSX.Element }>) {
  return <table>{children}</table>;
}

describe('AiProvidersTableBody', () => {
  const mockAiProviders = {
    providers: [
      {
        id: 'b9cb9ced-ab50-4534-9444-710112b7e178',
        label: 'OpenAI',
        createdAt: '2021-07-13T12:34:56.000Z',
        updatedAt: '2021-07-13T12:34:56.000Z',
      },
      {
        id: '4f441361-f131-4dcd-99e8-608fa911f09b',
        label: 'Azure OpenAI',
        createdAt: '2021-07-13T12:34:56.000Z',
        updatedAt: '2021-07-13T12:34:56.000Z',
      },
    ],
  };

  const mockModels = {
    models: [
      {
        id: 'd8283f19-fc06-40d2-ab82-52f7f02f2025',
        aiProviderId: '4f441361-f131-4dcd-99e8-608fa911f09b',
        name: 'GPT 3.5 Turbo',
        externalId: 'gpt-3.5-turbo',
      },
      {
        id: '4b5ab65a-6284-44a8-acfc-77d5b82db21b',
        aiProviderId: '4f441361-f131-4dcd-99e8-608fa911f09b',
        name: 'GPT 4 Latest',
        externalId: 'gpt-4-1106-preview',
      },
      {
        id: 'f1d6498e-c5d2-4593-bf2c-dcc7ec7a157a',
        aiProviderId: 'b9cb9ced-ab50-4534-9444-710112b7e178',
        name: 'GPT 3.5 Turbo',
        externalId: 'gpt-3.5-turbo',
      },
      {
        id: '0144be33-063d-4417-8d81-f2dbeda14a8f',
        aiProviderId: 'b9cb9ced-ab50-4534-9444-710112b7e178',
        name: 'GPT 4 Latest',
        externalId: 'gpt-4-1106-preview',
      },
    ],
  };

  let getModelsMockReturnValue: any;

  beforeEach(() => {
    jest.clearAllMocks();

    getModelsMockReturnValue = {
      data: mockModels,
      isPending: false,
      error: null,
    };
  });

  it('should correct number of providers', () => {
    (useGetModels as jest.Mock).mockReturnValue(getModelsMockReturnValue);

    render(
      <TableWrapper>
        <AiProvidersTableBody aiProviders={mockAiProviders.providers} />
      </TableWrapper>
    );

    const providers = screen.getAllByTestId('provider-row');
    expect(providers.length).toBe(mockAiProviders.providers.length);
  });

  it('should render correct number of models', () => {
    (useGetModels as jest.Mock).mockReturnValue(getModelsMockReturnValue);

    render(
      <TableWrapper>
        <AiProvidersTableBody aiProviders={mockAiProviders.providers} />
      </TableWrapper>
    );

    const models = screen.getAllByTestId('model-row');
    expect(models.length).toBe(mockModels.models.length);
  });

  it('should render loading state if api is pending', () => {
    getModelsMockReturnValue.isPending = true;
    (useGetModels as jest.Mock).mockReturnValue(getModelsMockReturnValue);

    render(
      <TableWrapper>
        <AiProvidersTableBody aiProviders={mockAiProviders.providers} />
      </TableWrapper>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    mockModels.models.forEach((model) => {
      expect(screen.queryByTestId(`${model.id}-model-row`)).not.toBeInTheDocument();
    });
    mockAiProviders.providers.forEach((provider) => {
      expect(screen.queryByTestId(`${provider.id}-provider-row`)).not.toBeInTheDocument();
    });
  });

  it('should render error message if there is an error', () => {
    getModelsMockReturnValue.error = new Error('Error fetching models');
    (useGetModels as jest.Mock).mockReturnValue(getModelsMockReturnValue);

    render(
      <TableWrapper>
        <AiProvidersTableBody aiProviders={mockAiProviders.providers} />
      </TableWrapper>
    );

    expect(screen.getByText('Error fetching models')).toBeInTheDocument();
    mockModels.models.forEach((model) => {
      expect(screen.queryByTestId(`${model.id}-model-row`)).not.toBeInTheDocument();
    });
    mockAiProviders.providers.forEach((provider) => {
      expect(screen.queryByTestId(`${provider.id}-provider-row`)).not.toBeInTheDocument();
    });
  });

});
