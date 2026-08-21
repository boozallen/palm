import { render, screen } from '@testing-library/react';
import JoinUserGroupDialogConfigRow from '@/features/settings/components/system-configurations/tables/JoinUserGroupDialogConfigRow';
import { JSX } from 'react';

jest.mock('@/features/settings/components/system-configurations/forms/EditJoinUserGroupDialogForm', () => ({
  __esModule: true,
  default: () => <div data-testid='mock-edit-join-user-group-dialog-form' />,
}));

const TableRowWrapper = ({ children }: { children: JSX.Element }) => (
  <table>
    <tbody>{children}</tbody>
  </table>
);

describe('JoinUserGroupDialogConfigRow Component', () => {
  const joinUserGroupDialogExternalLink = 'https://example.com/get-access';

  beforeEach(() => {
    render(
      <TableRowWrapper>
        <JoinUserGroupDialogConfigRow joinUserGroupDialogExternalLink={joinUserGroupDialogExternalLink} />
      </TableRowWrapper>
    );
  });

  it('should render EditJoinUserGroupDialogForm inside JoinUserGroupDialogConfigRow', () => {
    expect(screen.getByTestId('join-user-group-dialog-config-row')).toBeInTheDocument();
    expect(screen.getByTestId('mock-edit-join-user-group-dialog-form')).toBeInTheDocument();
  });
});
