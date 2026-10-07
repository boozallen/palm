import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Stack,
  Text,
  Center,
  Box,
  Paper,
  Title,
  Badge,
  Group,
  Button,
  Progress,
  Select,
  Loader,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconAlertCircle,
  IconX,
  IconCheck,
  IconShieldCheck,
  IconFileSpreadsheet,
} from '@tabler/icons-react';
import { TRPCClientError } from '@trpc/client';
import * as ExcelJS from 'exceljs';

import Form, { OdramAnalysisFormValues } from './Form';
import QuestionResult from './QuestionResult';
import { useOdram } from '@/features/ai-agents/hooks/odram/useOdram';
import useOdramJobs from '@/features/ai-agents/api/odram/get-odram-jobs';
import useOdramResults from '@/features/ai-agents/api/odram/get-odram-results';
import type { OdramQuestionResult } from '@/features/ai-agents/types/odram/analysisResult';
import { useUserGroupAttribution } from '@/features/shared/hooks/userGroupAttribution/useUserGroupAttribution';

type AgentProps = Readonly<{
  id: string;
}>;

export default function Agent({ id }: AgentProps) {
  const [viewingJobId, setViewingJobId] = useState<string | null>(null);

  const {
    startOdramAnalysis,
    reset: resetOdram,
    isProcessing,
    progress,
    currentQuestion,
    totalQuestions,
    partialResults,
    results: currentResults,
    completedJobId,
    error: _analysisError,
  } = useOdram(id, {
    onComplete: (completedResults) => {
      if (completedResults.questions.length > 0) {
        notifications.show({
          title: 'ODRAM Analysis Complete',
          message: `${completedResults.questions.length} questions analyzed`,
          icon: <IconCheck />,
          color: 'green',
        });
      } else {
        notifications.show({
          title: 'Analysis Error',
          message: 'The analysis could not be completed. Please try again with a different model.',
          icon: <IconX />,
          color: 'red',
          autoClose: false,
        });
      }
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

  const { data: jobsData, refetch: refetchJobs } = useOdramJobs(id);

  // When a new job completes, refetch job history and default to viewing it
  useEffect(() => {
    if (completedJobId) {
      refetchJobs();
      setViewingJobId(completedJobId);
    }
  }, [completedJobId, refetchJobs]);

  // Results for a past job the user has selected
  const { data: pastJobData } = useOdramResults(
    id,
    viewingJobId && viewingJobId !== completedJobId ? viewingJobId : null,
  );

  const completedJobs = useMemo(() => {
    return jobsData?.jobs.filter((j) => j.status === 'completed') ?? [];
  }, [jobsData]);

  // Build the active question results: current session or fetched past job
  const activeQuestionResults: OdramQuestionResult[] | null = useMemo(() => {
    if (viewingJobId === completedJobId && currentResults) {
      return currentResults.questions as OdramQuestionResult[];
    }
    if (pastJobData?.results) {
      return pastJobData.results.map((r) => ({
        questionId: r.questionId,
        questionName: r.questionName,
        teamRating: r.teamRating,
        independentRating: r.independentRating,
        overallAssessment: r.overallAssessment,
        keyFeedback: JSON.parse(r.keyFeedback) as string[],
      })) as OdramQuestionResult[];
    }
    return null;
  }, [viewingJobId, completedJobId, currentResults, pastJobData]);

  const activeSummary: string | null = useMemo(() => {
    if (viewingJobId === completedJobId && currentResults) {
      return currentResults.summary;
    }
    if (pastJobData) {
      return pastJobData.summary;
    }
    return null;
  }, [viewingJobId, completedJobId, currentResults, pastJobData]);

  // During processing, show partial results
  const displayResults = isProcessing
    ? partialResults
    : activeQuestionResults;

  const summaryStats = useMemo(() => {
    if (!displayResults || displayResults.length === 0) {
      return null;
    }
    return {
      total: displayResults.length,
      low: displayResults.filter((r) => r.independentRating === 'Low').length,
      moderate: displayResults.filter((r) => r.independentRating === 'Moderate').length,
      high: displayResults.filter((r) => r.independentRating === 'High').length,
      divergent: displayResults.filter(
        (r) => r.independentRating.toLowerCase() !== r.teamRating.toLowerCase(),
      ).length,
    };
  }, [displayResults]);

  const handleSubmit = useCallback(async (data: OdramAnalysisFormValues) => {
    if (!data.odramFile || data.proposalFiles.length === 0) {
      notifications.show({
        title: 'Error',
        message: 'Please select all required files.',
        icon: <IconX />,
        color: 'red',
      });
      return;
    }

    resetOdram();
    setViewingJobId(null);

    try {
      await gateUserGroupAttribution(data.model, async (userGroupId) => {
        await startOdramAnalysis({
          promptMatrixFile: data.promptMatrixFile!,
          odramFile: data.odramFile!,
          proposalFiles: data.proposalFiles,
          modelId: data.model,
          documentMapping: data.documentMapping,
          questionContext: data.questionContext,
          userGroupId,
        });
      });
    } catch (error) {
      let message = 'Failed to process documents';
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
  }, [startOdramAnalysis, resetOdram, gateUserGroupAttribution]);

  const handleDownload = useCallback(async () => {
    if (!displayResults || displayResults.length === 0) {
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('ODRAM Analysis');

    worksheet.columns = [
      { header: 'Question', key: 'question', width: 10 },
      { header: 'Name', key: 'name', width: 40 },
      { header: 'Team Rating', key: 'teamRating', width: 16 },
      { header: 'Independent Rating', key: 'independentRating', width: 20 },
      { header: 'Divergent', key: 'divergent', width: 12 },
      { header: 'Overall Assessment', key: 'overallAssessment', width: 60 },
      { header: 'Key Feedback', key: 'keyFeedback', width: 60 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    for (const r of displayResults) {
      worksheet.addRow({
        question: `Q${r.questionId}`,
        name: r.questionName,
        teamRating: r.teamRating,
        independentRating: r.independentRating,
        divergent: r.independentRating.toLowerCase() !== r.teamRating.toLowerCase() ? 'YES' : 'NO',
        overallAssessment: r.overallAssessment,
        keyFeedback: r.keyFeedback.join('\n'),
      });
    }

    worksheet.getColumn('overallAssessment').alignment = { wrapText: true, vertical: 'top' };
    worksheet.getColumn('keyFeedback').alignment = { wrapText: true, vertical: 'top' };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'odram-analysis.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [displayResults]);

  const progressPercent = currentQuestion && totalQuestions
    ? Math.round((currentQuestion / totalQuestions) * 100)
    : 0;

  return (
    <Stack spacing='xl'>
      <div>
        <Title order={1} mb='sm'>ODRAM Risk Assessment</Title>
        <Text size='lg' color='dimmed'>
          Upload the team&apos;s ODRAM form and proposal documents to generate an independent risk assessment.
        </Text>
      </div>

      <Stack bg='dark.6' p='lg' spacing='xs'>
        <Form
          agentId={id}
          onSubmit={handleSubmit}
          isLoading={isProcessing}
        />
      </Stack>

      {/* Progress indicator during analysis */}
      {isProcessing && (
        <Paper bg='dark.7' p='lg' radius='md'>
          <Stack spacing='sm'>
            <Text size='sm' fw={500}>{progress}</Text>
            <Progress
              value={progressPercent}
              size='lg'
              animate
              color='blue'
            />
            {currentQuestion && totalQuestions && (
              <Text size='xs' c='dimmed'>
                Question {currentQuestion} of {totalQuestions}
              </Text>
            )}
          </Stack>
        </Paper>
      )}

      {/* Results panel — shown once there are completed analyses */}
      {completedJobs.length > 0 && !isProcessing && (
        <Stack bg='dark.6' p='lg' spacing='md'>
          <Group spacing='xs'>
            <IconShieldCheck size={24} />
            <Title order={2}>Risk Assessment Results</Title>
          </Group>

          <Group align='flex-end' position='apart' spacing='md'>
            <Select
              w='60%'
              label='Analysis'
              placeholder='Select an analysis'
              data={completedJobs.map((job) => ({
                value: job.id,
                label: `${job.odramFilename} · ${new Date(job.createdAt).toLocaleString('en-US', {
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
              onClick={handleDownload}
              disabled={!displayResults || displayResults.length === 0}
            >
              Export Excel
            </Button>
          </Group>

          {displayResults && displayResults.length > 0 && (
            <Stack spacing='md'>
              {/* Summary stats */}
              {summaryStats && (
                <Group spacing='lg'>
                  <Text size='lg' fw={500}>
                    {summaryStats.total} questions analyzed
                  </Text>
                  <Badge size='lg' color='green.6' variant='filled' c='black'>
                    Low: {summaryStats.low}
                  </Badge>
                  <Badge size='lg' color='yellow.6' variant='filled' c='black'>
                    Moderate: {summaryStats.moderate}
                  </Badge>
                  <Badge size='lg' color='red.6' variant='filled' c='black'>
                    High: {summaryStats.high}
                  </Badge>
                  {summaryStats.divergent > 0 && (
                    <Badge size='lg' color='orange' variant='light'>
                      {summaryStats.divergent} divergent
                    </Badge>
                  )}
                </Group>
              )}

              {/* Executive summary */}
              {activeSummary && (
                <Paper bg='dark.7' p='lg' radius='md'>
                  <Stack spacing='sm'>
                    <Title order={3}>Executive Summary</Title>
                    <Text size='sm' style={{ whiteSpace: 'pre-wrap' }}>
                      {activeSummary}
                    </Text>
                  </Stack>
                </Paper>
              )}

              {/* Per-question results */}
              <Stack spacing='md'>
                <Title order={3}>Question-by-Question Analysis</Title>
                {displayResults.map((result) => (
                  <QuestionResult key={result.questionId} result={result} />
                ))}
              </Stack>
            </Stack>
          )}

          {viewingJobId && !displayResults && (
            <Group spacing='sm'>
              <Loader size='sm' />
              <Text size='sm' color='dimmed'>Loading results...</Text>
            </Group>
          )}
        </Stack>
      )}

      {/* Partial results during processing (shown outside the history panel) */}
      {isProcessing && partialResults.length > 0 && (
        <Stack spacing='md'>
          <Title order={3}>Question-by-Question Analysis</Title>
          {partialResults.map((result) => (
            <QuestionResult key={result.questionId} result={result} />
          ))}
        </Stack>
      )}

      {/* Empty state */}
      {!isProcessing && completedJobs.length === 0 && (
        <Box py='xl'>
          <Center>
            <Stack align='center' spacing='md'>
              <IconAlertCircle size={48} color='gray' />
              <Text size='lg' color='dimmed'>
                Upload ODRAM responses and proposal documents to get started
              </Text>
            </Stack>
          </Center>
        </Box>
      )}
    </Stack>
  );
}
