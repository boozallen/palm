import { render, screen, waitFor } from '@testing-library/react';
import UserGroupAiAgentsTable from './UserGroupAiAgentsTable';
import useGetAiAgents from '@/features/settings/api/ai-agents/get-ai-agents';

jest.mock('@/features/settings/api/update-user-group-ai-agents', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    mutateAsync: jest.fn().mockResolvedValue({}),
    error: null,
  })),
}));

jest.mock('@/features/settings/api/ai-agents/get-ai-agents', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    data: {
      aiAgents: [
        {
          id: '698f4cc3-33e2-4af1-8ff2-08cb6a32ca2a',
          name: 'AI Agent 1',
          description: 'Description of AI Agent 1',
        },
        {
          id: '698f4cc3-33e2-4af1-8ff2-08cb6a32ca2b',
          name: 'AI Agent 2',
          description: 'Description of AI Agent 2',
        },
        {
          id: '698f4cc3-33e2-4af1-8ff2-08cb6a32ca2c',
          name: 'AI Agent 3',
          description: 'Description of AI Agent 3',
        },
        {
          id: '698f4cc3-33e2-4af1-8ff2-08cb6a32ca2d',
          name: 'AI Agent 4',
          description: 'Description of AI Agent 4',
        },
      ],
    },
    isPending: false,
    error: null,
  })),
}));

jest.mock('@/features/settings/api/get-user-group-ai-agents', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    data: {
      userGroupAiAgents: [
        {
          id: '698f4cc3-33e2-4af1-8ff2-08cb6a32ca2a',
          name: 'AI Agent 1',
          description: 'Description of AI Agent 1',
        },
        {
          id: '698f4cc3-33e2-4af1-8ff2-08cb6a32ca2b',
          name: 'AI Agent 2',
          description: 'Description of AI Agent 2',
        },
        {
          id: '698f4cc3-33e2-4af1-8ff2-08cb6a32ca2c',
          name: 'AI Agent 3',
          description: 'Description of AI Agent 3',
        },
      ],
    },
    isPending: false,
    error: null,
  })),
}));

jest.mock('@/features/settings/api/get-user-group-ai-providers', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    data: {
      userGroupProviders: [
        {
          id: '123',
          label: 'Open AI Provider',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    },
    isLoading: false,
    error: null,
  })),
}));

jest.mock('@/features/settings/api/get-ai-providers', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    data: {
      aiProviders: [
        { id: '123', label: 'Open AI Provider', createdAt: new Date(), updatedAt: new Date() },
      ],
    },
    isLoading: false,
    error: null,
  })),
}));

const mockUserGroupId = '3967ca4e-b5d1-47c4-84b3-d2a0fbb43b18';

describe('UserGroupAiAgentsTable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<UserGroupAiAgentsTable id={mockUserGroupId} />);
    const table = screen.getByTestId('user-group-ai-agents-table');
    expect(table).toBeInTheDocument();
  });

  it('does not render table if data is pending', () => {
    (useGetAiAgents as jest.Mock).mockReturnValueOnce({
      data: [],
      isPending: true,
      error: null,
    });

    render(<UserGroupAiAgentsTable id={mockUserGroupId} />);

    const table = screen.queryByTestId('user-group-ai-agents-table');
    const loading = screen.queryByText('Loading...');

    expect(table).not.toBeInTheDocument();
    expect(loading).toBeInTheDocument();
  });

  it('renders error message if there is a problem fetching data', () => {
    (useGetAiAgents as jest.Mock).mockReturnValueOnce({
      data: [],
      isPending: false,
      error: new Error('Error fetching data'),
    });

    render(<UserGroupAiAgentsTable id={mockUserGroupId} />);

    const table = screen.queryByTestId('user-group-ai-agents-table');
    const error = screen.queryByText('Error fetching data');

    expect(table).not.toBeInTheDocument();
    expect(error).toBeInTheDocument();
  });

  it('renders AI Agent table with data', async () => {
    render(<UserGroupAiAgentsTable id={mockUserGroupId} />);

    await waitFor(() => {
      expect(screen.getByText('AI Agent 1')).toBeInTheDocument();
      expect(screen.getByText('AI Agent 3')).toBeInTheDocument();
    });
  });
});
