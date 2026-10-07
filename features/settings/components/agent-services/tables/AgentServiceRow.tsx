import { Button, Group, Text, Tooltip, ThemeIcon } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconX, IconActivity } from '@tabler/icons-react';
import useTestAgentService from '@/features/settings/api/agent-services/test-agent-service';

type AgentService = {
  id: string;
  name: string;
  description: string;
  endpoint: string;
};

type AgentServiceRowProps = {
  service: AgentService;
};

export default function AgentServiceRow({ service }: Readonly<AgentServiceRowProps>) {
  const testAgentServiceMutation = useTestAgentService();

  function handleTestService() {
    testAgentServiceMutation.mutate(
      { serviceId: service.id as 'langgraph' | 'claude' },
      {
        onSuccess: (data) => {
          if (data.isValid) {
            notifications.show({
              title: 'Service Test Successful',
              message: `${service.name} is configured correctly and responding.`,
              icon: <IconCheck />,
              color: 'green',
              autoClose: true,
            });
          } else {
            notifications.show({
              title: 'Service Test Failed',
              message: data.errorMessage ?? 'Service test failed',
              icon: <IconX />,
              color: 'red',
              autoClose: true,
            });
          }
        },
        onError: (error) => {
          notifications.show({
            title: 'Service Test Error',
            message: error instanceof Error ? error.message : 'Service is unreachable',
            icon: <IconX />,
            color: 'red',
            autoClose: true,
          });
        },
      }
    );
  }

  return (
    <tr>
      <td>
        <Text fw={500}>{service.name}</Text>
      </td>
      <td>
        <Text c='dimmed' fz='sm'>{service.description || '—'}</Text>
      </td>
      <td>
        <Text fz='sm' style={{ wordBreak: 'break-all' }}>{service.endpoint}</Text>
      </td>
      <td>
        <Group>
          <Tooltip
            label={
              !testAgentServiceMutation.isPending
                ? 'Test agent service configuration'
                : undefined
            }
            openDelay={600}
            events={{ hover: true, focus: true, touch: true }}
          >
            <Button
              leftIcon={
                <ThemeIcon size='sm' variant='noHover'>
                  <IconActivity />
                </ThemeIcon>
              }
              size='xs'
              data-testid={`${service.id}-test`}
              onClick={handleTestService}
              loading={testAgentServiceMutation.isPending}
            >
              Test Service
            </Button>
          </Tooltip>
        </Group>
      </td>
    </tr>
  );
}
