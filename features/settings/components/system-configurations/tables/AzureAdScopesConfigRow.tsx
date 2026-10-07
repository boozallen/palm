import { ComponentPropsWithoutRef, forwardRef, useState } from 'react';
import { useUpdateSystemConfig } from '@/features/settings/api/system-configurations/update-system-config';
import { Badge, Button, Group, List, MultiSelect, Popover, Stack, Table, Text, ThemeIcon } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconInfoCircle, IconX, IconCheck } from '@tabler/icons-react';
import {
  SystemConfigFields,
  AzureAdScope,
  AzureAdScopeService,
  AZURE_AD_SCOPE_DETAILS,
} from '@/features/shared/types';

type AzureAdScopesConfigRowProps = {
  currentScopes: string[];
};

const AVAILABLE_SCOPES = Object.values(AzureAdScope).map((scope) => ({ value: scope, label: scope }));

const isRequiredScope = (scope: string): boolean =>
  AZURE_AD_SCOPE_DETAILS[scope as AzureAdScope]?.required ?? false;

const SERVICE_BADGE_COLOR: Record<AzureAdScopeService, string> = {
  'OpenID Connect': 'blue',
  'Microsoft Graph': 'violet',
};

type ScopeItemProps = ComponentPropsWithoutRef<'div'> & { value: string; label: string };

const ScopeItem = forwardRef<HTMLDivElement, ScopeItemProps>(
  ({ value, label, ...others }, ref) => (
    <div ref={ref} {...others}>
      <Group spacing='xs' noWrap>
        <Text size='sm'>{label}</Text>
        {isRequiredScope(value) && (
          <Badge variant='filled' color='orange.6' c='black' size='xs'>
            Required
          </Badge>
        )}
      </Group>
    </div>
  )
);
ScopeItem.displayName = 'ScopeItem';

export default function AzureAdScopesConfigRow({
  currentScopes,
}: Readonly<AzureAdScopesConfigRowProps>) {
  const [selectedScopes, setSelectedScopes] = useState<string[]>(currentScopes);
  const [popoverOpened, setPopoverOpened] = useState(false);
  const { mutateAsync: updateSystemConfig, isPending } = useUpdateSystemConfig();

  const handleSave = async () => {
    try {
      await updateSystemConfig({
        configField: SystemConfigFields.AzureAdScopes,
        configValue: selectedScopes,
      });

      notifications.show({
        id: 'update-azure-ad-scopes-success',
        title: 'Azure AD Scopes Updated',
        message: 'Azure AD scopes have been successfully updated. Users must log out and back in for changes to take effect.',
        icon: <IconCheck />,
        variant: 'successful_operation',
        autoClose: 5000,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update Azure AD scopes';
      notifications.show({
        id: 'update-azure-ad-scopes-failed',
        title: 'Failed to Update',
        message: message,
        icon: <IconX />,
        variant: 'failed_operation',
        autoClose: false,
      });
    }
  };

  const hasChanges = JSON.stringify([...selectedScopes].sort()) !== JSON.stringify([...currentScopes].sort());

  return (
    <tr>
      <td>
        <Group spacing='xs' align='center'>
          Azure AD OAuth Scopes
          <Popover
            opened={popoverOpened}
            onChange={setPopoverOpened}
            position='right-start'
            withinPortal
            width={460}
          >
            <Popover.Target>
              <ThemeIcon
                size='xs'
                data-testid='azure-ad-scopes-info-icon'
                onMouseEnter={() => setPopoverOpened(true)}
                onMouseLeave={() => setPopoverOpened(false)}
                sx={{ cursor: 'default' }}
              >
                <IconInfoCircle />
              </ThemeIcon>
            </Popover.Target>
            <Popover.Dropdown p='md'>
              <Stack spacing='sm'>
                <Text size='sm' fw={600} color='gray.2'>
                  Azure AD OAuth Scopes
                </Text>
                <Text size='xs' color='gray.5'>
                  OAuth scopes requested during Azure AD sign-in.
                </Text>
                <Table
                  variant='default'
                  fontSize='xs'
                >
                  <thead>
                    <tr>
                      <th>
                        <Text size='xs' fw={700}>Scope</Text>
                      </th>
                      <th>
                        <Text size='xs' fw={700}>Description</Text>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(AZURE_AD_SCOPE_DETAILS).map(([scope, detail]) => (
                      <tr key={scope}>
                        <td>
                          <Stack spacing={4}>
                            <Text size='xs'>{scope}</Text>
                            <Group spacing={4} noWrap>
                              <Badge variant='outline' color={SERVICE_BADGE_COLOR[detail.service]} size='xs'>
                                {detail.service}
                              </Badge>
                              {detail.required && (
                                <Badge variant='filled' color='orange.6' c='black' size='xs'>
                                  Required
                                </Badge>
                              )}
                            </Group>
                          </Stack>
                        </td>
                        <td>
                          <Stack spacing={4}>
                            <Text size='xs' italic>{detail.description}</Text>
                            <List size='xs' spacing={2}>
                              {detail.features.map((feature) => (
                                <List.Item key={feature}>{feature}</List.Item>
                              ))}
                            </List>
                          </Stack>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Stack>
            </Popover.Dropdown>
          </Popover>
        </Group>
      </td>
      <td>
        <Group spacing='sm'>
          <MultiSelect
            variant='default'
            data={AVAILABLE_SCOPES}
            value={selectedScopes}
            onChange={setSelectedScopes}
            placeholder='Select scopes'
            searchable={false}
            clearable={false}
            itemComponent={ScopeItem}
            style={{ minWidth: 300 }}
            data-testid='azure-ad-scopes-select'
          />
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isPending}
            loading={isPending}
            size='sm'
          >
            Save
          </Button>
        </Group>
      </td>
    </tr>
  );
}
