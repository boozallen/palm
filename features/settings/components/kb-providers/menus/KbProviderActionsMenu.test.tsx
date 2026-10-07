import { KbProviderActionsMenu, KbProviderActionsMenuProps } from './KbProviderActionsMenu';
import { fireEvent, render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('KbProviderActionsMenu', () => {
  const kbProviderId = 'a8e49a00-0111-43f4-9b1b-7175d875f8b8';
  const kbProviderLabel = 'KB Provider Label';
  const onEditClick = jest.fn();
  const onDeleteClick = jest.fn();
  const onAddKnowledgeBaseClick = jest.fn();

  const props: KbProviderActionsMenuProps = {
    kbProviderId,
    kbProviderLabel,
    onEditClick,
    onDeleteClick,
    onAddKnowledgeBaseClick,
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('renders component without error', () => {
    const { container } = render(<KbProviderActionsMenu {...props} />);
    expect(container).toBeTruthy();
  });

  it('expands menu when IconDotsVertical is clicked', async () => {
    const { getByTestId, queryByTestId } = render(<KbProviderActionsMenu {...props} />);

    let menuDropdown = queryByTestId(`${props.kbProviderId}-menu-dropdown`);
    expect(menuDropdown).not.toBeInTheDocument();

    const menuIcon = getByTestId((`${props.kbProviderId}-actions-menu`));
    await userEvent.click(menuIcon);

    await waitFor(() => {
      menuDropdown = queryByTestId(`${props.kbProviderId}-menu-dropdown`);
      expect(menuDropdown).toBeInTheDocument();
    });
  });

  it('calls onAddKnowledgeBaseClick callback when Add Knowledge Base button is clicked', async () => {
    const { getByTestId, getAllByRole } = render(<KbProviderActionsMenu {...props} />);

    const menuIcon = getByTestId((`${props.kbProviderId}-actions-menu`));
    fireEvent.click(menuIcon);

    const menuItems = getAllByRole('menuitem');
    const addModelButton = menuItems[0];
    fireEvent.click(addModelButton);

    expect(onAddKnowledgeBaseClick).toHaveBeenCalled();
  });

  it('calls onEditClick callback when edit button is clicked', async () => {
    const { getByTestId, getAllByRole } = render(<KbProviderActionsMenu {...props} />);

    const menuIcon = getByTestId((`${props.kbProviderId}-actions-menu`));
    fireEvent.click(menuIcon);

    const menuItems = getAllByRole('menuitem');
    const editButton = menuItems[1];
    fireEvent.click(editButton);

    expect(onEditClick).toHaveBeenCalled();
  });

  it('calls onDeleteClick callback when delete button is clicked', async () => {
    const { getByTestId, getAllByRole } = render(<KbProviderActionsMenu {...props} />);

    const menuIcon = getByTestId((`${props.kbProviderId}-actions-menu`));
    fireEvent.click(menuIcon);

    const menuItems = getAllByRole('menuitem');
    const deleteButton = menuItems[2];
    fireEvent.click(deleteButton);

    expect(onDeleteClick).toHaveBeenCalled();
  });
});
