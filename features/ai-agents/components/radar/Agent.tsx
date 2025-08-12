import { useState, useEffect } from 'react';
import { Text, Loader, Stack, Group, Box, Paper } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';

import Form, { transformFormValues } from './Form';
import SearchResults from './SearchResults';
import LlmAnalysis from './LlmAnalysis';
import Accordion from './Accordion';
import { useStartResearchJob } from '@/features/ai-agents/api/radar/start-research-job';
import { useGetResearchJobStatus } from '@/features/ai-agents/api/radar/get-research-job-status';
import { useGetResearchJobResults } from '@/features/ai-agents/api/radar/get-research-job-results';

type ResearchFormValues = {
  model: string;
  dateRange: string;
  categories: string[];
  institutions: string;
};

type ResearchJobData = {
  papers: Array<{
    id: string;
    updated: string;
    published: string;
    title: string;
    summary: string;
    authors: string[];
    institutions: string[];
    categories: string[];
  }>;
  paperCount: number;
  institutionCount: number;
  categoryCount: Record<string, number>;
  analysis: string;
};

type AgentProps = Readonly<{
  id: string;
}>;

export default function Agent({ id }: AgentProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState('');
  const [data, setData] = useState<ResearchJobData | null>(null);

  const { mutateAsync: startJob } = useStartResearchJob();
  const { refetch: checkStatus } = useGetResearchJobStatus(id, jobId);
  const { refetch: fetchResults } = useGetResearchJobResults(id, jobId);

  const resetJob = () => {
    setIsProcessing(false);
    setJobId(null);
  };

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      if (cancelled || !jobId || !isProcessing) {
        return;
      }

      try {
        const { data: status } = await checkStatus();

        if (!status) {
          return;
        }

        if (status.progress) {
          setProgressMessage(status.progress);
        }

        if (status.status === 'completed') {
          const { data: results } = await fetchResults();
          setData(results as ResearchJobData);
          resetJob();
        } else if (status.status === 'error') {
          notifications.show({
            title: 'Research Failed',
            message: status.error || 'An unexpected error occurred',
            icon: <IconX />,
            autoClose: true,
            variant: 'failed_operation',
          });
          resetJob();
        } else {
          setTimeout(poll, 4000);
        }
      } catch (error) {
        notifications.show({
          title: 'Error Checking Status',
          message: 'Failed to check research status',
          icon: <IconX />,
          autoClose: true,
          variant: 'failed_operation',
        });
        resetJob();
      }
    };

    if (jobId && isProcessing) {
      poll();
    }

    return () => {
      cancelled = true;
    };
  }, [jobId, isProcessing, checkStatus, fetchResults]);

  const handleSearch = async (values: ResearchFormValues) => {
    setData(null);
    setProgressMessage('');

    const transformedInputValue = transformFormValues(values);

    try {
      setIsProcessing(true);
      const response = await startJob({ ...transformedInputValue, agentId: id });
      setJobId(response.jobId);
    } catch (error) {
      setIsProcessing(false);
    }
  };

  return (
    <Stack spacing='lg'>
      <Box bg='dark.6' p='xl'>
        <Form isLoading={isProcessing} onSubmit={handleSearch} />
      </Box>

      {isProcessing && (
        <Group position='center' mt='md'>
          <Loader />
          <Stack spacing={0} align='center'>
            <Text>Processing research papers...</Text>
            <Text size='sm' color='dimmed'>
              {progressMessage ||
                'AI analysis will be generated after search completes'}
            </Text>
          </Stack>
        </Group>
      )}

      {data && (
        <Box bg='dark.6' p='xl'>
          <Paper p='md' withBorder>
            <SearchResults
              totalResults={data.paperCount}
              totalInstitutions={data.institutionCount}
              categories={data.categoryCount}
            />
            {!!data.papers.length && (
              <LlmAnalysis analysis={data.analysis} />
            )}
          </Paper>
        </Box>
      )}

      {!!data?.papers.length && (
        <Box bg='dark.6' p='xl'>
          <Accordion papers={data.papers} />
        </Box>
      )}
    </Stack>
  );
}
