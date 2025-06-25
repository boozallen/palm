import { render, screen, fireEvent } from '@testing-library/react';
import DeleteAiProviderModal from './DeleteAiProviderModal';
import useDeleteAiProvider from '@/features/settings/api/delete-ai-provider';

jest.mock('@/features/settings/api/delete-ai-provider');

describe('DeleteAiProviderModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  const deleteAiProviderMock = jest.fn();
  (useDeleteAiProvider as jest.Mock).mockReturnValue({
    mutateAsync: deleteAiProviderMock,
    error: undefined,
  });
  it('renders the modal with the correct props', () => {
    const modalOpened = true;
    const closeModalHandler = jest.fn();
    const aiProviderId = '123';

    render(
      <DeleteAiProviderModal
        modalOpened={modalOpened}
        closeModalHandler={closeModalHandler}
        aiProviderId={aiProviderId}
      />
    );

    expect(screen.getByText('Delete AI Provider')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to delete this AI Provider?')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Delete Provider')).toBeInTheDocument();
  });

  it('calls the closeModalHandler when cancel button is clicked', () => {
    const modalOpened = true;
    const closeModalHandler = jest.fn();
    const aiProviderId = '123';

    render(
      <DeleteAiProviderModal
        modalOpened={modalOpened}
        closeModalHandler={closeModalHandler}
        aiProviderId={aiProviderId}
      />
    );

    fireEvent.click(screen.getByText('Cancel'));

    expect(closeModalHandler).toHaveBeenCalledTimes(1);
  });

  it('calls the delete API when delete button is clicked', () => {
    const modalOpened = true;
    const closeModalHandler = jest.fn();
    const aiProviderId = '123';

    render(
      <DeleteAiProviderModal
        modalOpened={modalOpened}
        closeModalHandler={closeModalHandler}
        aiProviderId={aiProviderId}
      />
    );

    fireEvent.click(screen.getByText('Delete Provider'));

    expect(deleteAiProviderMock).toHaveBeenCalledTimes(1);
  });
});
