import { Grid, Group, Select, Text, ThemeIcon, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconX, IconCheck, IconInfoCircle } from '@tabler/icons-react';

import { useUpdateSystemConfig } from '@/features/settings/api/system-configurations/update-system-config';
import getDocumentUploadProviders from '@/features/settings/api/document-upload/get-document-upload-providers';
import Loading from '@/features/shared/components/Loading';
import { SystemConfigFields } from '@/features/shared/types';

interface DocumentLibraryConfigRowProps {
  documentUploadProviderId: string | null;
}

const DocumentLibraryDocumentUploadProviderConfigRow = ({ documentUploadProviderId }: DocumentLibraryConfigRowProps) => {

  const {
    data: documentUploadProvidersData,
    isPending: getDocumentUploadProvidersIsPending,
    error: getDocumentUploadProvidersError,
  } = getDocumentUploadProviders();

  const { mutateAsync: updateSystemConfig } = useUpdateSystemConfig();

  const noneOption = { value: '', label: '(None)' };

  const documentUploadProviders =
    documentUploadProvidersData?.providers
      ?.map((provider) => ({
        value: provider.id,
        label: provider.label,
      })) || [];

  const selectOptions = documentUploadProviders.length > 0 ? [noneOption, ...documentUploadProviders] : [];
  const defaultValue = documentUploadProviderId ?? '';

  if (getDocumentUploadProvidersIsPending) {
    return (
      <tr>
        <td>
          <Loading />
        </td>
      </tr>
    );
  }

  if (getDocumentUploadProvidersError) {
    return (
      <tr>
        <td>
          <Text>{getDocumentUploadProvidersError.message}</Text>
        </td>
      </tr>
    );
  }

  const handleDocumentUploadProviderChange = async (value: string) => {
    let updateSuccessful = true;
    let successMessage = '';

    try {
      await updateSystemConfig({
        configField: SystemConfigFields.DocumentLibraryDocumentUploadProviderId,
        configValue: value === '' ? null : value,
      });
      successMessage = value.length ? 'Document Library Document Upload Provider has been updated.' : 'Document Library Document Upload Provider has been removed.';
    } catch (error) {
      updateSuccessful = false;
    }

    notifications.show({
      id: 'update-document-library-document-upload-provider',
      title: updateSuccessful ? 'Document Library Document Upload Provider Updated' : 'Failed to Update',
      message: updateSuccessful
        ? successMessage
        : 'Failed to update',
      icon: updateSuccessful ? <IconCheck /> : <IconX />,
      variant: updateSuccessful ? 'successful_operation' : 'failed_operation',
      autoClose: updateSuccessful,
    });
  };

  return (
    <tr data-testid='document-library-document-upload-provider-config-row'>
      <td>
        <Grid>
          <Grid.Col span={6}>
            <Group align='center' spacing='sm'>
              <label htmlFor='select-document-library-document-upload-provider'>Select Document Upload Provider</label>
              <Tooltip label='Designate the Document Upload Provider used to support the Document Library.'>
                <ThemeIcon size='xs'>
                  <IconInfoCircle />
                </ThemeIcon>
              </Tooltip>
            </Group>
            <Select
              id='select-document-library-document-upload-provider'
              variant='default'
              data-testid='user-document-library-document-upload-provider-select'
              data={selectOptions}
              value={documentUploadProviders.length > 0 ? defaultValue : null}
              placeholder='No document upload providers available'
              onChange={handleDocumentUploadProviderChange}
              disabled={!documentUploadProviders.length}
              pt='sm'
            />
          </Grid.Col>
        </Grid>
      </td>
    </tr>
  );
};

export default DocumentLibraryDocumentUploadProviderConfigRow;
