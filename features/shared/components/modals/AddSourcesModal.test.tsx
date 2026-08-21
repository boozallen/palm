import { screen, fireEvent, waitFor, act } from '@testing-library/react';
import { notifications } from '@mantine/notifications';

import AddSourcesModal from '@/features/shared/components/modals/AddSourcesModal';
import { MAX_FILE_SIZE_MB, MAX_FILE_SIZE, DocumentUploadStatus, DOCUMENT_LIBRARY_DOCUMENT_LIMIT } from '@/features/shared/types/document';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import { renderWrapper } from '@/test/test-utils';
import useGetDocuments from '@/features/shared/api/document-upload/get-documents';
import useGetPresignedUrl from '@/features/shared/api/document-upload/get-presigned-url';
import useProcessDocument from '@/features/shared/api/document-upload/process-document';

jest.mock('@/features/shared/api/get-system-config');
jest.mock('@/features/shared/api/document-upload/get-documents', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock('@/features/shared/api/document-upload/get-presigned-url', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock('@/features/shared/api/document-upload/process-document', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock('@mantine/notifications', () => ({
  notifications: {
    show: jest.fn(),
  },
}));

describe('AddSourcesModal', () => {
  const closeModalHandler = jest.fn();
  const setUploadingDocuments = jest.fn();
  const onDocumentsUploaded = jest.fn();
  const onUploadStart = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useGetSystemConfig as jest.Mock).mockReturnValue({
      data: {
        documentLibraryDocumentUploadProviderId: 'test-provider-id',
      },
      isPending: false,
    });

    (useGetDocuments as jest.Mock).mockReturnValue({
      data: {
        documents: [],
      },
      isPending: false,
    });

    (useGetPresignedUrl as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    });

    (useProcessDocument as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    });
  });

  it('renders the modal when isModalOpen is true', () => {
    renderWrapper(
      <AddSourcesModal
        isModalOpen={true}
        closeModalHandler={closeModalHandler}
        documentSourceCount={0}
        setUploadingDocuments={setUploadingDocuments}
        onDocumentsUploaded={onDocumentsUploaded}
        onUploadStart={onUploadStart}
      />
    );

    expect(screen.getByText('Add Data Sources')).toBeInTheDocument();
    expect(screen.getByText(/Upload documents to help PALM generate more relevant and accurate responses/i)).toBeInTheDocument();
    expect(screen.getByText('Upload documents')).toBeInTheDocument();
  });

  it('does not render the modal when isModalOpen is false', () => {
    renderWrapper(
      <AddSourcesModal
        isModalOpen={false}
        closeModalHandler={closeModalHandler}
        documentSourceCount={0}
        setUploadingDocuments={setUploadingDocuments}
        onDocumentsUploaded={onDocumentsUploaded}
        onUploadStart={onUploadStart}
      />
    );

    expect(screen.queryByText('Add Data Sources')).not.toBeInTheDocument();
    expect(screen.queryByText('Upload documents')).not.toBeInTheDocument();
  });

  it('displays file type information', () => {
    renderWrapper(
      <AddSourcesModal
        isModalOpen={true}
        closeModalHandler={closeModalHandler}
        documentSourceCount={0}
        setUploadingDocuments={setUploadingDocuments}
        onDocumentsUploaded={onDocumentsUploaded}
        onUploadStart={onUploadStart}
      />
    );

    expect(screen.getByText(/Supported file types:/i)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`max ${MAX_FILE_SIZE_MB}MB per file`, 'i'))).toBeInTheDocument();
  });

  it('automatically starts upload when file is selected', async () => {
    renderWrapper(
      <AddSourcesModal
        isModalOpen={true}
        closeModalHandler={closeModalHandler}
        documentSourceCount={0}
        setUploadingDocuments={setUploadingDocuments}
        onDocumentsUploaded={onDocumentsUploaded}
        onUploadStart={onUploadStart}
      />
    );

    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    const input = screen.getByTestId('file-input') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    // Modal should close
    await waitFor(() => {
      expect(closeModalHandler).toHaveBeenCalled();
    });
  });

  it('displays document limit widget', () => {
    renderWrapper(
      <AddSourcesModal
        isModalOpen={true}
        closeModalHandler={closeModalHandler}
        documentSourceCount={5}
        setUploadingDocuments={setUploadingDocuments}
        onDocumentsUploaded={onDocumentsUploaded}
        onUploadStart={onUploadStart}
      />
    );

    expect(screen.getByText('Document limit')).toBeInTheDocument();
    expect(screen.getByText(`5 / ${DOCUMENT_LIBRARY_DOCUMENT_LIMIT}`)).toBeInTheDocument();
  });

  describe('notifications', () => {
    const mockXHRInstance = {
      open: jest.fn(),
      send: jest.fn(),
      setRequestHeader: jest.fn(),
      addEventListener: jest.fn(),
      status: 200,
      timeout: 0,
    };

    const originalXMLHttpRequest = global.XMLHttpRequest;

    beforeEach(() => {
      (global as any).XMLHttpRequest = jest.fn(() => mockXHRInstance);

      mockXHRInstance.addEventListener.mockImplementation((event, handler) => {
        if (event === 'load') {
          mockXHRInstance.send.mockImplementation(() => {
            handler();
          });
        }
      });
    });

    afterAll(() => {
      global.XMLHttpRequest = originalXMLHttpRequest;
    });

    it('uploads files and closes modal', async () => {
      const mockGetPresignedUrl = jest.fn().mockResolvedValue({
        presignedUrl: 'https://test-url.com',
        fileKey: 'test-key',
      });
      const mockProcessDocument = jest.fn().mockResolvedValue({
        documentId: 'doc-123',
      });

      (useGetPresignedUrl as jest.Mock).mockReturnValue({
        mutateAsync: mockGetPresignedUrl,
      });

      (useProcessDocument as jest.Mock).mockReturnValue({
        mutateAsync: mockProcessDocument,
      });

      renderWrapper(
        <AddSourcesModal
          isModalOpen={true}
          closeModalHandler={closeModalHandler}
          documentSourceCount={0}
          setUploadingDocuments={setUploadingDocuments}
          onDocumentsUploaded={onDocumentsUploaded}
          onUploadStart={onUploadStart}
        />
      );

      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      const input = screen.getByTestId('file-input') as HTMLInputElement;

      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(mockGetPresignedUrl).toHaveBeenCalled();
      });
    });

    it('shows error notification when file size exceeds limit', async () => {
      renderWrapper(
        <AddSourcesModal
          isModalOpen={true}
          closeModalHandler={closeModalHandler}
          documentSourceCount={0}
          setUploadingDocuments={setUploadingDocuments}
          onDocumentsUploaded={onDocumentsUploaded}
          onUploadStart={onUploadStart}
        />
      );

      const largeFile = new File(['content'], 'large.pdf', { type: 'application/pdf' });
      Object.defineProperty(largeFile, 'size', { value: MAX_FILE_SIZE + 1 });
      const input = screen.getByTestId('file-input') as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { files: [largeFile] } });
      });

      await waitFor(() => {
        expect(notifications.show).toHaveBeenCalledWith(expect.objectContaining({
          id: expect.stringContaining('upload-documents-rejected-'),
          title: 'File Rejected',
          message: expect.stringContaining(`File size exceeds ${MAX_FILE_SIZE_MB}MB limit`),
        }));
      });
    });

    it('shows error notification when upload fails', async () => {
      const mockError = new Error('Network error');
      const mockGetPresignedUrl = jest.fn().mockRejectedValue(mockError);

      (useGetPresignedUrl as jest.Mock).mockReturnValue({
        mutateAsync: mockGetPresignedUrl,
      });

      renderWrapper(
        <AddSourcesModal
          isModalOpen={true}
          closeModalHandler={closeModalHandler}
          documentSourceCount={0}
          setUploadingDocuments={setUploadingDocuments}
          onDocumentsUploaded={onDocumentsUploaded}
          onUploadStart={onUploadStart}
        />
      );

      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      const input = screen.getByTestId('file-input') as HTMLInputElement;

      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(notifications.show).toHaveBeenCalledWith(expect.objectContaining({
          id: expect.stringContaining('upload-documents-failed-'),
          title: 'Upload Failed',
          message: expect.stringContaining('Network error'),
        }));
      });
    });

    it('uploads multiple files', async () => {
      const mockGetPresignedUrl = jest.fn().mockResolvedValue({
        presignedUrl: 'https://test-url.com',
        fileKey: 'test-key',
      });
      const mockProcessDocument = jest.fn()
        .mockResolvedValueOnce({ documentId: 'doc-1' })
        .mockResolvedValueOnce({ documentId: 'doc-2' });

      (useGetPresignedUrl as jest.Mock).mockReturnValue({
        mutateAsync: mockGetPresignedUrl,
      });

      (useProcessDocument as jest.Mock).mockReturnValue({
        mutateAsync: mockProcessDocument,
      });

      renderWrapper(
        <AddSourcesModal
          isModalOpen={true}
          closeModalHandler={closeModalHandler}
          documentSourceCount={0}
          setUploadingDocuments={setUploadingDocuments}
          onDocumentsUploaded={onDocumentsUploaded}
          onUploadStart={onUploadStart}
        />
      );

      const file1 = new File(['content1'], 'test1.pdf', { type: 'application/pdf' });
      const file2 = new File(['content2'], 'test2.pdf', { type: 'application/pdf' });
      const input = screen.getByTestId('file-input') as HTMLInputElement;

      fireEvent.change(input, { target: { files: [file1, file2] } });

      await waitFor(() => {
        expect(mockGetPresignedUrl).toHaveBeenCalledTimes(2);
      });
    });

    it('shows "Duplicate Detected" notification for duplicate files that are already completed', async () => {
      const existingDocument = {
        id: 'existing-doc-123',
        filename: 'duplicate.pdf',
        userId: 'user-1',
        uploadStatus: DocumentUploadStatus.Completed,
        createdAt: new Date(),
      };

      (useGetDocuments as jest.Mock).mockReturnValue({
        data: {
          documents: [existingDocument],
        },
        isPending: false,
      });

      renderWrapper(
        <AddSourcesModal
          isModalOpen={true}
          closeModalHandler={closeModalHandler}
          documentSourceCount={0}
          setUploadingDocuments={setUploadingDocuments}
          onDocumentsUploaded={onDocumentsUploaded}
          onUploadStart={onUploadStart}
        />
      );

      const file = new File(['content'], 'duplicate.pdf', { type: 'application/pdf' });
      const input = screen.getByTestId('file-input') as HTMLInputElement;

      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(onDocumentsUploaded).toHaveBeenCalledWith(['existing-doc-123']);
        expect(notifications.show).toHaveBeenCalledWith(expect.objectContaining({
          id: 'upload-documents-success',
          title: 'Duplicate Detected',
          message: 'Detected existing file: "duplicate.pdf"',
        }));
      });
    });

    it('shows correct plural message for multiple duplicate files', async () => {
      const existingDocuments = [
        {
          id: 'existing-doc-1',
          filename: 'duplicate1.pdf',
          userId: 'user-1',
          uploadStatus: DocumentUploadStatus.Completed,
          createdAt: new Date(),
        },
        {
          id: 'existing-doc-2',
          filename: 'duplicate2.pdf',
          userId: 'user-1',
          uploadStatus: DocumentUploadStatus.Completed,
          createdAt: new Date(),
        },
      ];

      (useGetDocuments as jest.Mock).mockReturnValue({
        data: {
          documents: existingDocuments,
        },
        isPending: false,
      });

      renderWrapper(
        <AddSourcesModal
          isModalOpen={true}
          closeModalHandler={closeModalHandler}
          documentSourceCount={0}
          setUploadingDocuments={setUploadingDocuments}
          onDocumentsUploaded={onDocumentsUploaded}
          onUploadStart={onUploadStart}
        />
      );

      const file1 = new File(['content1'], 'duplicate1.pdf', { type: 'application/pdf' });
      const file2 = new File(['content2'], 'duplicate2.pdf', { type: 'application/pdf' });
      const input = screen.getByTestId('file-input') as HTMLInputElement;

      fireEvent.change(input, { target: { files: [file1, file2] } });

      await waitFor(() => {
        expect(onDocumentsUploaded).toHaveBeenCalledWith(['existing-doc-1', 'existing-doc-2']);
        expect(notifications.show).toHaveBeenCalledWith(expect.objectContaining({
          id: 'upload-documents-success',
          title: 'Duplicates Detected',
          message: 'Detected existing files: "duplicate1.pdf", "duplicate2.pdf"',
        }));
      });
    });
  });
});
