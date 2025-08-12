import { AiProviderActionsMenu, AiProviderActionsMenuProps } from './AiProviderActionsMenu';
import { fireEvent, render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('AiProviderActionsMenu', () => {
  const providerId = 'a8e49a00-0111-43f4-9b1b-7175d875f8b8';
  const providerLabel = 'Provider Label';
  const onEditClick = jest.fn();
  const onDeleteClick = jest.fn();
  const onAddModelClick = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('renders component without error', () => {
    const props: AiProviderActionsMenuProps = {
      providerId,
      providerLabel,
      onEditClick,
      onDeleteClick,
      onAddModelClick,
    };

    const { container } = render(<AiProviderActionsMenu {...props} />);
    expect(container).toBeTruthy();
  });
  it('expands menu when IconDotsVertical is clicked', async () => {
    const props: AiProviderActionsMenuProps = {
      providerId,
      providerLabel,
      onEditClick,
      onDeleteClick,
      onAddModelClick,
    };

    const { getByTestId, queryByTestId } = render(<AiProviderActionsMenu {...props} />);

    let menuDropdown = queryByTestId(`${props.providerId}-menu-dropdown`);
    expect(menuDropdown).not.toBeInTheDocument();

    const menuIcon = getByTestId((`${props.providerId}-actions-menu`));
    await userEvent.click(menuIcon);

    await waitFor(() => {
      menuDropdown = queryByTestId(`${props.providerId}-menu-dropdown`);
      expect(menuDropdown).toBeInTheDocument();
    });
  });
  it('calls onAddModelClick callback when Add Model button is clicked', async () => {
    const onAddModelClick = jest.fn();

    const props: AiProviderActionsMenuProps = {
      providerId,
      providerLabel,
      onEditClick,
      onDeleteClick,
      onAddModelClick,
    };

    const { getByTestId, getAllByRole } = render(<AiProviderActionsMenu {...props} />);

    const menuIcon = getByTestId((`${props.providerId}-actions-menu`));
    fireEvent.click(menuIcon);

    const menuItems = getAllByRole('menuitem');
    const addModelButton = menuItems[0];
    fireEvent.click(addModelButton);

    expect(onAddModelClick).toHaveBeenCalled();
  });
  it('calls onEditClick callback when edit button is clicked', async () => {

    const props: AiProviderActionsMenuProps = {
      providerId,
      providerLabel,
      onEditClick,
      onDeleteClick,
      onAddModelClick,
    };

    const { getByTestId, getAllByRole } = render(<AiProviderActionsMenu {...props} />);

    const menuIcon = getByTestId((`${props.providerId}-actions-menu`));
    fireEvent.click(menuIcon);

    const menuItems = getAllByRole('menuitem');
    const editButton = menuItems[1];
    fireEvent.click(editButton);

    expect(onEditClick).toHaveBeenCalled();
  });
  it('calls onDeleteClick callback when delete button is clicked', async () => {
    const onDeleteClick = jest.fn();

    const props: AiProviderActionsMenuProps = {
      providerId,
      providerLabel,
      onEditClick,
      onDeleteClick,
      onAddModelClick,
    };

    const { getByTestId, getAllByRole } = render(<AiProviderActionsMenu {...props} />);

    const menuIcon = getByTestId((`${props.providerId}-actions-menu`));
    fireEvent.click(menuIcon);

    const menuItems = getAllByRole('menuitem');
    const deleteButton = menuItems[2];
    fireEvent.click(deleteButton);

    expect(onDeleteClick).toHaveBeenCalled();
  });
});
