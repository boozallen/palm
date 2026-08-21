import { render } from '@testing-library/react';
import AddAiProviderModal from './AddAiProviderModal';

jest.mock('@/features/settings/components/ai-providers/forms/AddAiProviderForm', () => {
  return jest.fn(() => <div>Add AI Provider Form</div>);
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
    expect(queryByText('Add AI Provider')).toBeInTheDocument();
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

  it('should render form when modal is open', () => {
    const { getByText } = render(
      <AddAiProviderModal
        modalOpen={true}
        closeModalHandler={closeMock}
      />
    );
    expect(getByText('Add AI Provider Form')).toBeInTheDocument();
  });
});
