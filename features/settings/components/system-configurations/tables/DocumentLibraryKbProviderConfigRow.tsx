import { useUpdateSystemConfig } from '@/features/settings/api/update-system-config';
import getKbProviders from '@/features/settings/api/get-kb-providers';
import Loading from '@/features/shared/components/Loading';
import { Grid, Group, Select, Text, ThemeIcon, Tooltip } from '@mantine/core';
import { SystemConfigFields } from '@/features/shared/types';
import { notifications } from '@mantine/notifications';
import { IconX, IconCheck, IconInfoCircle } from '@tabler/icons-react';

interface DocumentLibraryConfigRowProps {
  documentLibraryKbProviderId: string | null;
}

const DocumentLibraryKbProviderConfigRow = ({ documentLibraryKbProviderId }: DocumentLibraryConfigRowProps) => {

  const {
    data: kbProvidersData,
    isPending: getKbProvidersIsPending,
    error: getKbProvidersError,
  } = getKbProviders();

  const { mutateAsync: updateSystemConfig } = useUpdateSystemConfig();

  const noneOption = { value: '', label: '(None)' };

  const kbProviders =
    kbProvidersData?.kbProviders
      ?.filter(provider => provider.writeAccess)
      ?.map((provider) => ({
        value: provider.id,
        label: provider.label,
      })) || [];

  const selectOptions = kbProviders.length > 0 ? [noneOption, ...kbProviders] : [];

  const defaultValue = documentLibraryKbProviderId ?? '';

  if (getKbProvidersIsPending) {
    return (
      <tr>
        <td>
          <Loading />
        </td>
      </tr>
    );
  }

  if (getKbProvidersError) {
    return (
      <tr>
        <td>
          <Text>{getKbProvidersError.message}</Text>
        </td>
      </tr>
    );
  }

  const handleKbProviderChange = async (value: string) => {
    let updateSuccessful = true;
    let successMessage = '';

    try {
      await updateSystemConfig({
        configField: SystemConfigFields.DocumentLibraryKbProviderId,
        configValue: value === '' ? null : value,
      });
      successMessage = value.length ? 'Document Library knowledge base provider has been updated.' : 'Document Library knowledge base provider has been removed.';
    } catch (error) {
      updateSuccessful = false;
    }

    notifications.show({
      id: 'update-document-library-kb-provider',
      title: updateSuccessful ? 'Document Library Knowledge Base Provider Updated' : 'Failed to Update',
      message: updateSuccessful
        ? successMessage
        : 'Failed to update',
      icon: updateSuccessful ? <IconCheck /> : <IconX />,
      variant: updateSuccessful ? 'successful_operation' : 'failed_operation',
      autoClose: updateSuccessful,
    });
  };

  return (
    <tr data-testid='document-library-kb-provider-config-row'>
      <td>
        <Grid>
          <Grid.Col span={6}>
            <Group align='center' spacing='sm'>
              <label htmlFor='select-document-library-kb-provider'>Select Knowledge Base Provider</label>
              <Tooltip label='Designate the knowledge base provider used to support the User Document Library. Requires a knowledge base provider with write access.'>
                <ThemeIcon size='xs'>
                  <IconInfoCircle />
                </ThemeIcon>
              </Tooltip>
            </Group>
            <Select
              id='select-document-library-kb-provider'
              variant='default'
              data-testid='user-document-library-kb-provider-select'
              data={selectOptions}
              value={kbProviders.length > 0 ? defaultValue : null}
              placeholder='No knowledge base providers available'
              onChange={handleKbProviderChange}
              disabled={!kbProviders.length}
              pt='sm'
            />
          </Grid.Col>
        </Grid>
      </td>
    </tr>
  );
};

export default DocumentLibraryKbProviderConfigRow;
