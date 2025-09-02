import {
  Anchor,
  Group,
  ThemeIcon,
  Tooltip,
  Text,
  Stack,
} from '@mantine/core';
import { IconInfoCircle, IconX, IconCheck } from '@tabler/icons-react';
import Link from 'next/link';

import useGetCertaRequirements from '@/features/settings/api/ai-agents/certa/get-certa-requirements';
import useGetRadarRequirements from '@/features/settings/api/ai-agents/radar/get-radar-requirements';
import { AiAgentType } from '@/features/shared/types';
import AgentActions from '@/features/settings/components/ai-agents/elements/AgentActions';
import Loading from '@/features/shared/components/Loading';

type AiAgentsRowProps = {
  id: string;
  label: string;
  description: string;
  type: AiAgentType;
};

export default function AiAgentsRow({
  id,
  label,
  description,
  type,
}: Readonly<AiAgentsRowProps>) {
  const { data: certaRequirementsData, isPending: certaPending } =
    useGetCertaRequirements({ enabled: type === AiAgentType.CERTA });

  const { data: radarRequirementsData, isPending: radarPending } =
    useGetRadarRequirements({ enabled: type === AiAgentType.RADAR });

  let requirementsData = null;
  let isLoadingRequirements = false;

  if (type === AiAgentType.CERTA) {
    requirementsData = certaRequirementsData;
    isLoadingRequirements = certaPending;
  } else if (type === AiAgentType.RADAR) {
    requirementsData = radarRequirementsData;
    isLoadingRequirements = radarPending;
  } else {
    return null;
  }

  let requirementsContent;

  if (isLoadingRequirements) {
    requirementsContent = (
      <Loading />
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
          {type === AiAgentType.CERTA ? (
            <Anchor href={`/settings/ai-agents/${id}`} component={Link}>
              {label}
            </Anchor>
          ) : (
            <Text color='gray.6'>{label}</Text>
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
        <AgentActions
          id={id}
          label={label}
          description={description}
          type={type}
        />
      </td>
    </tr>
  );
}
