import { render, screen } from '@testing-library/react';
import UserGroupAiProvidersTableHead from './UserGroupAiProvidersTableHead';

function TableWrapper({ children }: Readonly<{ children: React.ReactElement}>) {
  return <table>{children}</table>;
}

describe('UserGroupAiProviderTableHead', () => {
  test('renders without crashing', () => {
    render(
      <TableWrapper>
        <UserGroupAiProvidersTableHead />
      </TableWrapper>
    );
    expect(screen.getByText('AI Provider')).toBeInTheDocument();
    expect(screen.getByText('Enabled')).toBeInTheDocument();
  });
});
