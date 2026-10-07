import React from 'react';
import { render, screen, act } from '@testing-library/react';

import EditDocumentUploadProviderModal from './EditDocumentUploadProviderModal';
import { DocumentUploadProviderType, SanitizedDocumentUploadProvider } from '@/features/shared/types/document-upload-provider';

jest.mock('@/features/settings/components/document-upload/forms/EditDocumentUploadProviderForm', () =>
  jest.fn(({ setFormCompleted }: { setFormCompleted: (val: boolean) => void }) => (
    <div>
      <span>Edit Document Upload Provider Form</span>
      <button type='button' onClick={() => setFormCompleted(true)}>Complete Form</button>
    </div>
  ))
);

const mockProvider: SanitizedDocumentUploadProvider = {
  id: 'uuid-123',
  label: 'My Provider',
  providerType: DocumentUploadProviderType.AWS,
  sourceUri: 's3://existing-bucket/key',
};

describe('EditDocumentUploadProviderModal', () => {
  const closeModal = jest.fn();

  beforeEach(jest.clearAllMocks);

  it('renders the modal when opened', () => {
    render(
      <EditDocumentUploadProviderModal
        provider={mockProvider}
        opened={true}
        handleCloseModal={closeModal}
      />
    );

    expect(screen.getByText('Edit Document Upload Provider')).toBeInTheDocument();
  });

  it('does not render the modal when closed', () => {
    render(
      <EditDocumentUploadProviderModal
        provider={mockProvider}
        opened={false}
        handleCloseModal={closeModal}
      />
    );

    expect(screen.queryByText('Edit Document Upload Provider')).not.toBeInTheDocument();
  });

  it('renders the edit form', () => {
    render(
      <EditDocumentUploadProviderModal
        provider={mockProvider}
        opened={true}
        handleCloseModal={closeModal}
      />
    );

    expect(screen.getByText('Edit Document Upload Provider Form')).toBeInTheDocument();
  });

  it('calls handleCloseModal when form completes', async () => {
    render(
      <EditDocumentUploadProviderModal
        provider={mockProvider}
        opened={true}
        handleCloseModal={closeModal}
      />
    );

    await act(async () => {
      screen.getByRole('button', { name: /Complete Form/i }).click();
    });

    expect(closeModal).toHaveBeenCalledTimes(1);
  });
});
