import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { notifications } from '@mantine/notifications';

import AddDocumentForm, { Value } from './AddDocumentForm';
import { DOCUMENT_UPLOAD_INCOMPATIBLE_FILE_TYPE_ERROR, MAX_FILE_SIZE, MAX_FILE_SIZE_MB } from '@/features/shared/types/document';
import useUploadDocument from '@/features/shared/api/document-upload/upload-document';
import { convertFileToBase64 } from '@/features/shared/utils/fileHelpers';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';

jest.mock('@/features/shared/api/document-upload/upload-document');
jest.mock('@mantine/notifications');
jest.mock('@/features/shared/utils/fileHelpers');
jest.mock('@/features/shared/api/get-system-config');

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
  const createDocument = jest.fn();
  const mockDocumentUploadProviderId = 'c54a871d-bc7c-453e-8e39-5c4ac60cc2c0';

  beforeEach(() => {
    jest.clearAllMocks();
    (useUploadDocument as jest.Mock).mockReturnValue({
      mutateAsync: createDocument,
      isPending: false,
      error: null,
    });

    (useGetSystemConfig as jest.Mock).mockReturnValue({
      data: {
        documentLibraryDocumentUploadProviderId: mockDocumentUploadProviderId,
      },
    });

    (convertFileToBase64 as jest.Mock).mockResolvedValue('base64string');
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

    // Use an incompatible file type (not in DOCUMENT_UPLOAD_ACCEPTED_FILE_TYPES)
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

  it('calls uploadDocument with correct parameters', async () => {
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

    expect(createDocument).toHaveBeenCalledWith({
      file: {
        name: 'test.txt',
        type: 'text/plain',
        size: 12,
        data: 'base64string',
      },
      documentUploadProviderId: mockDocumentUploadProviderId,
    });
  });

  it('displays error message from useUploadDocument api', () => {
    const mockError = new Error('This is a mock error used for testing');
    createDocument.mockRejectedValue(mockError);

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

    waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith(expect.objectContaining({
        message: mockError.message,
      }));
    });
  });
});
