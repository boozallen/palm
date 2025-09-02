import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';
import useUpdateUserGroupAiAgents from '@/features/settings/api/user-groups/update-user-group-ai-agents';
import useGetUserGroupAiProviders from '@/features/settings/api/user-groups/get-user-group-ai-providers';
import useGetAiProviders from '@/features/settings/api/ai-providers/get-ai-providers';
import UserGroupAiAgentRow from './UserGroupAiAgentRow';
import { AiAgentType } from '@/features/shared/types';

jest.mock('@/features/settings/api/user-groups/update-user-group-ai-agents');
jest.mock('@/features/settings/api/user-groups/get-user-group-ai-providers');
jest.mock('@/features/settings/api/ai-providers/get-ai-providers');
jest.mock('@mantine/notifications');

const updateUserGroupAiAgents = jest.fn();

type UserGroupAiAgentRowProps = Readonly<{
  aiAgent: {
    id: string;
    label: string;
    type: AiAgentType;
  };
  userGroupId: string;
  isEnabled: boolean;
}>;

const TableBodyWrapper = ({
  children,
}: Readonly<{ children: React.ReactNode }>) => (
  <table>
    <tbody>{children}</tbody>
  </table>
);

const renderComponent = (props: UserGroupAiAgentRowProps) => {
  render(
    <TableBodyWrapper>
      <UserGroupAiAgentRow {...props} />
    </TableBodyWrapper>
  );
};

describe('UserGroupAiAgentRow', () => {
  let mockAiAgent: {
    id: string;
    label: string;
    type: AiAgentType;
  };
  let mockUserGroupId: string;
  let mockIsEnabled: boolean;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAiAgent = {
      id: 'd991cc5c-4710-474e-ad8d-57e8627c4fa7',
      label: 'AI Agent',
      type: AiAgentType.CERTA,
    };
    mockUserGroupId = '3967ca4e-b5d1-47c4-84b3-d2a0fbb43b18';
    mockIsEnabled = false;

    (useUpdateUserGroupAiAgents as jest.Mock).mockReturnValue({
      mutateAsync: updateUserGroupAiAgents,
      isPending: false,
      error: null,
    });

    (useGetUserGroupAiProviders as jest.Mock).mockReturnValue({
      data: {
        userGroupProviders: [],
      },
      isPending: false,
      error: null,
    });

    (useGetAiProviders as jest.Mock).mockReturnValue({
      data: {
        aiProviders: [],
      },
      isPending: false,
      error: null,
    });
  });

  it('renders the AI Agent row as enabled', () => {
    mockIsEnabled = true;
    renderComponent({
      aiAgent: mockAiAgent,
      userGroupId: mockUserGroupId,
      isEnabled: mockIsEnabled,
    });

    const row = screen.getByTestId(`${mockAiAgent.id}-user-group-ai-agent-row`);
    expect(row).toBeInTheDocument();

    const label = screen.getByText(mockAiAgent.label);
    expect(label).toBeInTheDocument();

    const switchComponent = screen.getByRole('switch');
    expect(switchComponent).toBeInTheDocument();
    expect(switchComponent).toBeChecked();
  });

  it('renders the AI Agent row as disabled', () => {
    renderComponent({
      aiAgent: mockAiAgent,
      userGroupId: mockUserGroupId,
      isEnabled: mockIsEnabled,
    });

    const switchComponent = screen.getByRole('switch');
    expect(switchComponent).toBeInTheDocument();
    expect(switchComponent).not.toBeChecked();
  });

  it('calls updateUserGroupAiAgents when toggling a Switch', async () => {
    renderComponent({
      aiAgent: mockAiAgent,
      userGroupId: mockUserGroupId,
      isEnabled: mockIsEnabled,
    });

    const switchComponent = screen.getByRole('switch');
    expect(switchComponent).toBeInTheDocument();
    expect(switchComponent).not.toBeChecked();

    fireEvent.click(switchComponent);

    await waitFor(() => {
      expect(updateUserGroupAiAgents).toHaveBeenCalledWith({
        userGroupId: mockUserGroupId,
        aiAgentId: mockAiAgent.id,
        enabled: !mockIsEnabled,
      });
      expect(notifications.show).not.toHaveBeenCalled();
    });
  });

  it('shows a notification toast if updateUserGroupAiAgents fails', async () => {
    const mockError = new Error('Failed to update user group AI Agents');
    (useUpdateUserGroupAiAgents as jest.Mock).mockReturnValue({
      mutateAsync: updateUserGroupAiAgents,
      isPending: false,
      error: mockError,
    });
    updateUserGroupAiAgents.mockRejectedValue(mockError);

    renderComponent({
      aiAgent: mockAiAgent,
      userGroupId: mockUserGroupId,
      isEnabled: mockIsEnabled,
    });

    const switchComponent = screen.getByRole('switch');
    fireEvent.click(switchComponent);

    await waitFor(() => {
      expect(updateUserGroupAiAgents).toHaveBeenCalledWith({
        userGroupId: mockUserGroupId,
        aiAgentId: mockAiAgent.id,
        enabled: !mockIsEnabled,
      });
      expect(notifications.show).toHaveBeenCalledWith({
        id: 'update-user-group-ai-agents-failed',
        title: 'Failed to Update',
        message: mockError?.message,
        icon: <IconX />,
        variant: 'failed_operation',
        autoClose: false,
      });
    });
  });

  describe('CERTA Agent', () => {
    beforeEach(() => {
      mockAiAgent = {
        id: 'd991cc5c-4710-474e-ad8d-57e8627c4fa7',
        label:  'Test Agent',
        type: AiAgentType.CERTA,
      };
    });

    it('renders requirement status when agent is CERTA', () => {
      renderComponent({
        aiAgent: mockAiAgent,
        userGroupId: mockUserGroupId,
        isEnabled: mockIsEnabled,
      });

      const requirementText = screen.getByText(
        'Open AI Provider must be enabled for CERTA'
      );
      expect(requirementText).toBeInTheDocument();
    });

    it('shows loading state while fetching providers', () => {
      (useGetUserGroupAiProviders as jest.Mock).mockReturnValue({
        data: null,
        isPending: true,
        error: null,
      });

      renderComponent({
        aiAgent: mockAiAgent,
        userGroupId: mockUserGroupId,
        isEnabled: mockIsEnabled,
      });

      const loadingText = screen.getByText('Loading requirements...');
      expect(loadingText).toBeInTheDocument();

      const switchComponent = screen.getByRole('switch');
      expect(switchComponent).toBeDisabled();
    });

    it('disables switch when OpenAI provider is not available', () => {
      (useGetUserGroupAiProviders as jest.Mock).mockReturnValue({
        data: {
          userGroupProviders: [
            {
              id: '123',
              label: 'Some Other Provider',
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        },
        isPending: false,
        error: null,
      });

      (useGetAiProviders as jest.Mock).mockReturnValue({
        data: {
          aiProviders: [
            {
              id: '123',
              label: 'Some Other Provider',
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        },
        isPending: false,
        error: null,
      });

      renderComponent({
        aiAgent: mockAiAgent,
        userGroupId: mockUserGroupId,
        isEnabled: mockIsEnabled,
      });

      const switchComponent = screen.getByRole('switch');
      expect(switchComponent).toBeDisabled();
    });

    it('enables switch when OpenAI provider is available', () => {
      const openAiProviderId = '123';

      (useGetUserGroupAiProviders as jest.Mock).mockReturnValue({
        data: {
          userGroupProviders: [
            {
              id: openAiProviderId,
              label: 'Open AI Provider',
              typeId: 1,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        },
        isPending: false,
        error: null,
      });

      (useGetAiProviders as jest.Mock).mockReturnValue({
        data: {
          aiProviders: [
            {
              id: openAiProviderId,
              label: 'Open AI Provider',
              typeId: 1,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        },
        isPending: false,
        error: null,
      });

      renderComponent({
        aiAgent: mockAiAgent,
        userGroupId: mockUserGroupId,
        isEnabled: mockIsEnabled,
      });

      const switchComponent = screen.getByRole('switch');
      expect(switchComponent).not.toBeDisabled();
    });

    it('does not disable switch when already enabled even if requirements not met', () => {
      (useGetUserGroupAiProviders as jest.Mock).mockReturnValue({
        data: {
          userGroupProviders: [
            {
              id: '123',
              label: 'Some Other Provider',
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        },
        isPending: false,
        error: null,
      });

      (useGetAiProviders as jest.Mock).mockReturnValue({
        data: {
          aiProviders: [
            {
              id: '123',
              label: 'Some Other Provider',
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        },
        isPending: false,
        error: null,
      });

      mockIsEnabled = true;

      renderComponent({
        aiAgent: mockAiAgent,
        userGroupId: mockUserGroupId,
        isEnabled: mockIsEnabled,
      });

      const switchComponent = screen.getByRole('switch');
      expect(switchComponent).not.toBeDisabled();
    });

    it('disables switch when Open AI provider only exists in user group but not in main list', () => {
      (useGetUserGroupAiProviders as jest.Mock).mockReturnValue({
        data: {
          userGroupProviders: [
            {
              id: '123',
              label: 'Open AI Provider',
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        },
        isPending: false,
        error: null,
      });

      (useGetAiProviders as jest.Mock).mockReturnValue({
        data: {
          aiProviders: [
            {
              id: '456',
              label: 'Some Other Provider',
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        },
        isPending: false,
        error: null,
      });

      renderComponent({
        aiAgent: mockAiAgent,
        userGroupId: mockUserGroupId,
        isEnabled: mockIsEnabled,
      });

      const switchComponent = screen.getByRole('switch');
      expect(switchComponent).toBeDisabled();
    });
  });
});
