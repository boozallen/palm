import { render, screen } from '@testing-library/react';

import AddDocumentUploadProviderModal from './AddDocumentUploadProviderModal';

jest.mock('@/features/settings/components/document-upload/forms/AddDocumentUploadProviderForm', () => {
  return jest.fn(() => <div>Add Document Upload Provider Form</div>);
});

describe('AddDocumentUploadProviderModal', () => {
  const closeModal = jest.fn();

  beforeEach(jest.clearAllMocks);

  it('renders the modal if its opened', () => {
    render(
      <AddDocumentUploadProviderModal
        opened={true}
        handleCloseModal={closeModal}
      />
    );

    const modal = screen.getByText('Add Document Upload Provider');

    expect(modal).toBeInTheDocument();
  });

  it('does not render the modal if its closed', () => {
    render(
      <AddDocumentUploadProviderModal
        opened={false}
        handleCloseModal={closeModal}
      />
    );

    const modal = screen.queryByText('Add Document Upload Provider');

    expect(modal).not.toBeInTheDocument();
  });

  it('renders form', () => {
    render(
      <AddDocumentUploadProviderModal
        opened={true}
        handleCloseModal={closeModal}
      />
    );

    const form = screen.getByText('Add Document Upload Provider Form');

    expect(form).toBeInTheDocument();
  });
});
