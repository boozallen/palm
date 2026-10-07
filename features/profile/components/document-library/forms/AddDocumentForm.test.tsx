import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { notifications } from '@mantine/notifications';

import AddDocumentForm, { Value } from './AddDocumentForm';
import { DOCUMENT_UPLOAD_INCOMPATIBLE_FILE_TYPE_ERROR, MAX_FILE_SIZE, MAX_FILE_SIZE_MB } from '@/features/shared/types/document';
import useGetPresignedUrl from '@/features/shared/api/document-upload/get-presigned-url';
import useProcessDocument from '@/features/shared/api/document-upload/process-document';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import { useEmbeddingUserGroupAttribution } from '@/features/shared/hooks/userGroupAttribution/useEmbeddingUserGroupAttribution';

jest.mock('@/features/shared/api/document-upload/get-presigned-url');
jest.mock('@/features/shared/api/document-upload/process-document');
jest.mock('@mantine/notifications');
jest.mock('@/features/shared/api/get-system-config');
jest.mock('@/features/shared/hooks/userGroupAttribution/useEmbeddingUserGroupAttribution', () => ({
  useEmbeddingUserGroupAttribution: jest.fn(),
}));
jest.mock('@/libs', () => ({
  trpc: {
    useUtils: () => ({
      shared: {
        getDocuments: {
          invalidate: jest.fn(),
        },
      },
    }),
  },
}));

describe('Value (AddDocumentForm)', () => {
  const file = new File([''], 'file.txt', { type: 'text/plain' });

  it('renders the file name', () => {
    render(<Value file={file} />);
    expect(screen.getByText(file.name)).toBeInTheDocument();
  });

  it('renders an icon', () => {
    render(<Value file={file} />);
    const img = document.querySelector('svg');
    expect(img).toBeInTheDocument();
  });
});

describe('AddDocumentForm', () => {
  const setFormCompleted = jest.fn();
  const mockGetPresignedUrl = jest.fn();
  const mockProcessDocument = jest.fn();
  const mockDocumentUploadProviderId = 'c54a871d-bc7c-453e-8e39-5c4ac60cc2c0';

  // Mock XMLHttpRequest
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
    jest.clearAllMocks();

    // Mock XMLHttpRequest constructor
    (global as any).XMLHttpRequest = jest.fn(() => mockXHRInstance);

    // Setup default behavior for addEventListener to trigger 'load' event on send
    mockXHRInstance.addEventListener.mockImplementation((event, handler) => {
      if (event === 'load') {
        // Store the load handler to call it when send() is called
        mockXHRInstance.send.mockImplementation(() => {
          handler();
        });
      }
    });

    (useGetPresignedUrl as jest.Mock).mockReturnValue({
      mutateAsync: mockGetPresignedUrl,
      isPending: false,
      error: null,
    });

    (useProcessDocument as jest.Mock).mockReturnValue({
      mutateAsync: mockProcessDocument,
      isPending: false,
      error: null,
    });

    (useGetSystemConfig as jest.Mock).mockReturnValue({
      data: {
        documentLibraryDocumentUploadProviderId: mockDocumentUploadProviderId,
      },
    });

    // Nothing to attribute by default, matching every pre-existing test's expectations.
    (useEmbeddingUserGroupAttribution as jest.Mock).mockReturnValue({
      gate: jest.fn((onSubmit: (userGroupId: string | undefined) => void | Promise<void>) => onSubmit(undefined)),
      pendingDecision: null,
      idleGroups: [],
      defaultUserGroupId: undefined,
      setDefaultUserGroupId: jest.fn(),
      onSelect: jest.fn(),
      onDismiss: jest.fn(),
    });

    // Mock successful responses
    mockGetPresignedUrl.mockResolvedValue({
      presignedUrl: 'https://mock-s3-url.com',
      fileKey: 'mock-file-key',
    });

    mockProcessDocument.mockResolvedValue({ success: true });
  });

  afterAll(() => {
    global.XMLHttpRequest = originalXMLHttpRequest;
  });

  it('renders the form', () => {
    render(<AddDocumentForm setFormCompleted={setFormCompleted} />);

    expect(screen.getByLabelText('File Upload')).toBeInTheDocument();
    expect(screen.getByText('Select files')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Upload')).toBeInTheDocument();
  });

  it('closes the form upon cancel', () => {
    render(<AddDocumentForm setFormCompleted={setFormCompleted} />);

    const cancelButton = screen.getByText('Cancel');

    act(() => {
      cancelButton.click();
    });

    expect(setFormCompleted).toHaveBeenCalledWith(true);
  });

  it('shows validation error upon empty form submission', () => {
    render(<AddDocumentForm setFormCompleted={setFormCompleted} />);
    const uploadButton = screen.getByText('Upload');

    act(() => {
      uploadButton.click();
    });

    const errorMessage = screen.getByText('At least one file is required');

    expect(setFormCompleted).not.toHaveBeenCalled();
    expect(errorMessage).toBeInTheDocument();
  });

  it('shows validation error for file size', () => {
    render(<AddDocumentForm setFormCompleted={setFormCompleted} />);

    const file = new File(['a'.repeat(MAX_FILE_SIZE + 1)], 'file.txt', { type: 'text/plain' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    act(() => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    const uploadButton = screen.getByText('Upload');

    act(() => {
      uploadButton.click();
    });

    const errorMessage = screen.getByText(`Files must be ${MAX_FILE_SIZE_MB} MB or less`);

    expect(setFormCompleted).not.toHaveBeenCalled();
    expect(errorMessage).toBeInTheDocument();
  });

  it('shows validation error for file type', () => {
    render(<AddDocumentForm setFormCompleted={setFormCompleted} />);

    // Use an incompatible file type (not in DOCUMENT_UPLOAD_ACCEPTED_FILE_MIME_TYPES)
    const file = new File([''], 'source.exe', { type: 'application/x-msdownload' });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    act(() => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    const uploadButton = screen.getByText('Upload');

    act(() => {
      uploadButton.click();
    });

    const errorMessage = screen.getByText(DOCUMENT_UPLOAD_INCOMPATIBLE_FILE_TYPE_ERROR);

    expect(setFormCompleted).not.toHaveBeenCalled();
    expect(errorMessage).toBeInTheDocument();
  });

  it('calls upload process with correct parameters', async () => {
    render(<AddDocumentForm setFormCompleted={setFormCompleted} />);

    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    act(() => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    const uploadButton = screen.getByText('Upload');

    await act(async () => {
      uploadButton.click();
    });

    expect(mockGetPresignedUrl).toHaveBeenCalledWith({
      fileName: 'test.txt',
      contentType: 'text/plain',
      documentUploadProviderId: mockDocumentUploadProviderId,
    });

    // Verify XMLHttpRequest was used for upload
    expect(global.XMLHttpRequest).toHaveBeenCalled();
    expect(mockXHRInstance.open).toHaveBeenCalledWith('PUT', 'https://mock-s3-url.com');
    expect(mockXHRInstance.setRequestHeader).toHaveBeenCalledWith('Content-Type', 'text/plain');
    expect(mockXHRInstance.send).toHaveBeenCalledWith(file);

    expect(mockProcessDocument).toHaveBeenCalledWith({
      fileName: 'test.txt',
      contentType: 'text/plain',
      fileSize: 12,
      fileKey: 'mock-file-key',
      documentUploadProviderId: mockDocumentUploadProviderId,
    });
  });

  it('displays error message from upload api failure', async () => {
    const mockError = new Error('This is a mock error used for testing');
    mockGetPresignedUrl.mockRejectedValue(mockError);

    render(<AddDocumentForm setFormCompleted={setFormCompleted} />);

    const file = new File(['test content'], 'file.txt', { type: 'text/plain' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    act(() => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    const uploadButton = screen.getByText('Upload');

    await act(async () => {
      uploadButton.click();
    });

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith(expect.objectContaining({
        message: mockError.message,
      }));
    });
  });

  it('attributes every file in the batch to the resolved group', async () => {
    (useEmbeddingUserGroupAttribution as jest.Mock).mockReturnValue({
      gate: jest.fn((onSubmit: (userGroupId: string | undefined) => void | Promise<void>) => onSubmit('group-1')),
      pendingDecision: null,
      idleGroups: [],
      defaultUserGroupId: undefined,
      setDefaultUserGroupId: jest.fn(),
      onSelect: jest.fn(),
      onDismiss: jest.fn(),
    });

    render(<AddDocumentForm setFormCompleted={setFormCompleted} />);

    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    act(() => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    const uploadButton = screen.getByText('Upload');

    await act(async () => {
      uploadButton.click();
    });

    expect(mockProcessDocument).toHaveBeenCalledWith(
      expect.objectContaining({ userGroupId: 'group-1' }),
    );
  });
});
