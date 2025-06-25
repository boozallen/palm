import { fireEvent, render } from '@testing-library/react';
import AddAiProviderModal from './AddAiProviderModal';
import useAddAiProvider from '@/features/settings/api/add-ai-provider';

jest.mock('@/features/settings/api/add-ai-provider');
(useAddAiProvider as jest.Mock).mockReturnValue({
  mutateAsync: jest.fn(),
  isPending: false,
  error: null,
});

describe('AddAiProviderModal', () => {
  const closeMock = jest.fn();

  it('should render add ai provider modal when opened prop is true', () => {
    const { queryByText } = render(
      <AddAiProviderModal
        modalOpen={true}
        closeModalHandler={closeMock}
      />
    );
    expect(queryByText('AI Provider')).toBeInTheDocument();
  });

  it('should not render add ai provider modal when opened prop is false', () => {
    const { queryByText } = render(
      <AddAiProviderModal
        modalOpen={false}
        closeModalHandler={closeMock}
      />
    );
    expect(queryByText('Select AI Provider')).not.toBeInTheDocument();
  });

  it('should close the modal when cancel button is clicked', () => {
    const { getByText } = render(
      <AddAiProviderModal
        modalOpen={true}
        closeModalHandler={closeMock}
      />
    );
    fireEvent.click(getByText('Cancel'));
    expect(closeMock).toHaveBeenCalled();
  });

  it('should close the modal when add button is clicked', () => {
    const { getByTestId } = render(
      <AddAiProviderModal
        modalOpen={true}
        closeModalHandler={closeMock}
      />
    );
    fireEvent.click(getByTestId('submit'));
  });
});
