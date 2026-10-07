import { useState, useMemo } from 'react';
import { Button, Group, Stack, TextInput, Select, Tooltip } from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconSearch, IconX, IconDownload } from '@tabler/icons-react';

import ErrorRecordsTable from './ErrorRecordsTable';
import useGetErrorRecords from '@/features/settings/api/error-records/get-error-records';
import {
  errorRecordsInitialValues,
  ErrorRecordsQuery,
  errorRecordsQuery,
  ErrorRecordSourceOptions,
  ErrorRecordCodeOptions,
} from '@/features/shared/types/error-record';

export default function ErrorRecords() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formSubmittedValues, setFormSubmittedValues] = useState<ErrorRecordsQuery>(
    errorRecordsInitialValues
  );

  const errorRecordsForm = useForm<ErrorRecordsQuery>({
    // The query type uses `undefined` for an absent filter, but an input seeded
    // with `undefined` starts uncontrolled and flips on the first keystroke.
    // Seed the filter fields empty; handleSubmit maps them back to `undefined`.
    initialValues: {
      ...errorRecordsInitialValues,
      search: '',
      source: '',
      code: '',
    },
    validate: zodResolver(errorRecordsQuery),
  });

  const {
    data: errorRecordsData,
    isFetching: errorRecordsIsFetching,
    refetch: errorRecordsRefetch,
    error: errorRecordsError,
  } = useGetErrorRecords(formSubmittedValues, isSubmitted);

  const handleSubmit = async (values: ErrorRecordsQuery) => {
    setIsSubmitted(true);
    setFormSubmittedValues({
      source: values.source || undefined,
      code: values.code || undefined,
      search: values.search || undefined,
      page: 1,
      pageSize: values.pageSize,
    });
    try {
      await errorRecordsRefetch();
    } catch (error) {
      notifications.show({
        id: 'error-records-error',
        title: 'Unable to Fetch Error Records',
        message: errorRecordsError?.message ?? 'There was a problem retrieving error records',
        autoClose: false,
        withCloseButton: true,
        icon: <IconX />,
        variant: 'failed_operation',
      });
    }
  };

  const handlePageChange = (newPage: number) => {
    setFormSubmittedValues((prev) => ({ ...prev, page: newPage }));
  };

  const handleClear = () => {
    errorRecordsForm.reset();
    setIsSubmitted(false);
    setFormSubmittedValues(errorRecordsInitialValues);
  };

  const handleDownload = async () => {
    const body = JSON.stringify({
      source: formSubmittedValues.source,
      code: formSubmittedValues.code,
      search: formSubmittedValues.search,
    });

    const response = await fetch('/api/reports/error-records', {
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
      let filename = contentDisposition?.split('filename=')[1]?.trim() ?? 'error-records.csv';
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
        message: errorData.error || 'An error occurred while downloading the file',
        autoClose: false,
        withCloseButton: true,
        icon: <IconX />,
        variant: 'failed_operation',
      });
    }
  };

  const errorRecords = useMemo(
    () =>
      errorRecordsData?.records.map((record) => ({
        ...record,
        timestamp: new Date(record.timestamp),
      })),
    [errorRecordsData?.records],
  );

  // The export covers whatever the table is showing, so zero rows means there
  // is nothing to download.
  const hasRecords = (errorRecords?.length ?? 0) > 0;

  // Clearing is only meaningful once a filter is set or a search has run.
  const { search, source, code } = errorRecordsForm.values;
  const hasFiltersToClear = isSubmitted || !!search || !!source || !!code;

  return (
    <Stack py='lg' px='md' spacing='lg'>
      <form onSubmit={errorRecordsForm.onSubmit(handleSubmit)}>
        <Group align='end'>
          <TextInput
            label='Search'
            placeholder='Message, route, user, email'
            mb='0'
            sx={{ flex: 1 }}
            {...errorRecordsForm.getInputProps('search')}
          />
          <Select
            label='Source'
            placeholder='All Sources'
            data={ErrorRecordSourceOptions}
            mb='0'
            {...errorRecordsForm.getInputProps('source')}
            clearable
          />
          <Select
            label='Code'
            placeholder='All Codes'
            data={ErrorRecordCodeOptions}
            mb='0'
            {...errorRecordsForm.getInputProps('code')}
            clearable
          />
          <Button
            type='submit'
            leftIcon={<IconSearch />}
            disabled={!errorRecordsForm.isValid()}
            loading={errorRecordsIsFetching}
          >
            {errorRecordsIsFetching ? 'Searching' : 'Search'}
          </Button>
          <Tooltip label='Clear filters'>
            <Button
              variant='default'
              c='gray.6'
              px='sm'
              aria-label='Clear filters'
              onClick={handleClear}
              disabled={!hasFiltersToClear}
            >
              <IconX />
            </Button>
          </Tooltip>
          <Tooltip label='Download report'>
            <Button
              variant='default'
              c='gray.6'
              px='sm'
              aria-label='Download report'
              onClick={handleDownload}
              disabled={!hasRecords}
            >
              <IconDownload />
            </Button>
          </Tooltip>
        </Group>
      </form>
      <ErrorRecordsTable
        records={errorRecords ?? []}
        totalCount={errorRecordsData?.totalCount ?? 0}
        currentPage={formSubmittedValues.page}
        pageSize={formSubmittedValues.pageSize}
        onPageChange={handlePageChange}
        isLoading={errorRecordsIsFetching}
        isSubmitted={isSubmitted}
      />
    </Stack>
  );
}
