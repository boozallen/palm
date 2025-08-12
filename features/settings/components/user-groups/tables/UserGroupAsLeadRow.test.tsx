import { render, screen } from '@testing-library/react';
import UserGroupAsLeadRow from './UserGroupAsLeadRow';

const TableBodyWrapper = ({ children }: Readonly<{ children: React.ReactNode }>) => (
  <table>
    <tbody>
      {children}
    </tbody>
  </table>
);

describe('UserGroupAsLeadRow', () => {

  const mockUserGroup = {
    id: '6b54ffcd-c884-45c9-aa6e-57347f4cc156',
    label: 'Test User Group',
    createdAt: new Date(),
    updatedAt: new Date(),
    memberCount: 5,
  };

  beforeEach(() => {
    render(
      <TableBodyWrapper>
        <UserGroupAsLeadRow userGroup={mockUserGroup} />
      </TableBodyWrapper>
    );
  });

  it('renders without crashing', () => {
    const row = screen.getByTestId(`${mockUserGroup.id}-user-group-as-lead-row`);
    expect(row).toBeInTheDocument();
  });

  it('displays the correct label', () => {
    const label = screen.getByText(mockUserGroup.label);
    expect(label).toBeInTheDocument();
  });

  it('displays the correct member count', () => {
    const memberCount = screen.getByText(mockUserGroup.memberCount.toString());
    expect(memberCount).toBeInTheDocument();
  });

});
