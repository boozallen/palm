import { useState } from 'react';
import {
  Accordion,
  Box,
  Button,
  Group,
  Paper,
  Select,
  Stack,
  Tabs,
  Text,
  ThemeIcon,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { IconChevronRight } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { IconChartBar, IconFileSpreadsheet } from '@tabler/icons-react';

import UploadFinancialsForm from './UploadFinancialsForm';
import TaskOrderSummaryTable from './TaskOrderSummaryTable';
import MonthClinsView from './MonthClinsView';
import TmProfitTable from './TmProfitTable';
import { useGetMarginAnalyses } from '@/features/ai-agents/api/margin/get-margin-analyses';
import { useGetMarginAnalysis } from '@/features/ai-agents/api/margin/get-margin-analysis';
import useExportMarginAnalysis from '@/features/ai-agents/api/margin/export-margin-analysis';
import { downloadExportedFile } from '@/features/ai-agents/utils/rcast/downloadFile';
import type { MarginAnalysisResult } from '@/features/ai-agents/types/margin';

type AgentProps = Readonly<{
  id: string;
}>;

export default function Agent({ id }: AgentProps) {
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string | null>(null);
  const [selectedTaskOrder, setSelectedTaskOrder] = useState<string | null>(null);

  const { data: analyses } = useGetMarginAnalyses(id);
  const { data: analysisRecord } = useGetMarginAnalysis(id, selectedAnalysisId);

  const exportMutation = useExportMarginAnalysis();

  const handleUploadComplete = (analysisId: string, _result: MarginAnalysisResult) => {
    setSelectedAnalysisId(analysisId);
    setSelectedTaskOrder(null);
  };

  const handleSelectAnalysis = (value: string | null) => {
    setSelectedAnalysisId(value);
    setSelectedTaskOrder(null);
  };

  const handleSelectTaskOrder = (taskOrder: string) => {
    setSelectedTaskOrder(taskOrder);
  };

  const handleNavAll = () => {
    setSelectedTaskOrder(null);
  };

  const handleExport = async () => {
    if (!selectedAnalysisId) {
      return;
    }
    try {
      const result = await exportMutation.mutateAsync({
        aiAgentId: id,
        analysisId: selectedAnalysisId,
      });
      downloadExportedFile(result.data, result.filename, result.mimeType);
    } catch (error) {
      notifications.show({
        title: 'Export Failed',
        message: error instanceof Error ? error.message : 'Failed to export analysis.',
        color: 'red',
      });
    }
  };

  const activeResult = analysisRecord
    ? {
        flaggedJobs: analysisRecord.flaggedJobs,
        taskOrderSummaries: analysisRecord.taskOrderSummaries,
        tmProfitRanking: analysisRecord.tmProfitRanking,
        totalJobsAnalyzed: analysisRecord.totalJobsAnalyzed,
        totalFlaggedJobs: analysisRecord.totalFlaggedJobs,
      }
    : null;

  const selectedSummary = activeResult && selectedTaskOrder
    ? activeResult.taskOrderSummaries.find((s) => s.taskOrder === selectedTaskOrder) ?? null
    : null;

  return (
    <Stack spacing='xl'>
      {/* Header */}
      <div>
        <Title order={1} mb='sm'>
          Margin Analysis
        </Title>
        <Text size='lg' color='dimmed'>
          Flag low-margin and at-risk jobs from FF Financials data. No AI — pure
          computation.
        </Text>
      </div>

      {/* Upload Section */}
      <Accordion variant='contained'>
        <Accordion.Item value='upload'>
          <Accordion.Control icon={<IconFileSpreadsheet size={16} />}>
            Upload Financials
          </Accordion.Control>
          <Accordion.Panel>
            <UploadFinancialsForm aiAgentId={id} onComplete={handleUploadComplete} />
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>

      {/* Analysis results section */}
      {analyses && analyses.length > 0 && (
        <Stack bg='dark.6' p='lg' spacing='md'>
          <Group align='center' spacing='xs' mb='xs'>
            <ThemeIcon size='sm'>
              <IconChartBar style={{ pointerEvents: 'none' }} />
            </ThemeIcon>
            <Title order={2}>Analysis Results</Title>
          </Group>

          <Group align='center'>
            <Select
              w='50%'
              label='Past Analyses'
              placeholder='Select an analysis run'
              data={
                analyses.map((a) => ({
                  value: a.id,
                  label: `${a.filename} • ${new Date(a.analysisAsOf).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })} • ${a.totalFlaggedJobs} flagged`,
                }))
              }
              value={selectedAnalysisId}
              onChange={handleSelectAnalysis}
              size='sm'
              clearable
            />
            <Button
              mt='sm'
              leftIcon={<IconFileSpreadsheet />}
              variant='outline'
              onClick={handleExport}
              loading={exportMutation.isPending}
              disabled={!selectedAnalysisId}
            >
              Export to Excel
            </Button>
          </Group>

          {activeResult && (
            <Stack spacing='lg'>
              <Group spacing='lg'>
                <Text size='sm' color='dimmed'>
                  Jobs analyzed:{' '}
                  <Text component='span' weight={600}>
                    {activeResult.totalJobsAnalyzed}
                  </Text>
                </Text>
                <Text size='sm' color='dimmed'>
                  Flagged jobs:{' '}
                  <Text component='span' weight={600} color='orange'>
                    {activeResult.totalFlaggedJobs}
                  </Text>
                </Text>
                <Text size='sm' color='dimmed'>
                  Flagged months:{' '}
                  <Text component='span' weight={600} color='orange'>
                    {activeResult.flaggedJobs.length}
                  </Text>
                </Text>
              </Group>

              <Tabs defaultValue='flagged'>
                <Tabs.List>
                  <Tabs.Tab value='flagged'>Flagged Analysis</Tabs.Tab>
                  <Tabs.Tab value='tm'>T&amp;M / FFP Profit Ranking</Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value='flagged' pt='md'>
                  <Stack spacing='md'>
                    {/* Drill-down navigation */}
                    <Group spacing={4} align='stretch'>
                      <UnstyledButton onClick={handleNavAll}>
                        <Paper
                          p='xs'
                          withBorder
                          sx={(theme) => ({
                            borderColor: !selectedTaskOrder ? theme.colors.blue[5] : undefined,
                            '&:hover': { borderColor: theme.colors.blue[4] },
                          })}
                        >
                          <Text size='xs' color='dimmed'>View</Text>
                          <Text size='sm' weight={600} color={!selectedTaskOrder ? 'blue' : undefined}>
                            All Task Orders
                          </Text>
                        </Paper>
                      </UnstyledButton>

                      {selectedTaskOrder && (
                        <>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <IconChevronRight size={16} />
                          </Box>
                          <Paper
                            p='xs'
                            withBorder
                            sx={(theme) => ({ borderColor: theme.colors.blue[5] })}
                          >
                            <Text size='xs' color='dimmed'>Task Order</Text>
                            <Text size='sm' weight={600} color='blue'>{selectedTaskOrder}</Text>
                            {selectedSummary && (
                              <Text size='xs' color='dimmed'>{selectedSummary.taskTitle}</Text>
                            )}
                          </Paper>
                        </>
                      )}
                    </Group>

                    {!selectedTaskOrder && (
                      <TaskOrderSummaryTable
                        summaries={activeResult.taskOrderSummaries}
                        onSelect={handleSelectTaskOrder}
                      />
                    )}

                    {selectedTaskOrder && (
                      <MonthClinsView
                        taskOrder={selectedTaskOrder}
                        flaggedJobs={activeResult.flaggedJobs}
                      />
                    )}
                  </Stack>
                </Tabs.Panel>

                <Tabs.Panel value='tm' pt='md'>
                  <TmProfitTable rows={activeResult.tmProfitRanking} />
                </Tabs.Panel>
              </Tabs>
            </Stack>
          )}
        </Stack>
      )}
    </Stack>
  );
}
