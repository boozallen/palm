import { render, screen } from '@testing-library/react';
import { useDisclosure } from '@mantine/hooks';

import DocumentUploadProviders from '@/features/settings/components/document-upload/DocumentUploadProviders';

jest.mock('@mantine/hooks');
jest.mock('./modals/AddDocumentUploadProviderModal', () => {
  return jest.fn(() => <div>Add Document Upload Provider Modal</div>);
});

jest.mock('./tables/DocumentUploadProvidersTable', () => {
  return jest.fn(() => <p>Document Upload Providers Table</p>);
});

describe('DocumentUploadProviders', () => {
  let opened = false;
  const open = jest.fn(() => opened = true);
  const close = jest.fn(() => opened = false);

  beforeEach(() => {
    jest.clearAllMocks();

    (useDisclosure as jest.Mock).mockReturnValueOnce([
      opened,
      { open, close },
    ]);
  });

  it('renders title', () => {
    render(<DocumentUploadProviders />);

    const title = screen.getByText('Document Upload Providers');

    expect(title).toBeInTheDocument();
  });

  it('renders action icon', () => {
    render(<DocumentUploadProviders />);

    const icon = screen.getByLabelText('Add document upload provider');

    expect(icon).toBeInTheDocument();
  });

  it('renders add document upload modal', () => {
    render(<DocumentUploadProviders />);

    const modal = screen.getByText('Add Document Upload Provider Modal');

    expect(modal).toBeInTheDocument();
  });

  it('calls open function when action icon is clicked', () => {
    render(<DocumentUploadProviders />);

    const icon = screen.getByLabelText('Add document upload provider');

    expect(opened).toBe(false);

    icon.click();

    expect(open).toHaveBeenCalled();
    expect(opened).toBe(true);
  });

  it('renders table', () => {
    render(<DocumentUploadProviders />);

    const table = screen.getByText('Document Upload Providers Table');

    expect(table).toBeInTheDocument();
  });
});
