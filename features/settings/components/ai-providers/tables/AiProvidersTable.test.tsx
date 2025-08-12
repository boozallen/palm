import { render } from '@testing-library/react';
import AiProvidersTable from './AiProvidersTable';
import useGetAiProviders from '@/features/settings/api/get-ai-providers';

jest.mock('@/features/settings/api/get-ai-providers');

jest.mock('./AiProvidersTableBody', () => {
  return function MockedAiProvidersTableBody() {
    return <tbody data-testid='ai-providers-table-body'></tbody>;
  };
});

describe('AiProvidersTable', () => {
  let getAiProvidersMockReturn: any;

  const tableTestId = 'ai-providers-table';

  beforeEach(() => {
    jest.clearAllMocks();

    getAiProvidersMockReturn = {
      data: {
        aiProviders: [],
      },
      isPending: false,
      error: null,
    };
  });

  it('renders without crashing', () => {
    (useGetAiProviders as jest.Mock).mockReturnValue(getAiProvidersMockReturn);
    const { container } = render(<AiProvidersTable />);
    expect(container).toBeTruthy();
  });

  it('does not render table if data.aiProviders is an empty array', () => {
    (useGetAiProviders as jest.Mock).mockReturnValue(getAiProvidersMockReturn);
    const { queryByTestId, queryByText } = render(<AiProvidersTable />);

    expect(queryByTestId(tableTestId)).not.toBeInTheDocument();
    expect(
      queryByText('No AI Providers have been configured yet.'),
    ).toBeInTheDocument();
  });

  it('renders table if data.aiProviders is not an empty array', () => {
    getAiProvidersMockReturn.data.aiProviders = [
      {
        id: '698f4cc3-33e2-4af1-8ff2-08cb6a32ca2a',
        label: 'OpenAI Provider',
        createdAt: `${new Date()}`,
        updatedAt: `${new Date()}`,
      },
    ];

    (useGetAiProviders as jest.Mock).mockReturnValue(getAiProvidersMockReturn);
    const { queryByTestId } = render(<AiProvidersTable />);
    expect(queryByTestId(tableTestId)).toBeInTheDocument();
  });

  it('renders loading component if pending', () => {
    getAiProvidersMockReturn.isPending = true;
    (useGetAiProviders as jest.Mock).mockReturnValue(getAiProvidersMockReturn);

    const { queryByTestId, queryByText } = render(<AiProvidersTable />);

    expect(queryByText('Loading...')).toBeInTheDocument();
    expect(queryByTestId(tableTestId)).not.toBeInTheDocument();
  });

  it('renders error message if there is an error', () => {
    getAiProvidersMockReturn.error = new Error('Error getting AI providers');
    (useGetAiProviders as jest.Mock).mockReturnValue(getAiProvidersMockReturn);

    const { queryByText, queryByTestId } = render(<AiProvidersTable />);

    expect(queryByText('Error getting AI providers')).toBeInTheDocument();
    expect(queryByTestId(tableTestId)).not.toBeInTheDocument();
  });
});
