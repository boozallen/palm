import { useState } from 'react';
import { Checkbox, Group, Popover, Stack, Text, ThemeIcon } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconInfoCircle, IconX } from '@tabler/icons-react';
import { useUpdateSystemConfig } from '@/features/settings/api/system-configurations/update-system-config';
import { SystemConfigFields } from '@/features/shared/types';

type MemoryConfigRowProps = {
  checked: boolean;
  indent?: boolean;
};

export default function MemoryConfigRow({ checked, indent }: Readonly<MemoryConfigRowProps>) {
  const [popoverOpened, setPopoverOpened] = useState(false);
  const { mutateAsync: updateSystemConfig, error: updateSystemConfigError } =
    useUpdateSystemConfig();

  const toggleMemoryConfig = async (nextChecked: boolean) => {
    try {
      await updateSystemConfig({
        configField: SystemConfigFields.MemoryEnabled,
        configValue: nextChecked,
      });
    } catch (error) {
      const message =
        updateSystemConfigError?.message ?? 'Failed to update memory config';
      notifications.show({
        id: 'update-memory-config-failed',
        title: 'Failed to Update',
        message,
        icon: <IconX />,
        variant: 'failed_operation',
        autoClose: false,
      });
    }
  };

  return (
    <tr data-testid='memory-config-row'>
      <td>
        <Group spacing='xs' align='center' pl={indent ? 'xl' : undefined}>
          <Text data-testid='memory-config-label'>Enable Memory</Text>
          <Popover
            opened={popoverOpened}
            onChange={setPopoverOpened}
            position='bottom-start'
            withArrow
            withinPortal
            width={320}
          >
            <Popover.Target>
              <ThemeIcon
                size='xs'
                data-testid='memory-info-icon'
                onMouseEnter={() => setPopoverOpened(true)}
                onMouseLeave={() => setPopoverOpened(false)}
                sx={{ cursor: 'default' }}
              >
                <IconInfoCircle />
              </ThemeIcon>
            </Popover.Target>
            <Popover.Dropdown p='md'>
              <Stack spacing='md'>
                <Stack spacing={6}>
                  <Text size='sm' fw={600} color='gray.2'>
                    Memory
                  </Text>
                  <Text size='xs' color='gray.5'>
                    As chats happen, they&apos;re added to the knowledge graph and linked to
                    whatever entities and chunks they cited that are already in the graph, plus
                    any artifacts they produced along the way — so future conversations can draw
                    on relevant history instead of starting from scratch. Citations from ungraphed
                    documents or knowledge bases aren&apos;t linked.
                  </Text>
                </Stack>
                <Text size='xs' color='gray.6'>
                  Applies to all users.
                </Text>
              </Stack>
            </Popover.Dropdown>
          </Popover>
        </Group>
      </td>
      <td>
        <Checkbox
          aria-label='Enable Memory'
          checked={checked}
          onChange={(event) => toggleMemoryConfig(event.currentTarget.checked)}
        />
      </td>
    </tr>
  );
}
