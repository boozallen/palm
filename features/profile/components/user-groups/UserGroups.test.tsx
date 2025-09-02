import { render, screen } from '@testing-library/react';
import UserGroups from './UserGroups';

// eslint-disable-next-line react/display-name
jest.mock('./table/UserGroupsTable', () => () => <div data-testid='user-groups-table' />);
// eslint-disable-next-line react/display-name
jest.mock('@/features/profile/components/forms/JoinUserGroupForm', () => () => <>Join User Group Form</>);

describe('UserGroups component', () => {
  test('renders without crashing', () => {
    render(<UserGroups />);
  });

  test('renders the Title component with correct text', () => {
    render(<UserGroups />);
    const titleElement = screen.getByRole('heading', { name: /My User Groups/i });
    expect(titleElement).toBeInTheDocument();
    expect(titleElement).toHaveTextContent('My User Groups');
  });

  test('renders the UserGroupsTable component', () => {
    render(<UserGroups />);
    const tableElement = screen.getByTestId('user-groups-table');
    expect(tableElement).toBeInTheDocument();
  });

  test('renders the JoinUserGroupForm component', () => {
    render(<UserGroups />);
    const joinUserGroupFormElement = screen.getByText('Join User Group Form');
    expect(joinUserGroupFormElement).toBeInTheDocument();
  });
});

