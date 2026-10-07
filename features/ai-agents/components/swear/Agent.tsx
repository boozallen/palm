import { useState, useEffect, useCallback, useMemo } from 'react';
import { Stack, Text, Center, Box, Paper, Title, Badge, Group, Tabs, Button } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle, IconX, IconCheck, IconSearch, IconFileSpreadsheet } from '@tabler/icons-react';
import { TRPCClientError } from '@trpc/client';

import Form, { WarrantAnalysisFormValues } from './Form';
import ChecklistTable from './ChecklistTable';
import { useSwear } from '@/features/ai-agents/hooks/swear/useSwear';
import { useUserGroupAttribution } from '@/features/shared/hooks/userGroupAttribution/useUserGroupAttribution';

type AgentProps = Readonly<{
  id: string;
}>;

export default function Agent({ id }: AgentProps) {
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Use the SWEAR hook for analysis and job status
  const {
    analyzeDocument,
    reset: resetSwear,
    isProcessing: isAnalyzing,
    progress: _analysisProgress,
    results,
    error: _analysisError,
  } = useSwear(id, {
    onComplete: (completedResults) => {
      setActiveCategory(null); // Reset to trigger re-selection
      if (completedResults.analysis) {
        notifications.show({
          title: 'Analysis Complete',
          message: '',
          icon: <IconCheck />,
          color: 'green',
        });
      } else {
        notifications.show({
          title: 'Analysis Error',
          message: 'The analysis could not be completed. The selected model may have exceeded its output limit. Please try again with a different model.',
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

  // Get analysis result from hook
  const analysis = results?.analysis || null;
  const filename = results?.filename || null;

  // Get unique categories
  const categories = useMemo(() => {
    if (!analysis) {
      return [];
    }
    const cats = [...new Set(analysis.map(item => item.category))];
    return cats;
  }, [analysis]);

  // Set initial active category when results come in
  useEffect(() => {
    if (categories.length > 0 && !activeCategory) {
      setActiveCategory(categories[0]);
    }
  }, [categories, activeCategory]);

  // Get items for active category
  const activeItems = useMemo(() => {
    if (!analysis || !activeCategory) {
      return [];
    }
    return analysis.filter(item => item.category === activeCategory);
  }, [analysis, activeCategory]);

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    if (!analysis) {
      return null;
    }
    const stats = {
      total: analysis.length,
      pass: analysis.filter(item => item.status === 'PASS').length,
      fail: analysis.filter(item => item.status === 'FAIL').length,
      partial: analysis.filter(item => item.status === 'PARTIAL').length,
      na: analysis.filter(item => item.status === 'N/A').length,
    };
    return stats;
  }, [analysis]);

  const handleAnalyzeWarrant = useCallback(async (data: WarrantAnalysisFormValues) => {
    if (!data.file) {
      notifications.show({
        title: 'Error',
        message: 'Please select a file to analyze.',
        icon: <IconX />,
        color: 'red',
      });
      return;
    }

    // Reset previous analysis
    resetSwear();
    setActiveCategory(null);
    setHasSubmitted(true);
    setIsProcessingFile(true);

    try {
      const file = data.file;

      // Convert file to base64
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const fileContent = btoa(binary);

      setIsProcessingFile(false);

      // Queue the SWEAR analysis job with file content
      await gateUserGroupAttribution(data.model, async (userGroupId) => {
        await analyzeDocument({
          fileContent,
          fileName: file.name,
          contentType: file.type,
          modelId: data.model,
          userGroupId,
        });
      });

    } catch (error) {
      setIsProcessingFile(false);

      let message = 'Failed to process warrant';
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
  }, [analyzeDocument, resetSwear, gateUserGroupAttribution]);

  const handleDownload = () => {
    if (!analysis) {
      notifications.show({
        title: 'No Analysis',
        message: 'No analysis available to download.',
        icon: <IconX />,
        color: 'yellow',
      });
      return;
    }

    // Create CSV for download
    const headers = ['Category', 'Requirement', 'Status', 'Confidence', 'Evidence'];
    const csvRows = [
      headers.join(','),
      ...analysis.map(item => [
        `"${item.category.replace(/"/g, '""')}"`,
        `"${item.requirement.replace(/"/g, '""')}"`,
        item.status,
        item.confidence,
        `"${item.evidence.replace(/"/g, '""')}"`,
      ].join(',')),
    ];
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `warrant-analysis-${filename || 'document'}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const isWorking = isProcessingFile || isAnalyzing;

  return (
    <>
      <Stack spacing='xl'>
        {/* Header/Intro Section */}
        <div>
          <Title order={1} mb='sm'>Search Warrant Analysis</Title>
          <Text size='lg' color='dimmed'>
            Upload a document to evaluate compliance against procedural requirements.
          </Text>
        </div>

        {/* Form Section */}
        <Stack bg='dark.6' p='lg' spacing='xs'>
          <Form
            agentId={id}
            onSubmit={handleAnalyzeWarrant}
            isLoading={isWorking}
            hasSubmitted={hasSubmitted && !!analysis}
          />
        </Stack>

        {/* Analysis Results */}
        {analysis && (
          <Paper bg='dark.7' p='lg' radius='md'>
            <Stack spacing='md'>
              <Group position='apart'>
                <Title order={3}>
                  <IconSearch size={24} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                  Analysis
                </Title>
                <Button
                  leftIcon={<IconFileSpreadsheet />}
                  color='blue'
                  onClick={handleDownload}
                  disabled={!analysis || isWorking}
                >
                  Export
                </Button>
              </Group>

              {filename && (
                <Text size='sm' fs='italic'>{filename}</Text>
              )}

              {/* Summary Stats */}
              {summaryStats && (
                <Group spacing='lg'>
                  <Text size='lg' fw={500}>
                    Total checklist items: {summaryStats.total}
                  </Text>
                  <Badge size='lg' color='green.6' variant='filled' c='black'>
                    Pass: {summaryStats.pass}
                  </Badge>
                  <Badge size='lg' color='red.6' variant='filled' c='black'>
                    Fail: {summaryStats.fail}
                  </Badge>
                  <Badge size='lg' color='orange.6' variant='filled' c='black'>
                    Partial: {summaryStats.partial}
                  </Badge>
                  <Badge size='lg' color='gray.6' variant='filled' c='black'>
                    N/A: {summaryStats.na}
                  </Badge>
                </Group>
              )}

              {/* Category Tabs */}
              <Tabs value={activeCategory} onTabChange={setActiveCategory}>
                <Tabs.List>
                  {categories.map(cat => (
                    <Tabs.Tab key={cat} value={cat}>
                      {cat}
                    </Tabs.Tab>
                  ))}
                </Tabs.List>
              </Tabs>

              {/* Results Table */}
              <ChecklistTable items={activeItems} />
            </Stack>
          </Paper>
        )}

        {/* Placeholder when no document and not working */}
        {!isWorking && !analysis && (
          <Box py='xl'>
            <Center>
              <Stack align='center' spacing='md'>
                <IconAlertCircle size={48} color='gray' />
                <Text size='lg' color='dimmed'>
                  Upload a search warrant to get started
                </Text>
              </Stack>
            </Center>
          </Box>
        )}
      </Stack>
    </>
  );
}
