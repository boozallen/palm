import { render, screen, fireEvent } from '@testing-library/react';
import AddAgentProviderModal from './AddAgentProviderModal';

jest.mock('../forms/AddAgentProviderForm', () => {
  return function MockedAddAgentProviderForm({ setFormCompleted }: { setFormCompleted: (v: boolean) => void }) {
    return (
      <button onClick={() => setFormCompleted(true)}>
        Submit Form
      </button>
    );
  };
});

describe('AddAgentProviderModal', () => {
  const closeModalHandler = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the modal with correct title when open', () => {
    render(
      <AddAgentProviderModal
        modalOpen={true}
        closeModalHandler={closeModalHandler}
      />
    );

    expect(screen.getByText('Add Agent Provider')).toBeInTheDocument();
  });

  it('does not render modal content when closed', () => {
    render(
      <AddAgentProviderModal
        modalOpen={false}
        closeModalHandler={closeModalHandler}
      />
    );

    expect(screen.queryByText('Add Agent Provider')).not.toBeInTheDocument();
  });

  it('calls closeModalHandler when the form completes', () => {
    render(
      <AddAgentProviderModal
        modalOpen={true}
        closeModalHandler={closeModalHandler}
      />
    );

    fireEvent.click(screen.getByText('Submit Form'));

    expect(closeModalHandler).toHaveBeenCalled();
  });
});
