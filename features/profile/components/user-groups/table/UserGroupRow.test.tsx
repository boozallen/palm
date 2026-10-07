import { render, screen } from '@testing-library/react';
import { UserGroupRole } from '@/features/shared/types/user-group';
import UserGroupRow from './UserGroupRow';

describe('UserGroupRow Component', () => {
  const group = { id: '1', label: 'Test Group', role: UserGroupRole.Lead };

  test('renders the group label and role correctly', () => {
    const container = document.body.appendChild(document.createElement('table')).appendChild(document.createElement('tbody'));
    render(<UserGroupRow group={group} />, { container });
    
    const labelCell = screen.getByText('Test Group');
    const roleCell = screen.getByText(UserGroupRole.Lead);

    expect(labelCell).toBeInTheDocument();
    expect(roleCell).toBeInTheDocument();
  });
});
