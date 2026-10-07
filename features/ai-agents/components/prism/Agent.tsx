import { useState, useEffect, useCallback, useMemo } from 'react';
import ExcelJS from 'exceljs';
import {
  Stack,
  Text,
  Box,
  Center,
  Title,
  Badge,
  Group,
  Button,
  Loader,
  Accordion,
  Select,
  ThemeIcon,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconAlertCircle,
  IconX,
  IconCheck,
  IconFileSpreadsheet,
  IconFileDescription,
  IconChecklist,
} from '@tabler/icons-react';
import { TRPCClientError } from '@trpc/client';

import Form, { PrismFormValues } from './Form';
import ResultsTable from './ResultsTable';
import { usePrism } from '@/features/ai-agents/hooks/prism/usePrism';
import usePrismJobs from '@/features/ai-agents/api/prism/get-prism-jobs';
import usePrismResults from '@/features/ai-agents/api/prism/get-prism-results';
import { ComplianceStatus } from '@/features/ai-agents/types/prism/complianceResult';
import type { ComplianceResult } from '@/features/ai-agents/types/prism/complianceResult';
import { useUserGroupAttribution } from '@/features/shared/hooks/userGroupAttribution/useUserGroupAttribution';

type AgentProps = Readonly<{
  id: string;
}>;

export default function Agent({ id }: AgentProps) {
  const [viewingJobId, setViewingJobId] = useState<string | null>(null);
  const [showCitations, setShowCitations] = useState(false);
  const [formResetKey, setFormResetKey] = useState(0);

  const {
    analyzeDocument,
    reset: resetPrism,
    isProcessing: isWorking,
    progress,
    results: currentResults,
    completedJobId,
    error: _analysisError,
  } = usePrism(id, {
    onComplete: () => {
      setFormResetKey((k) => k + 1);
      notifications.show({
        title: 'Analysis Complete',
        message: '',
        icon: <IconCheck />,
        color: 'green',
      });
    },
    onError: (error) => {
      notifications.show({
        title: 'Analysis Failed',
        message: error || 'An error occurred during analysis.',
        icon: <IconX />,
        color: 'red',
      });
    },
  });

  const { gate: gateUserGroupAttribution } = useUserGroupAttribution();

  const { data: jobsData, refetch: refetchJobs } = usePrismJobs(id);

  // When a new job completes, refetch job history and default to viewing it
  useEffect(() => {
    if (completedJobId) {
      refetchJobs();
      setViewingJobId(completedJobId);
    }
  }, [completedJobId, refetchJobs]);

  // Results for a past job the user has selected
  const { data: pastJobResultsData } = usePrismResults(
    id,
    viewingJobId && viewingJobId !== completedJobId ? viewingJobId : null,
  );

  // Use current session results if available, otherwise use past job results
  const activeResults: ComplianceResult[] | null = useMemo(() => {
    if (viewingJobId === completedJobId && currentResults) {
      return currentResults;
    }
    if (pastJobResultsData?.results) {
      return pastJobResultsData.results;
    }
    return null;
  }, [viewingJobId, completedJobId, currentResults, pastJobResultsData]);

  const completedJobs = useMemo(() => {
    return jobsData?.jobs.filter((j) => j.status === 'completed') ?? [];
  }, [jobsData]);

  const summaryStats = useMemo(() => {
    if (!activeResults) {
      return null;
    }
    return {
      total: activeResults.length,
      yes: activeResults.filter((r) => r.complianceStatus === ComplianceStatus.YES).length,
      no: activeResults.filter((r) => r.complianceStatus === ComplianceStatus.NO).length,
      notApplicable: activeResults.filter((r) => r.complianceStatus === ComplianceStatus.NOT_APPLICABLE).length,
      needsReview: activeResults.filter((r) => r.complianceStatus === ComplianceStatus.NEEDS_REVIEW).length,
    };
  }, [activeResults]);

  const handleSubmit = useCallback(async (data: PrismFormValues) => {
    const { requirementsFile, proposalFile } = data;
    if (!requirementsFile || !proposalFile) {
      notifications.show({
        title: 'Error',
        message: 'Please select both files.',
        icon: <IconX />,
        color: 'red',
      });
      return;
    }

    resetPrism();
    setViewingJobId(null);

    try {
      await gateUserGroupAttribution(data.model, async (userGroupId) => {
        await analyzeDocument({
          requirementsFile,
          proposalFile,
          modelId: data.model,
          userGroupId,
        });
      });
    } catch (error) {
      let message = 'Failed to start analysis';
      if (error instanceof TRPCClientError || error instanceof Error) {
        message = error.message;
      }

      notifications.show({
        title: 'Error',
        message,
        icon: <IconX />,
        color: 'red',
      });
    }
  }, [analyzeDocument, resetPrism, gateUserGroupAttribution]);

  const handleExport = useCallback(async () => {
    if (!activeResults) {
      return;
    }

    const hasCats = activeResults.some((r) => r.category !== null);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('PRISM Analysis');

    sheet.columns = [
      ...(hasCats ? [{ header: 'Category', key: 'category', width: 20 }] : []),
      { header: 'Requirement', key: 'requirement', width: 50 },
      { header: 'Compliance Status', key: 'complianceStatus', width: 18 },
      { header: 'Reasoning', key: 'reasoning', width: 60 },
      ...(showCitations ? [{ header: 'Citations', key: 'citations', width: 40 }] : []),
    ];

    sheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true };
    });

    activeResults.forEach((item) => {
      const row: Record<string, string> = {
        ...(hasCats ? { category: item.category ?? '' } : {}),
        requirement: item.requirement,
        complianceStatus: item.complianceStatus,
        reasoning: item.reasoning,
        ...(showCitations ? { citations: item.citations ?? '' } : {}),
      };
      sheet.addRow(row);
    });

    sheet.eachRow((row) => {
      row.alignment = { wrapText: true, vertical: 'top' };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'prism-analysis.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [activeResults, showCitations]);

  return (
    <Stack spacing='xl'>
      <div>
        <Title order={1} mb='sm'>Proposal Compliance Analysis</Title>
        <Text size='lg' color='dimmed'>
          Upload a requirements spreadsheet and proposal document to evaluate compliance.
        </Text>
      </div>

      {/* Upload form in collapsible accordion */}
      <Accordion variant='contained'>
        <Accordion.Item value='upload'>
          <Accordion.Control icon={<IconFileDescription size={16} />}>
            Analyze Proposal
          </Accordion.Control>
          <Accordion.Panel>
            <Box p='sm'>
              <Form
                key={formResetKey}
                agentId={id}
                onSubmit={handleSubmit}
                isLoading={isWorking}
              />
            </Box>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>

      {/* Progress indicator */}
      {isWorking && (
        <Group position='center' mt='md'>
          <Loader />
          <Stack spacing='xs'>
            <Text>Analyzing proposal...</Text>
            <Text size='sm' color='dimmed'>
              {progress || 'AI analysis will be generated after processing completes'}
            </Text>
          </Stack>
        </Group>
      )}

      {/* Results panel — shown once there are completed analyses */}
      {completedJobs.length > 0 && (
        <Stack bg='dark.6' p='lg' spacing='md'>
          <Group spacing='xs'>
            <ThemeIcon size='sm'>
              <IconChecklist style={{ pointerEvents: 'none' }} />
            </ThemeIcon>
            <Title order={2}>Compliance Results</Title>
          </Group>

          <Group align='flex-end' position='apart' spacing='md'>
            <Select
              w='60%'
              label='Analysis'
              placeholder='Select an analysis'
              data={completedJobs.map((job) => ({
                value: job.id,
                label: `${job.proposalFilename} · ${new Date(job.createdAt).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}`,
              }))}
              value={viewingJobId}
              onChange={(v) => setViewingJobId(v)}
              size='sm'
              clearable
            />
            <Button
              mt='sm'
              leftIcon={<IconFileSpreadsheet />}
              variant='outline'
              onClick={handleExport}
              disabled={!activeResults}
            >
              Export Excel
            </Button>
          </Group>

          {activeResults && (
            <Stack spacing='md'>
              {summaryStats && (
                <Group spacing='lg'>
                  <Text size='sm' fw={500}>
                    Total: {summaryStats.total}
                  </Text>
                  <Badge size='lg' color='green.6' variant='filled' c='black'>
                    Yes: {summaryStats.yes}
                  </Badge>
                  <Badge size='lg' color='red.6' variant='filled' c='black'>
                    No: {summaryStats.no}
                  </Badge>
                  <Badge size='lg' color='yellow.6' variant='filled' c='black'>
                    Needs Review: {summaryStats.needsReview}
                  </Badge>
                  <Badge size='lg' color='gray.6' variant='filled' c='black'>
                    N/A: {summaryStats.notApplicable}
                  </Badge>
                </Group>
              )}
              <ResultsTable
                items={activeResults}
                showCitations={showCitations}
                onShowCitationsChange={setShowCitations}
              />
            </Stack>
          )}

          {viewingJobId && !activeResults && (
            <Group spacing='sm'>
              <Loader size='sm' />
              <Text size='sm' color='dimmed'>Loading results...</Text>
            </Group>
          )}

        </Stack>
      )}

      {!isWorking && completedJobs.length === 0 && (
        <Box py='xl'>
          <Center>
            <Stack align='center' spacing='md'>
              <IconAlertCircle size={48} color='gray' />
              <Text size='lg' color='dimmed'>
                Upload documents to begin compliance analysis
              </Text>
            </Stack>
          </Center>
        </Box>
      )}
    </Stack>
  );
}
