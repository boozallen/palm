import { render } from '@testing-library/react';
import AddUserGroupModal from '@/features/settings/components/user-groups/modals/AddUserGroupModal';

jest.mock('@/features/settings/api/user-groups/create-user-group', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    mutateAsync: jest.fn(),
    isPending: false,
    error: null,
  })),
}));

jest.mock('@/features/settings/components/user-groups/forms/AddUserGroupForm', () => {
  return function MockedUserGroupForm() {
    return <div>Mocked User Group Form</div>;
  };
});

describe('AddUserGroupModal', () => {
  const closeModalHandler = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render without failure', () => {
    const { container } = render(<AddUserGroupModal modalOpen={true} closeModalHandler={closeModalHandler} />);

    expect(container).toBeTruthy();
  });

  it('should display modal with form when modalOpen is true', () => {
    const { queryByText } = render(<AddUserGroupModal modalOpen={true} closeModalHandler={closeModalHandler} />);

    expect(queryByText('Add User Group')).toBeInTheDocument();
    expect(queryByText('Mocked User Group Form')).toBeInTheDocument();
  });

  it('should not display modal with form when modalOpen is false', () => {
    const { queryByText } = render(<AddUserGroupModal modalOpen={false} closeModalHandler={closeModalHandler} />);

    expect(queryByText('Mocked User Group Form')).not.toBeInTheDocument();
  });
});
