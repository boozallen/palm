import { useEffect, useRef, useState } from 'react';
import { Badge, Button, Group, Select, Stack, Table, Text, Title } from '@mantine/core';
import { IconFlask } from '@tabler/icons-react';

import useTestPulseRow from '@/features/ai-agents/api/pulse/test-pulse-row';
import showPulseError from '@/features/ai-agents/utils/pulse/showPulseError';
import { useUserGroupAttribution } from '@/features/shared/hooks/userGroupAttribution/useUserGroupAttribution';
import type {
  ParsedSurveyRow,
  PulseExtractedValue,
  PulseFieldConfig,
} from '@/features/ai-agents/types/pulse/surveyAnalysis';

type TestRowPanelProps = Readonly<{
  agentId: string;
  modelId: string;
  persona: string;
  fields: PulseFieldConfig[];
  rows: ParsedSurveyRow[];
  disabledReason: string | null;
}>;

export default function TestRowPanel({
  agentId,
  modelId,
  persona,
  fields,
  rows,
  disabledReason,
}: TestRowPanelProps) {
  const [selectedRow, setSelectedRow] = useState<string | null>(null);
  const [values, setValues] = useState<PulseExtractedValue[] | null>(null);
  const { mutateAsync, isPending } = useTestPulseRow();
  const { gate: gateUserGroupAttribution } = useUserGroupAttribution();

  const effectiveRow = selectedRow ?? (rows.length > 0 ? String(rows[0].rowNumber) : null);
  const effectiveRowData = rows.find((candidate) => String(candidate.rowNumber) === effectiveRow) ?? null;

  // The result describes one exact matrix, model, persona and row; any change to those makes it stale.
  const resultKey = JSON.stringify({
    row: effectiveRowData,
    fields,
    modelId,
    persona,
  });
  const activeResultKey = useRef(resultKey);

  // A selection that no longer exists (e.g. after a header-row change) falls back to the first row.
  useEffect(() => {
    if (selectedRow !== null && !rows.some((candidate) => String(candidate.rowNumber) === selectedRow)) {
      setSelectedRow(null);
    }
  }, [rows, selectedRow]);

  // Drops the rendered result the moment anything it depends on changes.
  useEffect(() => {
    if (activeResultKey.current !== resultKey) {
      activeResultKey.current = resultKey;
      setValues(null);
    }
  }, [resultKey]);

  const handleRowChange = (row: string | null) => {
    setSelectedRow(row);
  };

  const handleRun = async () => {
    const row = effectiveRowData;

    if (!row) {
      return;
    }

    const runKey = resultKey;

    try {
      await gateUserGroupAttribution(modelId, async (userGroupId) => {
        const result = await mutateAsync({
          agentId,
          modelId,
          persona,
          rowNumber: row.rowNumber,
          cells: Object.values(row.cells),
          fields,
          userGroupId,
        });

        // A response for a matrix or row the user has since changed is not this result.
        if (activeResultKey.current === runKey) {
          setValues(result.values);
        }
      });
    } catch (error) {
      if (activeResultKey.current !== runKey) {
        return;
      }

      setValues(null);
      showPulseError(error, 'Test failed');
    }
  };

  return (
    <Stack spacing='md'>
      <Title order={4}>Test one response</Title>
      <Text size='sm' c='gray.4'>
        Runs the columns above against a single response. Nothing is saved.
      </Text>

      <Group align='flex-end'>
        <Select
          data-testid='pulse-test-row'
          label='Response'
          data={rows.map((row) => ({
            value: String(row.rowNumber),
            label: `Row ${row.rowNumber}`,
          }))}
          value={effectiveRow}
          onChange={handleRowChange}
          w='40%'
        />
        <Button
          data-testid='pulse-test-run'
          leftIcon={<IconFlask />}
          loading={isPending}
          disabled={Boolean(disabledReason) || isPending}
          onClick={handleRun}
        >
          Test
        </Button>
      </Group>

      {disabledReason && (
        <Text data-testid='pulse-test-disabled-reason' size='sm' c='gray.4'>
          {disabledReason}
        </Text>
      )}

      {values && (
        <Table>
          <thead>
            <tr>
              <th>Column</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {values.map((value) => (
              <tr data-testid='pulse-test-result' key={value.fieldName}>
                <td>{value.fieldName}</td>
                <td>
                  <Stack spacing='xxs'>
                    <Text size='sm'>{value.value || '—'}</Text>
                    {value.wasDefaulted && (
                      <Badge data-testid='pulse-test-defaulted' color='yellow.6' variant='filled' c='black'>
                        Fell back to default
                      </Badge>
                    )}
                    {value.failureReason && (
                      <Text data-testid='pulse-test-failure-reason' size='xs' c='gray.4'>
                        {value.failureReason}
                      </Text>
                    )}
                  </Stack>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Stack>
  );
}
