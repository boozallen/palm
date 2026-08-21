import { useDisclosure } from '@mantine/hooks';
import { render } from '@testing-library/react';

import GitHubProviders from './GitHubProviders';

jest.mock('@mantine/hooks');

jest.mock('./tables/GitHubProvidersTable', () => {
  return function MockedGitHubProvidersTable() {
    return <div data-testid='github-providers-table-mock'>Mocked GitHub Providers Table</div>;
  };
});

jest.mock('./modals/AddGitHubProviderModal', () => {
  return jest.fn(() => <div>Add GitHub Provider Modal</div>);
});

describe('GitHub Providers', () => {
  let opened = false;
  const open = jest.fn(() => (opened = true));
  const close = jest.fn(() => (opened = false));

  (useDisclosure as jest.Mock).mockReturnValue([opened, { open, close }]);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render "GitHub Providers" title', () => {
    const { queryByText } = render(<GitHubProviders />);
    expect(queryByText('GitHub Providers')).toBeInTheDocument();
  });

  it('should render GitHubProvidersTable', () => {
    const { queryByTestId } = render(<GitHubProviders />);
    expect(queryByTestId('github-providers-table-mock')).toBeInTheDocument();
  });

  it('renders action icon', () => {
    const { getByLabelText } = render(<GitHubProviders />);
    const actionIcon = getByLabelText('Add GitHub provider');
    expect(actionIcon).toBeInTheDocument();
  });

  it('calls open function when action icon is clicked', () => {
    const { getByLabelText } = render(<GitHubProviders />);
    const actionIcon = getByLabelText('Add GitHub provider');
    actionIcon.click();
    expect(open).toHaveBeenCalled();
    expect(opened).toBe(true);
  });

  it('renders AddGitHubProviderModal', () => {
    const { getByText } = render(<GitHubProviders />);
    expect(getByText('Add GitHub Provider Modal')).toBeInTheDocument();
  });
});
