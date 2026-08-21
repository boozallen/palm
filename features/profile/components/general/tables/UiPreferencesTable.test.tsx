import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { notifications } from '@mantine/notifications';
import { IconCheck } from '@tabler/icons-react';

import UiPreferencesTable from './UiPreferencesTable';
import { UiPreference } from '@/types/ui-preferences';

jest.mock('@mantine/notifications');

const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('UiPreferencesTable', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
  });

  it('renders the table with UI preferences header', () => {
    render(<UiPreferencesTable />);

    expect(screen.getByText('UI Preferences')).toBeInTheDocument();
    expect(screen.getByTestId('ui-preferences-table')).toBeInTheDocument();
  });

  it('renders all preference configurations', () => {
    render(<UiPreferencesTable />);

    expect(screen.getByText('Disable Possible PII Warning')).toBeInTheDocument();
    expect(screen.getByText('Disable Regenerate Response Warning')).toBeInTheDocument();
    expect(screen.getByText('Stops warnings from appearing when potentially sensitive information is detected in your prompt submissions')).toBeInTheDocument();
    expect(screen.getByText('Stops confirmation dialog from appearing when regenerating AI responses in chat')).toBeInTheDocument();
  });

  it('shows preferences as disabled when localStorage values are not set', () => {
    render(<UiPreferencesTable />);

    const resetButtons = screen.getAllByRole('button', { name: 'Reset' });
    resetButtons.forEach(button => {
      expect(button).toBeDisabled();
    });
  });

  it('shows preferences as enabled when localStorage values are set to true', () => {
    localStorageMock.getItem
      .mockReturnValueOnce('true')
      .mockReturnValueOnce('true')
      .mockReturnValueOnce('true')
      .mockReturnValueOnce('true')
      .mockReturnValueOnce('true')
      .mockReturnValueOnce('table')
      .mockReturnValueOnce('table')
      .mockReturnValueOnce('true');

    render(<UiPreferencesTable />);

    const resetButtons = screen.getAllByRole('button', { name: 'Reset' });
    resetButtons.forEach(button => {
      expect(button).not.toBeDisabled();
    });
  });

  it('resets cookie setting when reset button is clicked', async () => {
    localStorageMock.getItem
      .mockReturnValueOnce('true')
      .mockReturnValueOnce('false')
      .mockReturnValueOnce('false')
      .mockReturnValueOnce('false')
      .mockReturnValueOnce('false')
      .mockReturnValueOnce('card')
      .mockReturnValueOnce('card');

    render(<UiPreferencesTable />);

    const resetButtons = screen.getAllByRole('button', { name: 'Reset' });
    const enabledResetButton = resetButtons.find(button => !button.hasAttribute('disabled'));

    if (enabledResetButton) {
      fireEvent.click(enabledResetButton);

      expect(localStorageMock.removeItem).toHaveBeenCalledWith(UiPreference.SUPPRESS_PII_WARNING);

      await waitFor(() => {
        expect(notifications.show).toHaveBeenCalledWith({
          title: 'Setting Updated',
          message: 'The "Disable Possible PII Warning" setting has been successfully reset.',
          icon: <IconCheck />,
          autoClose: true,
          variant: 'successful_operation',
        });
      });
    }
  });

  it('updates button state after reset', async () => {
    localStorageMock.getItem
      .mockReturnValueOnce('true')
      .mockReturnValueOnce('false')
      .mockReturnValueOnce('false')
      .mockReturnValueOnce('false')
      .mockReturnValueOnce('false')
      .mockReturnValueOnce('card')
      .mockReturnValueOnce('card');

    render(<UiPreferencesTable />);

    const resetButtons = screen.getAllByRole('button', { name: 'Reset' });
    const enabledResetButton = resetButtons.find(button => !button.hasAttribute('disabled'));

    if (enabledResetButton) {
      fireEvent.click(enabledResetButton);

      await waitFor(() => {
        expect(enabledResetButton).toBeDisabled();
      });
    }
  });
});
