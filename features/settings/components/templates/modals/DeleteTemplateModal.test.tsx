import { act, render, screen } from '@testing-library/react';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';

import useDeleteTemplate from '@/features/settings/api/templates/delete-template';
import DeleteTemplateModal from './DeleteTemplateModal';

jest.mock('@mantine/notifications');
jest.mock('@/features/settings/api/templates/delete-template');

describe('DeleteTemplateModal', () => {
  const closeModalHandler = jest.fn();
  const mutateAsync = jest.fn();

  const mockProps = {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Sample Template',
    modalOpened: true,
    closeModalHandler,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (useDeleteTemplate as jest.Mock).mockReturnValue({
      mutateAsync,
      isPending: false,
      error: null,
    });
  });

  it('renders modal with template name when opened', () => {
    render(<DeleteTemplateModal {...mockProps} />);

    expect(screen.getByText('Delete Template')).toBeInTheDocument();
    expect(screen.getByText(mockProps.name)).toBeInTheDocument();
  });

  it('does not render modal when closed', () => {
    render(<DeleteTemplateModal {...mockProps} modalOpened={false} />);

    expect(screen.queryByText('Delete Template')).not.toBeInTheDocument();
  });

  it('calls mutateAsync with templateId on confirm', () => {
    render(<DeleteTemplateModal {...mockProps} />);

    screen.getByText('Delete').click();

    expect(mutateAsync).toHaveBeenCalledWith({ templateId: mockProps.id });
  });

  it('calls closeModalHandler on cancel', () => {
    render(<DeleteTemplateModal {...mockProps} />);

    screen.getByText('Cancel').click();

    expect(closeModalHandler).toHaveBeenCalled();
  });

  it('shows error notification if deleteTemplate throws', async () => {
    const error = new Error('Failed to delete template');

    (useDeleteTemplate as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn().mockRejectedValue(error),
      isPending: false,
      error,
    });

    render(<DeleteTemplateModal {...mockProps} />);

    await act(async () => {
      screen.getByText('Delete').click();
    });

    expect(notifications.show).toHaveBeenCalledWith({
      id: 'delete-template-error',
      title: 'Failed to Delete Template',
      message: error.message,
      autoClose: false,
      withCloseButton: true,
      icon: <IconX />,
      variant: 'failed_operation',
    });
  });
});
