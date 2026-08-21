import { useEffect, useState } from 'react';
import { Button, Group, Stack, Table, Text, Title, ThemeIcon } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconX } from '@tabler/icons-react';

import { UiPreference } from '@/types/ui-preferences';

interface PreferenceConfig {
  key: UiPreference;
  label: string;
  description: string;
}

const preferenceConfigs: PreferenceConfig[] = [
  {
    key: UiPreference.SUPPRESS_PII_WARNING,
    label: 'Disable Possible PII Warning',
    description: 'Stops warnings from appearing when potentially sensitive information is detected in your prompt submissions',
  },
  {
    key: UiPreference.SUPPRESS_REGENERATE_RESPONSE_WARNING,
    label: 'Disable Regenerate Response Warning',
    description: 'Stops confirmation dialog from appearing when regenerating AI responses in chat',
  },
  {
    key: UiPreference.SUPPRESS_GITHUB_PUSH_WARNING,
    label: 'Disable GitHub Push Warning',
    description: 'Stops confirmation dialog from appearing when pushing artifacts to GitHub',
  },
  {
    key: UiPreference.MENUBAR_COLLAPSED,
    label: 'Collapse left-hand menu bar',
    description: 'Maintains toggled state of the container',
  },
  {
    key: UiPreference.WORKFLOW_NODES_CONTAINER_COLLAPSED,
    label: 'Collapse Workflow nodes palette',
    description: 'Maintains toggled state of the container',
  },
  {
    key: UiPreference.PROMPT_LIBRARY_VIEW,
    label: 'Prompt Library view',
    description: 'Displays prompts in list view instead of card view',
  },
  {
    key: UiPreference.WORKFLOWS_VIEW,
    label: 'Workflows view',
    description: 'Displays workflows in list view instead of card view',
  },
  {
    key: UiPreference.JOIN_USER_GROUP_DIALOG_COLLAPSED,
    label: 'Collapse join user group dialog box',
    description: 'Keeps the join user group dialog box minimized while you are not a member of any user group',
  },
];

export default function UiPreferencesTable() {
  const [cookieStates, setCookieStates] = useState<Record<UiPreference, boolean>>({} as Record<UiPreference, boolean>);

  useEffect(() => {
    const states: Record<UiPreference, boolean> = {} as Record<UiPreference, boolean>;
    preferenceConfigs.forEach((config) => {
      const value = localStorage.getItem(config.key);
      if (config.key === UiPreference.PROMPT_LIBRARY_VIEW || config.key === UiPreference.WORKFLOWS_VIEW) {
        states[config.key] = value === 'table';
      } else {
        states[config.key] = value === 'true';
      }
    });
    setCookieStates(states);
  }, []);

  const resetCookieSetting = (cookieKey: UiPreference, label: string) => {
    localStorage.removeItem(cookieKey);
    setCookieStates(prev => ({ ...prev, [cookieKey]: false }));
    notifications.show({
      title: 'Setting Updated',
      message: `The "${label}" setting has been successfully reset.`,
      icon: <IconCheck />,
      autoClose: true,
      variant: 'successful_operation',
    });
  };

  return (
    <Table data-testid='ui-preferences-table'>
      <thead>
        <tr>
          <th>UI Preferences</th>
        </tr>
      </thead>
      <tbody>
        {preferenceConfigs.map((config) => {
          const isEnabled = cookieStates[config.key];
          return (
            <tr key={config.key}>
              <td>
                <Group align='center' position='apart'>
                  <Group spacing='sm' align='center'>
                    {isEnabled ? (
                      <ThemeIcon c='green' size='sm'>
                        <IconCheck />
                      </ThemeIcon>
                    ) : (
                      <ThemeIcon c='gray.8' size='sm'>
                        <IconX />
                      </ThemeIcon>
                    )}
                    <Stack spacing='xxs'>
                      <Title size='sm'>
                        {config.label}
                      </Title>
                      <Text size='xs' color='dimmed'>
                        {config.description}
                      </Text>
                    </Stack>
                  </Group>
                  <Button
                    variant='outline'
                    size='xs'
                    onClick={() => resetCookieSetting(config.key, config.label)}
                    disabled={!isEnabled}
                  >
                    Reset
                  </Button>
                </Group>
              </td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}
