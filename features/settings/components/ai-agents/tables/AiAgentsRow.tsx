import {
  Anchor,
  Checkbox,
  Group,
  ThemeIcon,
  Tooltip,
  Text,
  Stack,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconInfoCircle, IconX, IconCheck } from '@tabler/icons-react';
import Link from 'next/link';

import useUpdateAiAgent from '@/features/settings/api/update-ai-agent';
import useGetCertaRequirements from '@/features/settings/api/ai-agents/certa/get-certa-requirements';
import { AgentType } from '@/features/shared/types';

type AiAgentsRowProps = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
};

export default function AiAgentsRow({
  id,
  name,
  description,
  enabled,
}: Readonly<AiAgentsRowProps>) {
  const { mutateAsync: updateAiAgent, error: updateAiAgentError } =
    useUpdateAiAgent();

  const agentType = Object.values(AgentType).find((type) => type === name);

  const { data: certaRequirementsData, isPending: certaPending } =
    useGetCertaRequirements({ enabled: agentType === AgentType.CERTA });

  let requirementsData = null;
  let isLoadingRequirements = false;

  if (agentType === AgentType.CERTA) {
    requirementsData = certaRequirementsData;
    isLoadingRequirements = certaPending;
  }

  const showErrorNotification = (message: string) => {
    notifications.show({
      id: 'update-ai-agent-failed',
      title: 'Failed to Update',
      message: message,
      icon: <IconX />,
      variant: 'failed_operation',
      autoClose: false,
    });
  };

  const toggleAiAgent = async (checked: boolean) => {
    try {
      await updateAiAgent({
        id: id,
        enabled: checked,
      });
    } catch {
      const message =
        updateAiAgentError?.message ?? 'Failed to update AI agent';
      showErrorNotification(message);
    }
  };

  let requirementsContent;

  if (isLoadingRequirements) {
    requirementsContent = (
      <Text size='sm' c='gray.6'>
        Loading requirements...
      </Text>
    );
  } else if (
    requirementsData?.requirements &&
    requirementsData.requirements.length > 0
  ) {
    requirementsContent = (
      <Stack spacing='xs' w='100%'>
        {requirementsData.requirements.map((req) => (
          <Group key={req.name} spacing='xs' noWrap>
            <ThemeIcon
              size='sm'
              variant='light'
              color={req.available ? 'green' : 'red'}
            >
              {req.available ? (
                <IconCheck color='green' stroke={3} />
              ) : (
                <IconX color='red' />
              )}
            </ThemeIcon>
            <Text size='sm'>{req.name}</Text>
          </Group>
        ))}
      </Stack>
    );
  }

  return (
    <tr>
      <td>
        <Group spacing='xs' align='center'>
          {agentType === AgentType.CERTA ? (
            <Anchor href={`/settings/ai-agents/${id}`} component={Link}>
              {name}
            </Anchor>
          ) : (
            <Text color='gray.6'>{name}</Text>
          )}
          <Tooltip label={description}>
            <ThemeIcon size='xs' data-testid='agent-management-info-icon'>
              <IconInfoCircle />
            </ThemeIcon>
          </Tooltip>
        </Group>
      </td>

      <td>{requirementsContent}</td>

      <td>
        <Checkbox
          aria-label={`Enable ${name}`}
          checked={enabled}
          onChange={(event) => toggleAiAgent(event.currentTarget.checked)}
          disabled={
            isLoadingRequirements || (!requirementsData?.configured && !enabled)
          }
        />
      </td>
    </tr>
  );
}
