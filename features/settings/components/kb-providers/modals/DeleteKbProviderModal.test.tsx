import { render, screen, fireEvent } from '@testing-library/react';
import DeleteKbProviderModal from './DeleteKbProviderModal';
import useDeleteKbProvider from '@/features/settings/api/kb-providers/delete-kb-provider';

jest.mock('@/features/settings/api/kb-providers/delete-kb-provider');

describe('DeleteKbProviderModal', () => {
  const modalOpened = true;
  const closeModalHandler = jest.fn();
  const mockKbProviderId = '123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const deleteKbProviderMock = jest.fn();
  (useDeleteKbProvider as jest.Mock).mockReturnValue({
    mutateAsync: deleteKbProviderMock,
    error: undefined,
  });

  it('renders the modal with the correct props', () => {
    render(
      <DeleteKbProviderModal
        modalOpened={modalOpened}
        closeModalHandler={closeModalHandler}
        kbProviderId={mockKbProviderId}
      />
    );

    expect(screen.getByText('Delete Knowledge Base Provider')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to delete this Knowledge Base Provider?')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Delete Provider')).toBeInTheDocument();
  });

  it('calls the closeModalHandler when cancel button is clicked', () => {
    render(
      <DeleteKbProviderModal
        modalOpened={modalOpened}
        closeModalHandler={closeModalHandler}
        kbProviderId={mockKbProviderId}
      />
    );

    fireEvent.click(screen.getByText('Cancel'));

    expect(closeModalHandler).toHaveBeenCalledTimes(1);
  });

  it('calls the delete API when delete button is clicked', () => {
    render(
      <DeleteKbProviderModal
        modalOpened={modalOpened}
        closeModalHandler={closeModalHandler}
        kbProviderId={mockKbProviderId}
      />
    );

    fireEvent.click(screen.getByText('Delete Provider'));

    expect(deleteKbProviderMock).toHaveBeenCalledTimes(1);
  });
});
