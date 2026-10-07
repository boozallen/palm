import { render, screen } from '@testing-library/react';
import UserGroupAiAgentsTableHead from './UserGroupAiAgentsTableHead';

function TableWrapper({ children }: Readonly<{ children: React.ReactElement}>) {
  return <table>{children}</table>;
}

describe('UserGroupAiAgentsTableHead', () => {
  test('renders without crashing', () => {
    render(
      <TableWrapper>
        <UserGroupAiAgentsTableHead />
      </TableWrapper>
    );
    expect(screen.getByText('AI Agent')).toBeInTheDocument();
    expect(screen.getByText('Enabled')).toBeInTheDocument();
  });
});
