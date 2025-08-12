import { render, screen } from '@testing-library/react';
import { useDisclosure } from '@mantine/hooks';

import DocumentLibrary from './DocumentLibrary';
import useGetHasOpenAiModel from '@/features/shared/api/get-has-openai-model';

jest.mock('@mantine/hooks');

jest.mock('@/features/shared/api/get-has-openai-model');
jest.mock('./tables/DocumentLibraryTable', () => {
  return function DocumentLibraryTable() {
    return <div>Document Library Table</div>;
  };
});

const mockGetHasOpenAiModel = (useGetHasOpenAiModel as jest.Mock);

const setHasOpenAiModel = (value: boolean, isLoading: boolean) => {
  mockGetHasOpenAiModel.mockReturnValue({
    data: value,
    isPending: isLoading,
  });
};

describe('DocumentLibrary', () => {
  const openModal = jest.fn();
  const closeModal = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useDisclosure as jest.Mock).mockReturnValue([
      false,
      { open: openModal, close: closeModal },
    ]);

    setHasOpenAiModel(true, false);
  });

  it('renders title, action icon, and document library table', () => {
    render(<DocumentLibrary />);

    const title = screen.getByText('My Uploaded Documents');
    const actionIcon = screen.getByTestId('add-document-button');

    expect(title).toBeInTheDocument();
    expect(actionIcon).toBeInTheDocument();
    expect(screen.queryByText('Document Library Table')).toBeInTheDocument();
  });

  it('opens the modal when the action icon is clicked', () => {
    render(<DocumentLibrary />);

    const actionIcon = screen.getByTestId('add-document-button');
    actionIcon.click();

    expect(openModal).toHaveBeenCalled();
  });

  it('renders table', () => {
    render(<DocumentLibrary />);

    const table = screen.getByText('Document Library Table');

    expect(table).toBeInTheDocument();
  });

  it('disables action icon if user does not have openai model availale', () => {
    setHasOpenAiModel(false, false);

    render(<DocumentLibrary />);

    const actionIcon = screen.getByTestId('add-document-button');

    expect(actionIcon).toBeDisabled();
  });

  it('shows loading text if api is loading', () => {
    setHasOpenAiModel(true, true);

    const { container } = render(<DocumentLibrary />);

    expect(container).toHaveTextContent('Loading...');
  });
});
