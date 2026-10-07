import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { notifications } from '@mantine/notifications';
import MemoryConfigRow from './MemoryConfigRow';
import { useUpdateSystemConfig } from '@/features/settings/api/system-configurations/update-system-config';
import { SystemConfigFields } from '@/features/shared/types';

jest.mock('@/features/settings/api/system-configurations/update-system-config');
jest.mock('@mantine/notifications');

describe('MemoryConfigRow', () => {
  const mockUpdateSystemConfig = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useUpdateSystemConfig as jest.Mock).mockReturnValue({
      mutateAsync: mockUpdateSystemConfig,
      error: null,
    });

    render(
      <table>
        <tbody>
          <MemoryConfigRow checked={true} />
        </tbody>
      </table>
    );
  });

  it('renders correctly with given props', () => {
    expect(screen.getByTestId('memory-config-label')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeChecked();
    expect(screen.getByTestId('memory-info-icon')).toBeInTheDocument();
  });

  it('displays a detailed popover on hover', async () => {
    const infoIcon = screen.getByTestId('memory-info-icon');
    await userEvent.hover(infoIcon);

    await waitFor(() => {
      expect(
        screen.getByText(/plus any artifacts they produced along the way/)
      ).toBeInTheDocument();
    });
  });

  it('calls updateSystemConfig when checkbox is toggled', async () => {
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(mockUpdateSystemConfig).toHaveBeenCalledWith({
        configField: SystemConfigFields.MemoryEnabled,
        configValue: false,
      });
    });
  });

  it('shows error notification when update fails', async () => {
    const mockError = new Error('Update failed');
    (useUpdateSystemConfig as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn().mockRejectedValue(mockError),
      error: mockError,
    });

    render(
      <table>
        <tbody>
          <MemoryConfigRow checked={true} />
        </tbody>
      </table>
    );

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[checkboxes.length - 1]);

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Failed to Update',
        message: 'Update failed',
        variant: 'failed_operation',
      }));
    });
  });
});
