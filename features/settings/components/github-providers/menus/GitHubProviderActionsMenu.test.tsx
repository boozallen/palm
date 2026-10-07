import { fireEvent, render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GitHubProviderActionsMenu } from './GitHubProviderActionsMenu';

describe('GitHubProviderActionsMenu', () => {
  const onEditClick = jest.fn();
  const onDeleteClick = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('renders without error', () => {
    const { container } = render(
      <GitHubProviderActionsMenu onEditClick={onEditClick} onDeleteClick={onDeleteClick} />,
    );
    expect(container).toBeTruthy();
  });

  it('expands the menu when the trigger icon is clicked', async () => {
    const { getByLabelText, queryAllByRole } = render(
      <GitHubProviderActionsMenu onEditClick={onEditClick} onDeleteClick={onDeleteClick} />,
    );

    expect(queryAllByRole('menuitem')).toHaveLength(0);

    await userEvent.click(getByLabelText('GitHub provider actions'));

    await waitFor(() => {
      expect(queryAllByRole('menuitem').length).toBeGreaterThan(0);
    });
  });

  it('calls onEditClick when Edit is clicked', () => {
    const { getByLabelText, getAllByRole } = render(
      <GitHubProviderActionsMenu onEditClick={onEditClick} onDeleteClick={onDeleteClick} />,
    );

    fireEvent.click(getByLabelText('GitHub provider actions'));

    const menuItems = getAllByRole('menuitem');
    fireEvent.click(menuItems[0]);

    expect(onEditClick).toHaveBeenCalled();
  });

  it('calls onDeleteClick when Delete is clicked', () => {
    const { getByLabelText, getAllByRole } = render(
      <GitHubProviderActionsMenu onEditClick={onEditClick} onDeleteClick={onDeleteClick} />,
    );

    fireEvent.click(getByLabelText('GitHub provider actions'));

    const menuItems = getAllByRole('menuitem');
    fireEvent.click(menuItems[1]);

    expect(onDeleteClick).toHaveBeenCalled();
  });
});
