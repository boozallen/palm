import { render, screen } from '@testing-library/react';
import UserGroupAiProvidersTableBody from './UserGroupAiProvidersTableBody';
import { JSX } from 'react';

jest.mock('@/features/settings/api/user-groups/update-user-group-ai-providers', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    mutateAsync: jest.fn(),
    error: null,
  })),
}));

function TableWrapper({ children }: Readonly<{ children: JSX.Element }>) {
  return <table>{children}</table>;
}

describe('UserGroupAiProvidersTableBody', () => {
  const mockUserGroupId = '3967ca4e-b5d1-47c4-84b3-d2a0fbb43b18';
  const mockAiProviders = [
    {
      id: '1',
      label: 'Open Ai Provider',
    },
    {
      id: '2',
      label: 'Anthropic Ai Provider',
    },
  ];
  const mockUserGroupAiProviders = [
    'id 1',
    'id 2',
  ];

  test('renders without crashing', () => {
    render(
      <TableWrapper>
        <UserGroupAiProvidersTableBody aiProviders={mockAiProviders} userGroupAiProviders={mockUserGroupAiProviders} userGroupId={mockUserGroupId} />
      </TableWrapper>
    );
    const tableBody = screen.getByTestId('user-group-ai-providers-table-body');
    expect(tableBody).toBeInTheDocument();
  });

  test('renders correct number of rows', () => {
    render(
      <TableWrapper>
        <UserGroupAiProvidersTableBody aiProviders={mockAiProviders} userGroupAiProviders={mockUserGroupAiProviders} userGroupId={mockUserGroupId} />
      </TableWrapper>
    );
    const rows = screen.getAllByTestId(/-user-group-ai-provider-row$/);
    expect(rows.length).toBe(2);
  });
});
