import { act, fireEvent, render, screen } from '@testing-library/react';

import AddDocumentForm, { Value } from './AddDocumentForm';

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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the form', () => {
    render(<AddDocumentForm setFormCompleted={setFormCompleted} />);

    expect(screen.getByLabelText('File Upload')).toBeInTheDocument();
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

    const file = new File(['a'.repeat(6 * 1024 * 1024)], 'file.txt', { type: 'text/plain' });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    act(() => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    const uploadButton = screen.getByText('Upload');

    act(() => {
      uploadButton.click();
    });

    const errorMessage = screen.getByText('Files must be 5 MB or less');

    expect(setFormCompleted).not.toHaveBeenCalled();
    expect(errorMessage).toBeInTheDocument();
  });

  it('shows validation error for file type', () => {
    render(<AddDocumentForm setFormCompleted={setFormCompleted} />);

    const file = new File([''], 'image.png', { type: 'image/png' });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    act(() => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    const uploadButton = screen.getByText('Upload');

    act(() => {
      uploadButton.click();
    });

    const errorMessage = screen.getByText('Only .pdf, .docx, and .txt files are accepted');

    expect(setFormCompleted).not.toHaveBeenCalled();
    expect(errorMessage).toBeInTheDocument();
  });
});
