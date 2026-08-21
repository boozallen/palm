import { render } from '@testing-library/react';
import AddUserGroupMemberModal from './AddUserGroupMemberModal';

jest.mock('@/features/settings/components/user-groups/forms/AddUserGroupMemberForm', () => {
  return function MockedUserGroupMemberForm() {
    return <div>Mocked User Group Member Form</div>;
  };
});

const mockUserGroupId = 'mock-user-group-id';

describe('AddUserGroupMemberModal', () => {
  const closeMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render add user group member modal when opened prop is true', () => {
    const { queryByText } = render(
      <AddUserGroupMemberModal
        id={mockUserGroupId}
        modalOpen={true}
        closeModalHandler={closeMock}
      />
    );
    expect(queryByText('Add User')).toBeInTheDocument();
  });

  it('should not render add user group member modal when opened prop is false', () => {
    const { queryByText } = render(
      <AddUserGroupMemberModal
        id={mockUserGroupId}
        modalOpen={false}
        closeModalHandler={closeMock}
      />
    );
    expect(queryByText('Add User')).not.toBeInTheDocument();
  });
});
