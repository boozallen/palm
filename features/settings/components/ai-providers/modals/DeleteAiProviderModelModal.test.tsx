import useDeleteAiProviderModel from '@/features/settings/api/ai-providers/delete-ai-provider-model';
import { fireEvent, render, screen } from '@testing-library/react';
import DeleteAiProviderModelModal from '@/features/settings/components/ai-providers/modals/DeleteAiProviderModelModal';

jest.mock('@/features/settings/api/ai-providers/delete-ai-provider-model');
describe('DeleteAiProviderModelModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const deleteAiProviderModelMock = jest.fn();
  (useDeleteAiProviderModel as jest.Mock).mockReturnValue({
    mutateAsync: deleteAiProviderModelMock,
    error: undefined,
  });

  it('should renders the modal', () => {
    const modalOpened = true;
    const closeModalHandler = jest.fn();
    const modelId = '1';

    render(
      <DeleteAiProviderModelModal
        modalOpened={modalOpened}
        closeModalHandler={closeModalHandler}
        modelId={modelId}
      />
    );

    expect(screen.getByText('Delete AI Provider Model')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to delete this AI Provider Model?')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Delete Model')).toBeInTheDocument();
  });

  it('should calls endpoint when delete is clicked', () => {
    const modalOpened = true;
    const closeModalHandler = jest.fn();
    const modelId = '1';

    render(
      <DeleteAiProviderModelModal
        modalOpened={modalOpened}
        closeModalHandler={closeModalHandler}
        modelId={modelId}
      />
    );

    fireEvent.click(screen.getByText('Delete Model'));
  });
});
