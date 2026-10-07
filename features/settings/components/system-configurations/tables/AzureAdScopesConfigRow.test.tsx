import type { ComponentType, MouseEvent } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconX } from '@tabler/icons-react';

import AzureAdScopesConfigRow from './AzureAdScopesConfigRow';
import { useUpdateSystemConfig } from '@/features/settings/api/system-configurations/update-system-config';
import { SystemConfigFields } from '@/features/shared/types';

jest.mock('@/features/settings/api/system-configurations/update-system-config');
jest.mock('@mantine/notifications', () => ({
  notifications: {
    show: jest.fn(),
  },
}));

// Stub MultiSelect so choosing a scope is a deterministic click, not a portal dropdown.
jest.mock('@mantine/core', () => {
  const { useState } = require('react');
  const actual = jest.requireActual('@mantine/core');

  type ScopeOption = { value: string; label: string };
  type MockMultiSelectProps = {
    'data-testid'?: string;
    data: ScopeOption[];
    value: string[];
    onChange: (value: string[]) => void;
    itemComponent?: ComponentType<{ value: string; label: string }>;
  };

  function MockMultiSelect({
    'data-testid': testId,
    data,
    value,
    onChange,
    itemComponent: Item,
  }: MockMultiSelectProps) {
    const [open, setOpen] = useState(false);
    const options = data.filter((item: ScopeOption) => !value.includes(item.value));

    return (
      <div data-testid={testId} onClick={() => setOpen((current: boolean) => !current)}>
        {value.map((scope: string) => (
          <span key={scope}>{data.find((item: ScopeOption) => item.value === scope)?.label ?? scope}</span>
        ))}
        {open && options.map((item: ScopeOption) => (
          <div
            key={item.value}
            role='option'
            aria-selected={false}
            onClick={(event: MouseEvent) => {
              event.stopPropagation();
              onChange([...value, item.value]);
            }}
          >
            {Item ? <Item value={item.value} label={item.label} /> : item.label}
          </div>
        ))}
      </div>
    );
  }

  return { ...actual, MultiSelect: MockMultiSelect };
});

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

const renderRow = (currentScopes: string[]) =>
  render(
    <table>
      <tbody>
        <AzureAdScopesConfigRow currentScopes={currentScopes} />
      </tbody>
    </table>
  );

describe('AzureAdScopesConfigRow', () => {
  const mockUpdateSystemConfig = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useUpdateSystemConfig as jest.Mock).mockReturnValue({
      mutateAsync: mockUpdateSystemConfig,
      isPending: false,
    });
  });

  it('renders the currently configured scopes', () => {
    renderRow(['openid', 'profile', 'email']);

    expect(screen.getByTestId('azure-ad-scopes-select')).toBeInTheDocument();
    expect(screen.getByText('openid')).toBeInTheDocument();
    expect(screen.getByText('profile')).toBeInTheDocument();
    expect(screen.getByText('email')).toBeInTheDocument();
  });

  it('disables Save until the selection changes', () => {
    renderRow(['openid', 'profile', 'email']);

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('enables Save and submits the new scope list once a scope is added', async () => {
    const user = userEvent.setup();
    mockUpdateSystemConfig.mockResolvedValueOnce({});

    renderRow(['openid', 'profile', 'email']);

    const select = screen.getByTestId('azure-ad-scopes-select');
    await user.click(select);

    const offlineAccessOption = await screen.findByText('offline_access');
    await user.click(offlineAccessOption);

    const saveButton = screen.getByRole('button', { name: 'Save' });
    expect(saveButton).toBeEnabled();

    await user.click(saveButton);

    await waitFor(() => {
      expect(mockUpdateSystemConfig).toHaveBeenCalledWith({
        configField: SystemConfigFields.AzureAdScopes,
        configValue: ['openid', 'profile', 'email', 'offline_access'],
      });
    });
  });

  it('flags required scopes in the scope picker dropdown', async () => {
    const user = userEvent.setup();
    // Already-selected scopes are filtered out of the dropdown, so leave the required
    // scopes unselected here to see how an unselected required scope renders.
    renderRow(['Sites.Read.All']);

    await user.click(screen.getByTestId('azure-ad-scopes-select'));

    const openidOption = (await screen.findByText('openid')).closest('[role="option"]');
    expect(openidOption).toHaveTextContent('Required');

    const offlineAccessOption = screen.getByText('offline_access').closest('[role="option"]');
    expect(offlineAccessOption).not.toHaveTextContent('Required');
  });

  it('shows a success notification after a successful save', async () => {
    const user = userEvent.setup();
    mockUpdateSystemConfig.mockResolvedValueOnce({});

    renderRow(['openid', 'profile', 'email']);

    await user.click(screen.getByTestId('azure-ad-scopes-select'));
    await user.click(await screen.findByText('offline_access'));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Azure AD Scopes Updated',
        icon: <IconCheck />,
        variant: 'successful_operation',
      }));
    });
  });

  it('shows a failure notification with the server error message when the save is rejected', async () => {
    const user = userEvent.setup();
    const errorMessage = 'Azure AD scopes must include the required scopes: profile.';
    mockUpdateSystemConfig.mockRejectedValueOnce(new Error(errorMessage));

    renderRow(['openid', 'profile', 'email']);

    await user.click(screen.getByTestId('azure-ad-scopes-select'));
    await user.click(await screen.findByText('offline_access'));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Failed to Update',
        message: errorMessage,
        icon: <IconX />,
        variant: 'failed_operation',
      }));
    });
  });
});
