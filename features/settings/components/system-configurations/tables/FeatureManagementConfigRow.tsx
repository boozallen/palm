import { useMemo } from 'react';
import { useUpdateSystemConfig } from '@/features/settings/api/system-configurations/update-system-config';
import { Checkbox, Group, ThemeIcon, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconInfoCircle, IconX } from '@tabler/icons-react';
import { SystemConfigFields } from '@/features/shared/types';

type FeatureManagementConfigRowProps = {
  field: SystemConfigFields;
  label: string;
  checked: boolean;
};

export default function FeatureManagementConfigRow({
  field,
  label,
  checked,
}: Readonly<FeatureManagementConfigRowProps>) {
  const { mutateAsync: updateSystemConfig, error: updateSystemConfigError } =
    useUpdateSystemConfig();

  const tooltipText = useMemo(() => {
    switch (field) {
      case SystemConfigFields.FeatureManagementChatSummarization:
        return 'Creates an AI-generated title based on the contents of a chat conversation';
      case SystemConfigFields.FeatureManagementPromptGenerator:
        return 'The Prompt Generator section of the application';
      case SystemConfigFields.FeatureManagementPromptTagSuggestions:
        return 'Creates AI-generated prompt tag suggestions';
      default:
        return '';
    }
  }, [field]);

  const toggleFeatureManagementConfig = async (checked: boolean) => {
    try {
      await updateSystemConfig({
        configField: field,
        configValue: checked,
      });
    } catch (error) {
      const message =
        updateSystemConfigError?.message ??
        'Failed to update feature management config';
      notifications.show({
        id: 'update-feature-management-config-failed',
        title: 'Failed to Update',
        message: message,
        icon: <IconX />,
        variant: 'failed_operation',
        autoClose: false,
      });
    }
  };

  return (
    <tr>
      <td>
        <Group spacing='xs' align='center'>
          {label}
          <Tooltip label={tooltipText}>
            <ThemeIcon size='xs' data-testid='feature-management-info-icon'>
              <IconInfoCircle />
            </ThemeIcon>
          </Tooltip>
        </Group>
      </td>
      <td>
        <Checkbox
          aria-label={`Enable ${label}`}
          checked={checked}
          onChange={(event) =>
            toggleFeatureManagementConfig(event.currentTarget.checked)
          }
        />
      </td>
    </tr>
  );
}
