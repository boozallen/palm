import { render, screen } from '@testing-library/react';
import UserGroupAiAgentsTableBody from './UserGroupAiAgentsTableBody';
import { JSX } from 'react';

jest.mock('@/features/settings/api/update-user-group-ai-agents', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    mutateAsync: jest.fn().mockResolvedValue({}),
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

function TableWrapper({ children }: Readonly<{ children: JSX.Element }>) {
  return <table>{children}</table>;
}

describe('UserGroupAiAgentsTableBody', () => {
  const mockUserGroupId = '3967ca4e-b5d1-47c4-84b3-d2a0fbb43b18';
  const mockAiAgents = [
    {
      id: '698f4cc3-33e2-4af1-8ff2-08cb6a32ca2a',
      name: 'AI Agent 1',
      description: 'Description of AI Agent 1',
      enabled: true,
    },
    {
      id: '698f4cc3-33e2-4af1-8ff2-08cb6a32ca2c',
      name: 'AI Agent 3',
      description: 'Description of AI Agent 3',
      enabled: true,
    },
  ];

  const mockUserGroupAiAgents = [
    '698f4cc3-33e2-4af1-8ff2-08cb6a32ca2a',
    '698f4cc3-33e2-4af1-8ff2-08cb6a32ca2c',
  ];

  test('renders without crashing', () => {
    render(
      <TableWrapper>
        <UserGroupAiAgentsTableBody
          aiAgents={mockAiAgents}
          userGroupAiAgents={mockUserGroupAiAgents}
          userGroupId={mockUserGroupId}
        />
      </TableWrapper>
    );
    const tableBody = screen.getByTestId('user-group-ai-agents-table-body');
    expect(tableBody).toBeInTheDocument();
  });

  test('renders correct number of rows', () => {
    render(
      <TableWrapper>
        <UserGroupAiAgentsTableBody
          aiAgents={mockAiAgents}
          userGroupAiAgents={mockUserGroupAiAgents}
          userGroupId={mockUserGroupId}
        />
      </TableWrapper>
    );
    const rows = screen.getAllByTestId(/-user-group-ai-agent-row$/);
    expect(rows.length).toBe(2);
  });
});
