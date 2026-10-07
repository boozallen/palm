import { fireEvent, render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AgentProviderActionsMenu, AgentProviderActionsMenuProps } from './AgentProviderActionsMenu';

describe('AgentProviderActionsMenu', () => {
  const agentProviderId = '4a8f5b8d-8bf4-4e1d-9c9b-5357698f8c09';
  const agentProviderName = 'Test Agent';
  const onEditClick = jest.fn();
  const onDeleteClick = jest.fn();

  const props: AgentProviderActionsMenuProps = {
    agentProviderId,
    agentProviderName,
    onEditClick,
    onDeleteClick,
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('renders without error', () => {
    const { container } = render(<AgentProviderActionsMenu {...props} />);
    expect(container).toBeTruthy();
  });

  it('expands the menu when the icon is clicked', async () => {
    const { getByTestId, queryByTestId } = render(<AgentProviderActionsMenu {...props} />);

    expect(queryByTestId(`${agentProviderId}-menu-dropdown`)).not.toBeInTheDocument();

    await userEvent.click(getByTestId(`${agentProviderId}-actions-menu`));

    await waitFor(() => {
      expect(queryByTestId(`${agentProviderId}-menu-dropdown`)).toBeInTheDocument();
    });
  });

  it('calls onEditClick when Edit is clicked', () => {
    const { getByTestId, getAllByRole } = render(<AgentProviderActionsMenu {...props} />);

    fireEvent.click(getByTestId(`${agentProviderId}-actions-menu`));

    const menuItems = getAllByRole('menuitem');
    fireEvent.click(menuItems[0]);

    expect(onEditClick).toHaveBeenCalled();
  });

  it('calls onDeleteClick when Delete is clicked', () => {
    const { getByTestId, getAllByRole } = render(<AgentProviderActionsMenu {...props} />);

    fireEvent.click(getByTestId(`${agentProviderId}-actions-menu`));

    const menuItems = getAllByRole('menuitem');
    fireEvent.click(menuItems[1]);

    expect(onDeleteClick).toHaveBeenCalled();
  });
});
