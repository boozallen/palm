import { useEffect } from 'react';
import { Button, Group, Stack } from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconDownload, IconX } from '@tabler/icons-react';

import InitiatedByInput from './inputs/InitiatedByInput';
import AiProviderInput from './inputs/AiProviderInput';
import ModelInput from './inputs/ModelInput';
import AiProviderUsageResults from './AiProviderUsageResults';
import useGetUsageRecords from '@/features/context-studio/api/get-usage-records';
import { costInitialValues, CostQuery, costQuery } from '@/features/context-studio/types/cost';
import { TimeRange } from '@/features/context-studio/types/context-studio';

// Time range, group, and user come from the studio's shared filter bar, which
// scopes every tab. This section renders only the three filters unique to cost
// and follows the bar live, the way the other panels do — the Search button the
// standalone Analytics page carried had nothing left to trigger.
type CostSectionProps = Readonly<{
  timeRange: TimeRange;
  userGroupId: string;
  userId: string;
  enabled: boolean;
}>;

export default function CostSection({ timeRange, userGroupId, userId, enabled }: CostSectionProps) {

  const costForm = useForm<CostQuery>({
    initialValues: costInitialValues,
    validate: zodResolver(costQuery),
  });

  const {
    data: getUsageRecords,
    isFetching: getUsageRecordsIsFetching,
    error: getUsageRecordsError,
  } = useGetUsageRecords(
    costForm.values.initiatedBy,
    costForm.values.aiProvider,
    costForm.values.model,
    timeRange,
    userGroupId,
    userId,
    enabled,
  );

  // With no submit handler left to catch it, a failed fetch would otherwise show
  // an empty table and no explanation.
  useEffect(() => {
    if (getUsageRecordsError) {
      notifications.show({
        id: 'cost-error',
        title: 'Unable to Fetch Cost Data',
        message: getUsageRecordsError.message ?? 'There was a problem retrieving cost data',
        autoClose: false,
        withCloseButton: true,
        icon: <IconX />,
        variant: 'failed_operation',
      });
    }
  }, [getUsageRecordsError]);

  const handleDownload = async () => {
    const body = JSON.stringify({
      initiatedBy: costForm.values.initiatedBy,
      aiProvider: costForm.values.aiProvider,
      model: costForm.values.model,
      timeRange,
      userGroupId,
      userId,
    });

    const response = await fetch('/api/reports/provider-usage-records', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
    });
    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = contentDisposition?.split('filename=')[1]?.trim() ?? '';
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } else {
      const errorData = await response.json();
      notifications.show({
        id: 'download-error',
        title: 'Download Failed',
        message: errorData.error || 'An error occurred while downloading the CSV',
        autoClose: false,
        withCloseButton: true,
        icon: <IconX />,
        variant: 'failed_operation',
      });
    }
  };

  return (
    <Stack py='lg' px='md' spacing='lg'>
      <Group align='end'>
        <InitiatedByInput form={costForm} />
        <AiProviderInput form={costForm} />
        <ModelInput form={costForm} />
        <Button
          variant='default'
          c='gray.6'
          leftIcon={<IconDownload />}
          onClick={handleDownload}
          disabled={!getUsageRecords || getUsageRecordsIsFetching}
        >
          Download
        </Button>
      </Group>
      <AiProviderUsageResults results={getUsageRecords} />
    </Stack>
  );
}
