import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdvancedKbSettingsTable from './AdvancedKbSettingsTable';
import useGetUserAdvancedKbSettings from '@/features/shared/api/get-user-advanced-kb-settings';
import useUpdateUserKbSettingsMinScore from '@/features/profile/api/update-user-kb-settings-min-score';
import useUpdateUserKbSettingsMaxResults from '@/features/profile/api/update-user-kb-settings-max-results';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';

jest.mock('@/features/shared/api/get-user-advanced-kb-settings');
jest.mock('@/features/profile/api/update-user-kb-settings-min-score');
jest.mock('@/features/profile/api/update-user-kb-settings-max-results');
jest.mock('@mantine/notifications');

describe('AdvancedKbSettingsTable', () => {
  const mutateAsync = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useGetUserAdvancedKbSettings as jest.Mock).mockReturnValue({
      data: {
        knowledgeBasesMinScore: null,
        knowledgeBasesMaxResults: null,
      },
      isPending: false,
    });

    (useUpdateUserKbSettingsMinScore as jest.Mock).mockReturnValue({
      mutateAsync,
      error: null,
    });

    (useUpdateUserKbSettingsMaxResults as jest.Mock).mockReturnValue({
      mutateAsync,
      error: null,
    });
  });

  it('renders advanced kb settings table', async () => {
    render(<AdvancedKbSettingsTable />);
    await waitFor(() => {
      expect(
        screen.getByTestId('advanced-kb-settings-table')
      ).toBeInTheDocument();
    });
  });

  it('renders the table header correctly', async () => {
    render(<AdvancedKbSettingsTable />);
    await waitFor(() => {
      expect(screen.getByText('Advanced Settings')).toBeInTheDocument();
    });
  });

  it('renders Min Score and Max Results rows', async () => {
    render(<AdvancedKbSettingsTable />);
    await waitFor(() => {
      expect(screen.getByText('Min Score')).toBeInTheDocument();
      expect(screen.getByText('Max Results')).toBeInTheDocument();
    });
  });

  it('displays the correct default values if no values exist in the database', async () => {
    render(<AdvancedKbSettingsTable />);

    await waitFor(() => {
      const minScoreInput = screen.getByLabelText('Min Score');
      const maxResultsInput = screen.getByLabelText('Max Results');
      expect(minScoreInput).toHaveValue('');
      expect(maxResultsInput).toHaveValue('');
    });
  });

  it('loads initial values from database', async () => {
    (useGetUserAdvancedKbSettings as jest.Mock).mockReturnValue({
      data: {
        knowledgeBasesMinScore: 0.5,
        knowledgeBasesMaxResults: 10,
      },
      isPending: false,
    });

    render(<AdvancedKbSettingsTable />);

    await waitFor(() => {
      expect(screen.getByLabelText('Min Score')).toHaveValue('0.50');
      expect(screen.getByLabelText('Max Results')).toHaveValue('10');
    });
  });

  it('disables Save button when no changes are made', async () => {
    render(<AdvancedKbSettingsTable />);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Save' })[0]).toBeDisabled();
      expect(screen.getAllByRole('button', { name: 'Save' })[1]).toBeDisabled();
    });
  });

  it('enables Reset button when values exist in the database', async () => {
    (useGetUserAdvancedKbSettings as jest.Mock).mockReturnValue({
      data: {
        knowledgeBasesMinScore: 0.5,
        knowledgeBasesMaxResults: 10,
      },
      isPending: false,
    });

    render(<AdvancedKbSettingsTable />);

    await waitFor(() => {
      expect(
        screen.getAllByRole('button', { name: 'Reset' })[0]
      ).not.toBeDisabled();
      expect(
        screen.getAllByRole('button', { name: 'Reset' })[1]
      ).not.toBeDisabled();
    });
  });

  it('enables Save button when min score is changed and valid', async () => {
    render(<AdvancedKbSettingsTable />);

    const minScoreInput = screen.getByLabelText('Min Score');
    fireEvent.change(minScoreInput, { target: { value: '0.5' } });

    await waitFor(() => {
      expect(
        screen.getAllByRole('button', { name: 'Save' })[0]
      ).not.toBeDisabled();
    });
  });

  it('enables Save button when max results is changed and valid', async () => {
    render(<AdvancedKbSettingsTable />);

    const maxResultsInput = screen.getByLabelText('Max Results');
    fireEvent.change(maxResultsInput, { target: { value: '19' } });

    await waitFor(() => {
      expect(
        screen.getAllByRole('button', { name: 'Save' })[1]
      ).not.toBeDisabled();
    });
  });

  it('correctly sets the value in the min score field after a change is made', async () => {
    render(<AdvancedKbSettingsTable />);

    const minScoreInput = screen.getByLabelText('Min Score');
    fireEvent.change(minScoreInput, { target: { value: '0.5' } });

    await waitFor(() => {
      expect(minScoreInput).toHaveValue('0.50');
    });
  });

  it('correctly sets the value in the max results field after a change is made', async () => {
    render(<AdvancedKbSettingsTable />);

    const maxResultsInput = screen.getByLabelText('Max Results');
    fireEvent.change(maxResultsInput, { target: { value: '19' } });

    await waitFor(() => {
      expect(maxResultsInput).toHaveValue('19');
    });
  });

  it('resets minScore on Reset button click', async () => {
    (useGetUserAdvancedKbSettings as jest.Mock).mockReturnValue({
      data: {
        knowledgeBasesMinScore: 0.4,
        knowledgeBasesMaxResults: null,
      },
      isPending: false,
    });

    render(<AdvancedKbSettingsTable />);

    mutateAsync.mockResolvedValueOnce({ knowledgeBasesMinScore: null });

    const minScoreInput = await screen.findByLabelText('Min Score');

    expect(minScoreInput).toHaveValue('0.40');

    const resetButtons = screen.getAllByRole('button', { name: 'Reset' });
    fireEvent.click(resetButtons[0]);

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        knowledgeBasesMinScore: null,
      });
      expect(minScoreInput).toHaveValue('');
    });
  });

  it('resets maxResults on Reset button click', async () => {
    (useGetUserAdvancedKbSettings as jest.Mock).mockReturnValue({
      data: {
        knowledgeBasesMinScore: null,
        knowledgeBasesMaxResults: 19,
      },
      isPending: false,
    });

    render(<AdvancedKbSettingsTable />);

    mutateAsync.mockResolvedValueOnce({ knowledgeBasesMaxResults: null });

    const maxResultsInput = await screen.findByLabelText('Max Results');

    expect(maxResultsInput).toHaveValue('19');

    const resetButtons = screen.getAllByRole('button', { name: 'Reset' });
    fireEvent.click(resetButtons[1]);

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        knowledgeBasesMaxResults: null,
      });
      expect(maxResultsInput).toHaveValue('');
    });
  });

  it('calls mutateAsync when saving new min score', async () => {
    render(<AdvancedKbSettingsTable />);

    const minScoreInput = screen.getByLabelText('Min Score');
    fireEvent.change(minScoreInput, { target: { value: '0.5' } });

    await waitFor(() => {
      const saveButton = screen.getAllByRole('button', { name: 'Save' })[0];
      fireEvent.click(saveButton);
    });

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        knowledgeBasesMinScore: 0.5,
      });
    });
  });

  it('calls mutateAsync when saving new maxResults', async () => {
    render(<AdvancedKbSettingsTable />);

    const maxResultsInput = screen.getByLabelText('Max Results');
    fireEvent.change(maxResultsInput, { target: { value: '19' } });

    await waitFor(() => {
      const saveButton = screen.getAllByRole('button', { name: 'Save' })[1];
      fireEvent.click(saveButton);
    });

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        knowledgeBasesMaxResults: 19,
      });
    });
  });

  it('shows error notification on min score save failure', async () => {
    const error = new Error('Failed to update min score');
    mutateAsync.mockRejectedValue(error);

    render(<AdvancedKbSettingsTable />);

    const minScoreInput = screen.getByLabelText('Min Score');
    fireEvent.change(minScoreInput, { target: { value: '0.5' } });

    await waitFor(() => {
      const saveButton = screen.getAllByRole('button', { name: 'Save' })[0];
      fireEvent.click(saveButton);
    });

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith({
        id: 'save-user-kb-settings-minScore-failed',
        title: 'Failed to Update',
        message: error.message,
        icon: <IconX />,
        variant: 'failed_operation',
        autoClose: false,
      });
    });
  });

  it('shows error notification on max results save failure', async () => {
    const error = new Error('Failed to update max results');
    mutateAsync.mockRejectedValue(error);

    render(<AdvancedKbSettingsTable />);

    const maxResultsInput = screen.getByLabelText('Max Results');
    fireEvent.change(maxResultsInput, { target: { value: '19' } });

    await waitFor(() => {
      const saveButton = screen.getAllByRole('button', { name: 'Save' })[1];
      fireEvent.click(saveButton);
    });

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith({
        id: 'save-user-kb-settings-maxResults-failed',
        title: 'Failed to Update',
        message: error.message,
        icon: <IconX />,
        variant: 'failed_operation',
        autoClose: false,
      });
    });
  });
});
