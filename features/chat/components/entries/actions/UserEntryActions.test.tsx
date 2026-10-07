import { render, screen } from '@testing-library/react';

import { UserEntryActions } from './UserEntryActions';

jest.mock('./action-item/DeleteUserEntry', () => ({
  DeleteUserEntry: jest.fn(() => <div>DeleteUserEntry</div>),
}));

jest.mock('./action-item/EditUserEntry', () => ({
  EditUserEntry: jest.fn(() => <div>EditUserEntry</div>),
}));

describe('UserEntryActions', () => {
  const stubEntryId = '57d1f38f-c892-49af-8a48-459641c508e0';

  beforeEach(jest.clearAllMocks);

  it('renders DeleteUserEntry component', () => {
    render(<UserEntryActions entryId={stubEntryId} />);

    const component = screen.getByText('DeleteUserEntry');

    expect(component).toBeInTheDocument();
  });

  it('renders EditUserEntry component', () => {
    render(<UserEntryActions entryId={stubEntryId} />);

    const component = screen.getByText('EditUserEntry');

    expect(component).toBeInTheDocument();
  });
});
