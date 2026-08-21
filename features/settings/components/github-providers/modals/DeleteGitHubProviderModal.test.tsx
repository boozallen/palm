import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DeleteGitHubProviderModal from './DeleteGitHubProviderModal';
import useDeleteGitHubProvider from '@/features/settings/api/github-providers/delete-github-provider';

jest.mock('@/features/settings/api/github-providers/delete-github-provider');

describe('DeleteGitHubProviderModal', () => {
  const closeModalHandler = jest.fn();
  const mockMutateAsync = jest.fn();

  const defaultProps = {
    modalOpened: true,
    closeModalHandler,
    providerId: 'provider-uuid-1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useDeleteGitHubProvider as jest.Mock).mockReturnValue({
      mutateAsync: mockMutateAsync,
      error: null,
    });
  });

  it('renders the modal title', () => {
    render(<DeleteGitHubProviderModal {...defaultProps} />);

    expect(screen.getByText('Delete GitHub Provider')).toBeInTheDocument();
  });

  it('calls closeModalHandler when Cancel is clicked', () => {
    render(<DeleteGitHubProviderModal {...defaultProps} />);

    fireEvent.click(screen.getByText('Cancel'));

    expect(closeModalHandler).toHaveBeenCalledTimes(1);
  });

  it('calls mutateAsync with the provider id and closes modal on success', async () => {
    mockMutateAsync.mockResolvedValue(undefined);

    render(<DeleteGitHubProviderModal {...defaultProps} />);

    fireEvent.click(screen.getByText('Delete Provider'));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({ id: 'provider-uuid-1' });
      expect(closeModalHandler).toHaveBeenCalled();
    });
  });

  it('does not call closeModalHandler when mutateAsync throws', async () => {
    mockMutateAsync.mockRejectedValue(new Error('Delete failed'));

    render(<DeleteGitHubProviderModal {...defaultProps} />);

    fireEvent.click(screen.getByText('Delete Provider'));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalled();
    });

    expect(closeModalHandler).not.toHaveBeenCalled();
  });
});
