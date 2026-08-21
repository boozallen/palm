import { render, screen, fireEvent } from '@testing-library/react';
import EditGitHubProviderModal from './EditGitHubProviderModal';

jest.mock('../forms/EditGitHubProviderForm', () => {
  return function MockedEditGitHubProviderForm({
    setFormCompleted,
  }: {
    setFormCompleted: (v: boolean) => void;
  }) {
    return <button onClick={() => setFormCompleted(true)}>Submit Form</button>;
  };
});

describe('EditGitHubProviderModal', () => {
  const closeModalHandler = jest.fn();

  const defaultProps = {
    modalOpen: true,
    closeModalHandler,
    providerId: 'provider-uuid-1',
    currentLabel: 'My Provider',
    currentApiBaseUrl: 'https://api.github.com',
    currentOwner: 'myorg',
    currentRepo: 'my-repo',
    currentDescription: 'A test provider',
    currentIsSkillRepo: false,
    currentSkillRepoBranch: null as string | null,
    currentSkillRepoServiceUrl: null as string | null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the modal with the correct title when open', () => {
    render(<EditGitHubProviderModal {...defaultProps} />);

    expect(screen.getByText('Edit GitHub Provider')).toBeInTheDocument();
  });

  it('does not render modal content when closed', () => {
    render(<EditGitHubProviderModal {...defaultProps} modalOpen={false} />);

    expect(screen.queryByText('Edit GitHub Provider')).not.toBeInTheDocument();
  });

  it('calls closeModalHandler when the form completes', () => {
    render(<EditGitHubProviderModal {...defaultProps} />);

    fireEvent.click(screen.getByText('Submit Form'));

    expect(closeModalHandler).toHaveBeenCalled();
  });
});
