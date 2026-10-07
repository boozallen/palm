import { useState, useMemo } from 'react';
import { Button, Group, Stack, TextInput, Select, Tooltip } from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconSearch, IconX, IconDownload } from '@tabler/icons-react';

import AuditRecordsTable from './AuditRecordsTable';
import useGetAuditRecords from '@/features/settings/api/audit-records/get-audit-records';
import {
  auditRecordsInitialValues,
  AuditRecordsQuery,
  auditRecordsQuery,
  AuditRecordEventOptions,
  AuditRecordOutcomeOptions,
} from '@/features/shared/types/audit-record';

export default function AuditRecords() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formSubmittedValues, setFormSubmittedValues] = useState<AuditRecordsQuery>(
    auditRecordsInitialValues
  );

  const auditRecordsForm = useForm<AuditRecordsQuery>({
    // The query type uses `undefined` for an absent filter, but an input seeded
    // with `undefined` starts uncontrolled and flips on the first keystroke.
    // Seed the filter fields empty; handleSubmit maps them back to `undefined`.
    initialValues: {
      ...auditRecordsInitialValues,
      search: '',
      event: '',
      outcome: '',
    },
    validate: zodResolver(auditRecordsQuery),
  });

  const {
    data: auditRecordsData,
    isFetching: auditRecordsIsFetching,
    refetch: auditRecordsRefetch,
    error: auditRecordsError,
  } = useGetAuditRecords(formSubmittedValues, isSubmitted);

  const handleSubmit = async (values: AuditRecordsQuery) => {
    setIsSubmitted(true);
    setFormSubmittedValues({
      event: values.event || undefined,
      outcome: values.outcome || undefined,
      search: values.search || undefined,
      page: 1,
      pageSize: values.pageSize,
    });
    try {
      await auditRecordsRefetch();
    } catch (error) {
      notifications.show({
        id: 'audit-records-error',
        title: 'Unable to Fetch Audit Records',
        message: auditRecordsError?.message ?? 'There was a problem retrieving audit records',
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
    auditRecordsForm.reset();
    setIsSubmitted(false);
    setFormSubmittedValues(auditRecordsInitialValues);
  };

  const handleDownload = async () => {
    const body = JSON.stringify({
      event: formSubmittedValues.event,
      outcome: formSubmittedValues.outcome,
      search: formSubmittedValues.search,
    });

    const response = await fetch('/api/reports/audit-records', {
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
      let filename = contentDisposition?.split('filename=')[1]?.trim() ?? 'audit-records.xlsx';
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

  const auditRecords = useMemo(
    () =>
      auditRecordsData?.records.map((record) => ({
        ...record,
        timestamp: new Date(record.timestamp),
      })),
    [auditRecordsData?.records],
  );

  // The export covers whatever the table is showing, so zero rows means there
  // is nothing to download.
  const hasRecords = (auditRecords?.length ?? 0) > 0;

  // Clearing is only meaningful once a filter is set or a search has run.
  const { search, event, outcome } = auditRecordsForm.values;
  const hasFiltersToClear = isSubmitted || !!search || !!event || !!outcome;

  return (
    <Stack py='lg' px='md' spacing='lg'>
      <form onSubmit={auditRecordsForm.onSubmit(handleSubmit)}>
        {/* Same filter row shape as the analytics page: natural-width inputs, a
            filled submit, then secondary `default` buttons. Search takes the
            slack as the only free-text field. */}
        <Group align='end'>
          <TextInput
            label='Search'
            placeholder='Description, event, user, email'
            mb='0'
            sx={{ flex: 1 }}
            {...auditRecordsForm.getInputProps('search')}
          />
          <Select
            label='Event'
            placeholder='All Events'
            data={AuditRecordEventOptions}
            mb='0'
            {...auditRecordsForm.getInputProps('event')}
            clearable
          />
          <Select
            label='Outcome'
            placeholder='All Outcomes'
            data={AuditRecordOutcomeOptions}
            mb='0'
            {...auditRecordsForm.getInputProps('outcome')}
            clearable
          />
          <Button
            type='submit'
            leftIcon={<IconSearch />}
            disabled={!auditRecordsForm.isValid()}
            loading={auditRecordsIsFetching}
          >
            {auditRecordsIsFetching ? 'Searching' : 'Search'}
          </Button>
          {/* Icon-only from here: the labels repeated the icons. Buttons rather
              than ActionIcons so the height and `default` treatment match
              Search beside them. */}
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
      <AuditRecordsTable
        records={auditRecords ?? []}
        totalCount={auditRecordsData?.totalCount ?? 0}
        currentPage={formSubmittedValues.page}
        pageSize={formSubmittedValues.pageSize}
        onPageChange={handlePageChange}
        isLoading={auditRecordsIsFetching}
        isSubmitted={isSubmitted}
      />
    </Stack>
  );
}
