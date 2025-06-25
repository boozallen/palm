import { fireEvent, render } from '@testing-library/react';
import { useDisclosure } from '@mantine/hooks';
import AiProviders from './AiProviders';

jest.mock('@mantine/hooks', () => ({
  ...jest.requireActual('@mantine/hooks'),
  useDisclosure: jest.fn(),
}));

jest.mock('./tables/AiProvidersTable', () => {
  return function MockedAiProvidersTable() {
    return <div data-testid='ai-providers-table'></div>;
  };
});

describe('AiProviders', () => {
  const openMock = jest.fn();
  const closeMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useDisclosure as jest.Mock).mockReturnValue([
      false,
      { open: openMock, close: closeMock },
    ]);
  });

  it('should render the AiProviders component', () => {
    const { container } = render(<AiProviders />);

    expect(container).toBeTruthy();
  });

  it('should render header and action icon', () => {
    const { getByText, getByTestId } = render(<AiProviders />);

    const header = getByText('AI Providers');
    const icon = getByTestId('add-provider-button');

    expect(header).toBeInTheDocument();
    expect(icon).toBeInTheDocument();
  });

  it('should open AddAiProviderModal when icon is clicked', () => {
    const { getByTestId } = render(<AiProviders />);

    const icon = getByTestId('add-provider-button');
    fireEvent.click(icon);

    expect(openMock).toHaveBeenCalled();
  });

  it('should render AiProvidersTable', () => {
    const { getByTestId } = render(<AiProviders />);

    const table = getByTestId('ai-providers-table');

    expect(table).toBeInTheDocument();
  });
});
