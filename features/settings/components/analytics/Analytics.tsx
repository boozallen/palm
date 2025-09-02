import { useState } from 'react';
import { Button, Group, Stack } from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconDownload, IconSearch, IconX } from '@tabler/icons-react';

import InitiatedByInput from './inputs/InitiatedByInput';
import AiProviderInput from './inputs/AiProviderInput';
import ModelInput from './inputs/ModelInput';
import TimeInput from './inputs/TimeInput';
import AiProviderUsageResults from './AiProviderUsageResults';
import useGetUsageRecords from '@/features/settings/api/analytics/get-usage-records';
import { analyticsInitialValues, AnalyticsQuery, analyticsQuery } from '@/features/settings/types/analytics';

export default function Analytics() {

  const [isSubmitted, setIsSubmitted] = useState(false);

  const [formSubmittedValues, setFormSubmittedValues] = useState<AnalyticsQuery>(
    analyticsInitialValues
  );

  const analyticsForm = useForm<AnalyticsQuery>({
    initialValues: analyticsInitialValues,
    validate: zodResolver(analyticsQuery),
  });

  const {
    data: getUsageRecords,
    isFetching: getUsageRecordsIsFetching,
    refetch: getUsageRecordsRefetch,
    error: getUsageRecordsError,
  } = useGetUsageRecords(
    formSubmittedValues.initiatedBy,
    formSubmittedValues.aiProvider,
    formSubmittedValues.model,
    formSubmittedValues.timeRange,
    isSubmitted
  );

  const handleSubmit = async (values: AnalyticsQuery) => {
    setIsSubmitted(true);
    setFormSubmittedValues({
      initiatedBy: values.initiatedBy,
      aiProvider: values.aiProvider,
      model: values.model,
      timeRange: values.timeRange,
    });
    try {
      await getUsageRecordsRefetch();
    } catch (error) {
      notifications.show({
        id: 'analytics-error',
        title: 'Unable to Fetch Analytics',
        message: getUsageRecordsError?.message ?? 'There was a problem retrieving analytics data',
        autoClose: false,
        withCloseButton: true,
        icon: <IconX />,
        variant: 'failed_operation',
      });
    } finally {
      setIsSubmitted(false);
    }
  };

  const handleDownload = async () => {
    const body = JSON.stringify({
      initiatedBy: formSubmittedValues.initiatedBy,
      aiProvider: formSubmittedValues.aiProvider,
      model: formSubmittedValues.model,
      timeRange: formSubmittedValues.timeRange,
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
    <Stack py='lg' px='xl' spacing='lg'>
      <form onSubmit={analyticsForm.onSubmit(handleSubmit)}>
        <Group align='end'>
          <InitiatedByInput form={analyticsForm} />
          <AiProviderInput form={analyticsForm} />
          <ModelInput form={analyticsForm} />
          <TimeInput form={analyticsForm} />
          <Button
            type='submit'
            leftIcon={<IconSearch />}
            disabled={!analyticsForm.isValid()}
            loading={getUsageRecordsIsFetching}
          >
            {getUsageRecordsIsFetching ? 'Searching' : 'Search'}
          </Button>
          <Button
            variant='default'
            c='gray.6'
            leftIcon={<IconDownload />}
            onClick={handleDownload}
            disabled={!getUsageRecords}
          >
            Download
          </Button>
        </Group>
      </form>
      <AiProviderUsageResults results={getUsageRecords} />
    </Stack>
  );
}
