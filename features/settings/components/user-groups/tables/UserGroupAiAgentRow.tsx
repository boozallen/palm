import { Group, Stack, Switch, Text, ThemeIcon } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconX } from '@tabler/icons-react';
import useUpdateUserGroupAiAgents from '@/features/settings/api/update-user-group-ai-agents';
import useGetUserGroupAiProviders from '@/features/settings/api/get-user-group-ai-providers';
import useGetAiProviders from '@/features/settings/api/get-ai-providers';
import { AiProviderType, AgentType } from '@/features/shared/types';

type UserGroupAiAgentRowProps = Readonly<{
  aiAgent: {
    id: string;
    name: string;
  };
  userGroupId: string;
  isEnabled: boolean;
}>;

export default function UserGroupAiAgentRow({
  aiAgent,
  userGroupId,
  isEnabled,
}: UserGroupAiAgentRowProps) {

  const {
    mutateAsync: updateUserGroupAiAgents,
    error: updateUserGroupAiAgentsError,
  } = useUpdateUserGroupAiAgents();

  const { data: allAiProvidersData } = useGetAiProviders();

  const {
    data: userGroupAiProvidersData,
    isPending: userGroupAiProvidersPending,
  } = useGetUserGroupAiProviders(userGroupId);

  const isCerta = aiAgent.name ===  AgentType.CERTA;
  
  const getActiveUserGroupProviders = () => {
    const activeProviderIds = new Set(allAiProvidersData?.aiProviders?.map(provider => provider.id) || []);
    return userGroupAiProvidersData?.userGroupProviders?.filter(provider => activeProviderIds.has(provider.id)) || [];
  };

  const hasOpenAiProvider = () => {
    if (!isCerta) {
      return false;
    }

    const activeUserGroupProviders = getActiveUserGroupProviders();
    if (activeUserGroupProviders.length === 0) {
      return false;
    }

    return activeUserGroupProviders.some(
      provider => provider.typeId === AiProviderType.OpenAi
    );
  };

  const isSwitchDisabled = () => {
    if (!isCerta) {
      return false;
    }
    if (userGroupAiProvidersPending) {
      return true;
    }
    if (isEnabled) {
      return false;
    }
    return !hasOpenAiProvider();
  };

  const toggleUserGroupAiAgents = async (checked: boolean) => {
    try {
      await updateUserGroupAiAgents({
        aiAgentId: aiAgent.id,
        userGroupId: userGroupId,
        enabled: checked,
      });
    } catch (error) {
      notifications.show({
        id: 'update-user-group-ai-agents-failed',
        title: 'Failed to Update',
        message:
          updateUserGroupAiAgentsError?.message ??
          'Could not update User Group\'s AI Agents.',
        icon: <IconX />,
        variant: 'failed_operation',
        autoClose: false,
      });
    }
  };

  const renderRequirementsContent = () => {
    if (!isCerta) {
      return null;
    }

    if (userGroupAiProvidersPending) {
      return (
        <Text size='sm' c='gray.6'>
          Loading requirements...
        </Text>
      );
    }

    const isRequirementMet = hasOpenAiProvider();

    return (
      <Stack spacing='xs' w='100%'>
        <Group spacing='xs' noWrap>
          <ThemeIcon
            size='sm'
            variant='light'
            color={isRequirementMet ? 'green' : 'red'}
          >
            {isRequirementMet ? (
              <IconCheck color='green' stroke={3} />
            ) : (
              <IconX color='red' />
            )}
          </ThemeIcon>
          <Text size='sm'>Open AI Provider must be enabled for CERTA</Text>
        </Group>
      </Stack>
    );
  };

  return (
    <tr data-testid={`${aiAgent.id}-user-group-ai-agent-row`}>
      <td>{aiAgent.name}</td>
      <td>{renderRequirementsContent()}</td>
      <td>
        <Group position='center'>
          <Switch
            aria-label={`Enable user group AI Agent ${aiAgent.name}`}
            checked={isEnabled}
            onChange={(event) =>
              toggleUserGroupAiAgents(event.currentTarget.checked)
            }
            disabled={isSwitchDisabled()}
          />
        </Group>
      </td>
    </tr>
  );
}
