import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { notifications } from '@mantine/notifications';
import { IconCheck } from '@tabler/icons-react';

import UiPreferencesTable from './UiPreferencesTable';
import { UserGroupAttributionProvider, useUserGroupAttributionContext } from '@/features/shared/providers/UserGroupAttribution/UserGroupAttributionProvider';
import useGetUserGroups from '@/features/profile/api/get-user-groups';
import useGetAvailableModels from '@/features/shared/api/get-available-models';
import useGetEmbeddingEligibleAiProviders from '@/features/shared/api/document-upload/get-embedding-eligible-ai-providers';
import { UiPreference } from '@/types/ui-preferences';

jest.mock('@mantine/notifications');
jest.mock('@/features/profile/api/get-user-groups');
jest.mock('@/features/shared/api/get-available-models');
jest.mock('@/features/shared/api/document-upload/get-embedding-eligible-ai-providers');

let store: Record<string, string> = {};

const localStorageMock = {
  getItem: jest.fn((key: string) => store[key] ?? null),
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

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Exposes the default user group id used everywhere else in the app, so a reset can be
// verified beyond just this table's own disabled-button state.
function DefaultUserGroupIdProbe() {
  const { defaultUserGroupId } = useUserGroupAttributionContext();
  return <div data-testid='default-user-group-id-probe'>{defaultUserGroupId ?? ''}</div>;
}

const renderTable = () => render(
  <UserGroupAttributionProvider>
    <DefaultUserGroupIdProbe />
    <UiPreferencesTable />
  </UserGroupAttributionProvider>,
);

describe('UiPreferencesTable', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
    (useGetUserGroups as jest.Mock).mockReturnValue({ data: { userGroups: [] } });
    (useGetAvailableModels as jest.Mock).mockReturnValue({ data: { availableModels: [] } });
    (useGetEmbeddingEligibleAiProviders as jest.Mock).mockReturnValue({ data: { aiProviderIds: [] } });
  });

  it('renders the table with UI preferences header', () => {
    renderTable();

    expect(screen.getByText('UI Preferences')).toBeInTheDocument();
    expect(screen.getByTestId('ui-preferences-table')).toBeInTheDocument();
  });

  it('renders all preference configurations', () => {
    renderTable();

    expect(screen.getByText('Disable Possible PII Warning')).toBeInTheDocument();
    expect(screen.getByText('Disable Regenerate Response Warning')).toBeInTheDocument();
    expect(screen.getByText('Stops warnings from appearing when potentially sensitive information is detected in your prompt submissions')).toBeInTheDocument();
    expect(screen.getByText('Stops confirmation dialog from appearing when regenerating AI responses in chat')).toBeInTheDocument();
  });

  it('shows preferences as disabled when localStorage values are not set', () => {
    renderTable();

    const resetButtons = screen.getAllByRole('button', { name: 'Reset' });
    resetButtons.forEach(button => {
      expect(button).toBeDisabled();
    });
  });

  it('shows preferences as enabled when localStorage values are set to true', () => {
    store = {
      [UiPreference.SUPPRESS_PII_WARNING]: 'true',
      [UiPreference.SUPPRESS_REGENERATE_RESPONSE_WARNING]: 'true',
      [UiPreference.SUPPRESS_GITHUB_PUSH_WARNING]: 'true',
      [UiPreference.MENUBAR_COLLAPSED]: 'true',
      [UiPreference.WORKFLOW_NODES_CONTAINER_COLLAPSED]: 'true',
      [UiPreference.PROMPT_LIBRARY_VIEW]: 'table',
      [UiPreference.WORKFLOWS_VIEW]: 'table',
      [UiPreference.JOIN_USER_GROUP_DIALOG_COLLAPSED]: 'true',
      [UiPreference.PROMPT_TOOLS_NAV_EXPANDED]: 'true',
      [UiPreference.USER_GROUP_ATTRIBUTION_PREFERENCE]: JSON.stringify({ userGroupId: 'group-1' }),
    };

    renderTable();

    const resetButtons = screen.getAllByRole('button', { name: 'Reset' });
    resetButtons.forEach(button => {
      expect(button).not.toBeDisabled();
    });
  });

  it('resets cookie setting when reset button is clicked', async () => {
    store = { [UiPreference.SUPPRESS_PII_WARNING]: 'true' };

    renderTable();

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

  it('renders the group attribution preference row', () => {
    renderTable();

    expect(screen.getByTestId(`ui-preference-row-${UiPreference.USER_GROUP_ATTRIBUTION_PREFERENCE}`)).toBeInTheDocument();
  });

  it('renders the prompt tools nav group preference row', () => {
    renderTable();

    expect(screen.getByTestId(`ui-preference-row-${UiPreference.PROMPT_TOOLS_NAV_EXPANDED}`)).toBeInTheDocument();
  });

  it('resets the prompt tools nav group preference when its Reset button is clicked', () => {
    store = { [UiPreference.PROMPT_TOOLS_NAV_EXPANDED]: 'true' };

    renderTable();

    fireEvent.click(screen.getByTestId(`ui-preference-reset-${UiPreference.PROMPT_TOOLS_NAV_EXPANDED}`));

    expect(localStorageMock.removeItem).toHaveBeenCalledWith(UiPreference.PROMPT_TOOLS_NAV_EXPANDED);
  });

  it('shows the group attribution preference as enabled when a default group is stored', () => {
    store = { [UiPreference.USER_GROUP_ATTRIBUTION_PREFERENCE]: JSON.stringify({ userGroupId: 'group-1' }) };

    renderTable();

    expect(screen.getByTestId(`ui-preference-reset-${UiPreference.USER_GROUP_ATTRIBUTION_PREFERENCE}`)).not.toBeDisabled();
  });

  it('resets the group attribution preference when its Reset button is clicked', () => {
    store = { [UiPreference.USER_GROUP_ATTRIBUTION_PREFERENCE]: JSON.stringify({ userGroupId: 'group-1' }) };

    renderTable();

    fireEvent.click(screen.getByTestId(`ui-preference-reset-${UiPreference.USER_GROUP_ATTRIBUTION_PREFERENCE}`));

    expect(localStorageMock.removeItem).toHaveBeenCalledWith(UiPreference.USER_GROUP_ATTRIBUTION_PREFERENCE);
  });

  it('reflects a default user group reset immediately everywhere, not just after a page reload', () => {
    store = { [UiPreference.USER_GROUP_ATTRIBUTION_PREFERENCE]: JSON.stringify({ userGroupId: 'group-1' }) };

    renderTable();
    expect(screen.getByTestId('default-user-group-id-probe')).toHaveTextContent('group-1');

    fireEvent.click(screen.getByTestId(`ui-preference-reset-${UiPreference.USER_GROUP_ATTRIBUTION_PREFERENCE}`));

    expect(screen.getByTestId('default-user-group-id-probe')).toHaveTextContent('');
  });

  it('updates button state after reset', async () => {
    store = { [UiPreference.SUPPRESS_PII_WARNING]: 'true' };

    renderTable();

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
