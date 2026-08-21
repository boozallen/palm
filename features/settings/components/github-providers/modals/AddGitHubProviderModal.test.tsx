import { render, screen, fireEvent } from '@testing-library/react';
import AddGitHubProviderModal from './AddGitHubProviderModal';

jest.mock('../forms/AddGitHubProviderForm', () => {
  return function MockedAddGitHubProviderForm({
    setFormCompleted,
  }: {
    setFormCompleted: (v: boolean) => void;
  }) {
    return <button onClick={() => setFormCompleted(true)}>Submit Form</button>;
  };
});

describe('AddGitHubProviderModal', () => {
  const closeModalHandler = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the modal with the correct title when open', () => {
    render(<AddGitHubProviderModal modalOpen={true} closeModalHandler={closeModalHandler} />);

    expect(screen.getByText('Add GitHub Provider')).toBeInTheDocument();
  });

  it('does not render modal content when closed', () => {
    render(<AddGitHubProviderModal modalOpen={false} closeModalHandler={closeModalHandler} />);

    expect(screen.queryByText('Add GitHub Provider')).not.toBeInTheDocument();
  });

  it('calls closeModalHandler when the form completes', () => {
    render(<AddGitHubProviderModal modalOpen={true} closeModalHandler={closeModalHandler} />);

    fireEvent.click(screen.getByText('Submit Form'));

    expect(closeModalHandler).toHaveBeenCalled();
  });
});
