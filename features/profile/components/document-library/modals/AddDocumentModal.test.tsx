import { render, screen } from '@testing-library/react';

import AddDocumentModal from './AddDocumentModal';

jest.mock('@/features/profile/components/document-library/forms/AddDocumentForm', () => {
  return function AddDocumentFormMock() {
    return <>Add Document Form</>;
  };
});

describe('AddDocumentModal', () => {
  const closeModalHandler = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the modal if isOpen is true', () => {
    render(
      <AddDocumentModal isModalOpen={true} closeModalHandler={closeModalHandler} />
    );

    expect(screen.getByText('Upload Document(s)')).toBeInTheDocument();
    expect(screen.getByText('Add Document Form')).toBeInTheDocument();
  });

  it('does not render the modal if isOpen is false', () => {
    render(
      <AddDocumentModal isModalOpen={false} closeModalHandler={closeModalHandler} />
    );

    expect(screen.queryByText('Upload Document(s)')).not.toBeInTheDocument();
    expect(screen.queryByText('Add Document Form')).not.toBeInTheDocument();
  });
});
