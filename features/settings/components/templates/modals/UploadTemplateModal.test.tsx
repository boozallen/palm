import { render, screen } from '@testing-library/react';

import useCreateTemplate from '@/features/settings/api/templates/create-template';
import useGetTemplatePresignedUrl from '@/features/settings/api/templates/get-template-presigned-url';
import UploadTemplateModal from './UploadTemplateModal';

jest.mock('@mantine/notifications');
jest.mock('@/features/settings/api/templates/create-template');
jest.mock('@/features/settings/api/templates/get-template-presigned-url');

describe('UploadTemplateModal', () => {
  const closeModalHandler = jest.fn();
  const mutateAsync = jest.fn();

  const mockProps = {
    modalOpened: true,
    closeModalHandler,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (useCreateTemplate as jest.Mock).mockReturnValue({ mutateAsync });
    (useGetTemplatePresignedUrl as jest.Mock).mockReturnValue({ mutateAsync: jest.fn() });
  });

  it('renders modal when opened', () => {
    render(<UploadTemplateModal {...mockProps} />);

    expect(screen.getByText('Upload Template')).toBeInTheDocument();
    expect(screen.getByTestId('template-file-input')).toBeInTheDocument();
  });

  it('does not render modal when closed', () => {
    render(<UploadTemplateModal {...mockProps} modalOpened={false} />);

    expect(screen.queryByText('Upload Template')).not.toBeInTheDocument();
  });

  it('calls closeModalHandler on cancel', () => {
    render(<UploadTemplateModal {...mockProps} />);

    screen.getByText('Cancel').click();

    expect(closeModalHandler).toHaveBeenCalled();
  });

  it('renders upload button', () => {
    render(<UploadTemplateModal {...mockProps} />);

    expect(screen.getByText('Upload')).toBeInTheDocument();
  });
});
