import { render, RenderResult, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { notifications } from '@mantine/notifications';
import FeatureManagementConfigRow from './FeatureManagementConfigRow';
import { useUpdateSystemConfig } from '@/features/settings/api/system-configurations/update-system-config';
import { SystemConfigFields } from '@/features/shared/types';

jest.mock('@/features/settings/api/system-configurations/update-system-config');
jest.mock('@mantine/notifications');

describe('FeatureManagementConfigRow', () => {
  const mockUpdateSystemConfig = jest.fn();
  let renderResult: RenderResult;

  beforeEach(() => {
    jest.clearAllMocks();
    (useUpdateSystemConfig as jest.Mock).mockReturnValue({
      mutateAsync: mockUpdateSystemConfig,
      error: null,
    });

    renderResult = render(
      <table>
        <tbody>
          <FeatureManagementConfigRow
            field={SystemConfigFields.FeatureManagementChatSummarization}
            label='Chat Summarization'
            checked={true}
          />
        </tbody>
      </table>
    );
  });

  it('renders correctly with given props', () => {
    expect(screen.getByText('Chat Summarization')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeChecked();
    expect(screen.getByTestId('feature-management-info-icon')).toBeInTheDocument();
  });

  it('renders info icon', () => {
    const infoIcon = screen.getByTestId('feature-management-info-icon');
    expect(infoIcon).toBeInTheDocument();
  });

  it('displays correct tooltip text for Chat Summarization', async () => {
    const infoIcon = screen.getByTestId('feature-management-info-icon');
    await userEvent.hover(infoIcon);

    const tooltipText = 'Creates an AI-generated title based on the contents of a chat conversation';

    await waitFor(() => {
      expect(screen.getByText(tooltipText)).toBeInTheDocument();
    });
  });

  it('displays correct tooltip text for Prompt Generator', async () => {
    renderResult.rerender(
      <table>
        <tbody>
          <FeatureManagementConfigRow
            field={SystemConfigFields.FeatureManagementPromptGenerator}
            label='Prompt Generator'
            checked={true}
          />
        </tbody>
      </table>
    );

    const infoIcon = screen.getByTestId('feature-management-info-icon');
    await userEvent.hover(infoIcon);

    const tooltipText = 'The Prompt Generator section of the application';

    await waitFor(() => {
      expect(screen.getByText(tooltipText)).toBeInTheDocument();
    });
  });

  it('displays correct tooltip text for Prompt Tag Suggestions', async () => {
    renderResult.rerender(
      <table>
        <tbody>
          <FeatureManagementConfigRow
            field={SystemConfigFields.FeatureManagementPromptTagSuggestions}
            label='Prompt Tag Suggestions'
            checked={true}
          />
        </tbody>
      </table>
    );

    const infoIcon = screen.getByTestId('feature-management-info-icon');
    await userEvent.hover(infoIcon);

    const tooltipText = 'Creates AI-generated prompt tag suggestions';

    await waitFor(() => {
      expect(screen.getByText(tooltipText)).toBeInTheDocument();
    });
  });

  it('calls updateSystemConfig when checkbox is toggled', async () => {
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(mockUpdateSystemConfig).toHaveBeenCalledWith({
        configField: SystemConfigFields.FeatureManagementChatSummarization,
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

    renderResult.rerender(
      <table>
        <tbody>
          <FeatureManagementConfigRow
            field={SystemConfigFields.FeatureManagementChatSummarization}
            label='Chat Summarization'
            checked={true}
          />
        </tbody>
      </table>
    );

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Failed to Update',
        message: 'Update failed',
        variant: 'failed_operation',
      }));
    });
  });
});
