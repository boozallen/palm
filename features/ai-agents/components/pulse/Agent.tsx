import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Center,
  Group,
  Loader,
  Select,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconAlertCircle,
  IconCheck,
  IconChartHistogram,
  IconDownload,
} from '@tabler/icons-react';

import ConfigureForm, { type PulseConfigureValues } from '@/features/ai-agents/components/pulse/ConfigureForm';
import ProcessDashboard from '@/features/ai-agents/components/pulse/ProcessDashboard';
import PromptMatrixUpload from '@/features/ai-agents/components/pulse/PromptMatrixUpload';
import SetupStep from '@/features/ai-agents/components/pulse/SetupStep';
import SurveyUpload from '@/features/ai-agents/components/pulse/SurveyUpload';
import TestRowPanel from '@/features/ai-agents/components/pulse/TestRowPanel';
import usePulseJobs from '@/features/ai-agents/api/pulse/get-pulse-jobs';
import usePulseResults from '@/features/ai-agents/api/pulse/get-pulse-results';
import { PULSE_DEFAULT_PERSONA } from '@/features/ai-agents/data/pulse/prompts';
import { usePulse } from '@/features/ai-agents/hooks/pulse/usePulse';
import type { PulseInputMapping, PulseSurveyHeader } from '@/features/ai-agents/types/pulse/surveyAnalysis';
import buildMatrixWorkbook from '@/features/ai-agents/utils/pulse/buildMatrixWorkbook';
import deriveInputColumns from '@/features/ai-agents/utils/pulse/deriveInputColumns';
import { MAX_RESULTS_FOCUS_LENGTH } from '@/features/ai-agents/utils/pulse/fieldSchema';
import detectSurveyLayout, { type SurveyLayout } from '@/features/ai-agents/utils/pulse/detectSurveyLayout';
import downloadBlob from '@/features/ai-agents/utils/pulse/downloadBlob';
import parsePromptMatrix, { type PromptMatrixParse } from '@/features/ai-agents/utils/pulse/parsePromptMatrix';
import parseSurveyPreview, { type SurveyPreview } from '@/features/ai-agents/utils/pulse/parseSurveyPreview';
import { parsePulseErrorMessage } from '@/features/ai-agents/utils/pulse/pulseErrors';
import { SURVEY_READ_ERROR } from '@/features/ai-agents/utils/pulse/readSurveyRows';
import showPulseError from '@/features/ai-agents/utils/pulse/showPulseError';
import useGetAvailableModels from '@/features/shared/api/get-available-models';
import { useUserGroupAttribution } from '@/features/shared/hooks/userGroupAttribution/useUserGroupAttribution';

const MAX_PERSONA_LENGTH = 4000;

const TEMPLATE_INSTRUCTIONS = 'Fill in the template in Excel. When it\'s ready, refresh this page and continue — setup isn\'t saved, and the session signs you out after about 15 minutes of inactivity.';

const MODEL_FIRST_REASON = 'Choose a model first.';
const RUN_IN_PROGRESS_REASON = 'Wait for the current run to finish.';

const EMPTY_MATRIX: PromptMatrixParse = { fields: [], rowErrors: [], fileError: null };

// A stable empty list, so the matrix effect doesn't re-run on every render before a survey is read.
const NO_SURVEY_COLUMNS: PulseSurveyHeader[] = [];

const RUN_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
};

type RunListItem = {
  status: string;
  surveyFilename: string;
  responseCount: number;
  createdAt: string | Date;
};

// A failed run's response count describes a file that was never fully read, so it says Failed instead.
function formatRunLabel(job: RunListItem): string {
  const detail = job.status === 'error' ? 'Failed' : `${job.responseCount} responses`;
  const date = new Date(job.createdAt).toLocaleString('en-US', RUN_DATE_FORMAT);

  return `${job.surveyFilename} · ${detail} · ${date}`;
}

function setupLockReason(modelId: string, isProcessing: boolean): string | null {
  if (modelId.length === 0) {
    return MODEL_FIRST_REASON;
  }
  if (isProcessing) {
    return RUN_IN_PROGRESS_REASON;
  }
  return null;
}

type AgentProps = Readonly<{
  id: string;
}>;

export default function Agent({ id }: AgentProps) {
  const [values, setValues] = useState<PulseConfigureValues>({
    modelId: '',
    persona: PULSE_DEFAULT_PERSONA,
    resultsFocus: null,
  });
  const { modelId } = values;
  const [surveyFile, setSurveyFile] = useState<File | null>(null);
  const [layout, setLayout] = useState<SurveyLayout | null>(null);
  const [layoutError, setLayoutError] = useState<string | null>(null);
  const [sheetOverride, setSheetOverride] = useState<string | null>(null);
  const [matrixFile, setMatrixFile] = useState<File | null>(null);
  const [matrix, setMatrix] = useState<PromptMatrixParse>(EMPTY_MATRIX);
  const [isParsingMatrix, setIsParsingMatrix] = useState(false);
  const [preview, setPreview] = useState<SurveyPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [viewingJobId, setViewingJobId] = useState<string | null>(null);

  const parseKeyRef = useRef(0);
  const detectKeyRef = useRef('');
  const matrixKeyRef = useRef('');

  // A new survey has its own worksheets, so a pick made against the previous one cannot stand.
  const handleSurveyFileChange = useCallback((next: File | null) => {
    setSheetOverride(null);
    setSurveyFile(next);
  }, []);

  const {
    startAnalysis,
    reset: resetPulse,
    isProcessing,
    progress,
    resultsData: currentResultsData,
    completedJobId,
    error: runError,
  } = usePulse(id, {
    onComplete: () => {
      notifications.show({
        title: 'Survey analysis complete',
        message: '',
        icon: <IconCheck />,
        color: 'green',
      });
    },
    onError: (message) => {
      showPulseError(new Error(message), 'Survey analysis failed');
    },
  });

  const { gate: gateUserGroupAttribution } = useUserGroupAttribution();
  const { data: jobsData, refetch: refetchJobs } = usePulseJobs(id);
  const { data: modelData } = useGetAvailableModels();

  const modelOptions = useMemo(
    () => modelData?.availableModels.map((model) => ({
      value: model.id,
      label: model.name,
      group: model.providerLabel,
    })) ?? [],
    [modelData],
  );

  // Every column the survey has, by letter and header, which is what a matrix source may name.
  const surveyColumns = useMemo(() => layout?.headers ?? NO_SURVEY_COLUMNS, [layout]);
  const availableColumns = useMemo(() => layout?.columns ?? [], [layout]);

  // A run reads only the columns the matrix asks for, so an ID or email column the prompts
  // never mention is not sent to the model.
  const inputColumns = useMemo(
    () => deriveInputColumns(matrix.fields, availableColumns),
    [matrix.fields, availableColumns],
  );

  const mapping = useMemo<PulseInputMapping | null>(() => {
    if (!layout || inputColumns.length === 0) {
      return null;
    }

    return { sheetName: layout.sheetName, headerRow: layout.headerRow, inputColumns };
  }, [layout, inputColumns]);

  // Reads the worksheet, header row, and columns off each survey chosen. A worksheet pick
  // re-reads that sheet, for the workbooks where more than one could hold the responses.
  useEffect(() => {
    if (!surveyFile) {
      detectKeyRef.current = '';
      setLayout(null);
      setLayoutError(null);
      return;
    }

    const detectKey = `${surveyFile.name}:${surveyFile.size}:${sheetOverride ?? ''}`;

    detectKeyRef.current = detectKey;
    setLayout(null);
    setLayoutError(null);

    detectSurveyLayout(surveyFile, sheetOverride ?? undefined)
      .then((result) => {
        if (detectKeyRef.current === detectKey) {
          setLayout(result);
        }
      })
      .catch((error: unknown) => {
        if (detectKeyRef.current === detectKey) {
          setLayoutError(error instanceof Error ? error.message : SURVEY_READ_ERROR);
        }
      });
  }, [surveyFile, sheetOverride]);

  // Re-runs whenever the matrix or the survey's columns change, and clears the previous columns
  // first, so the preview never describes a file or a survey other than the ones selected.
  useEffect(() => {
    setMatrix(EMPTY_MATRIX);

    if (!matrixFile) {
      matrixKeyRef.current = '';
      setIsParsingMatrix(false);
      return;
    }

    setIsParsingMatrix(true);

    const columnsKey = surveyColumns.map((column) => `${column.letter}=${column.header}`).join('|');
    const matrixKey = `${matrixFile.name}:${matrixFile.size}:${columnsKey}`;

    matrixKeyRef.current = matrixKey;

    parsePromptMatrix(matrixFile, surveyColumns)
      .then((result) => {
        if (matrixKeyRef.current === matrixKey) {
          setMatrix(result);
        }
      })
      .catch((error: unknown) => {
        if (matrixKeyRef.current === matrixKey) {
          setMatrix({
            fields: [],
            rowErrors: [],
            fileError: error instanceof Error ? error.message : 'The prompt matrix couldn\'t be read.',
          });
        }
      })
      .finally(() => {
        if (matrixKeyRef.current === matrixKey) {
          setIsParsingMatrix(false);
        }
      });
  }, [matrixFile, surveyColumns]);

  // Reparses locally whenever the file or the columns being read change, so the preview, the
  // response count, and the single-row test always describe the workbook currently selected.
  useEffect(() => {
    if (!surveyFile || !mapping) {
      setPreview(null);
      setPreviewError(null);
      setIsLoadingPreview(false);
      return;
    }

    setPreview(null);
    setPreviewError(null);
    setIsLoadingPreview(true);

    parseKeyRef.current += 1;
    const thisParseKey = parseKeyRef.current;

    parseSurveyPreview(surveyFile, mapping)
      .then((result) => {
        if (thisParseKey === parseKeyRef.current) {
          setPreview(result);
          setPreviewError(null);
        }
      })
      .catch((error: Error) => {
        if (thisParseKey === parseKeyRef.current) {
          setPreview(null);
          setPreviewError(error.message);
        }
      })
      .finally(() => {
        if (thisParseKey === parseKeyRef.current) {
          setIsLoadingPreview(false);
        }
      });
  }, [surveyFile, mapping]);

  useEffect(() => {
    if (completedJobId) {
      refetchJobs();
      setViewingJobId(completedJobId);
    }
  }, [completedJobId, refetchJobs]);

  // A failed run is listed in the picker too, so the list is refreshed when one fails.
  useEffect(() => {
    if (runError) {
      refetchJobs();
    }
  }, [runError, refetchJobs]);

  const { data: pastResultsData } = usePulseResults(
    id,
    viewingJobId && viewingJobId !== completedJobId ? viewingJobId : null,
  );

  const activeResultsData = useMemo(() => {
    if (viewingJobId === completedJobId && currentResultsData) {
      return currentResultsData;
    }
    return pastResultsData ?? null;
  }, [viewingJobId, completedJobId, currentResultsData, pastResultsData]);

  // Runs still in flight show the progress line instead, so the picker offers only finished ones.
  const runJobs = useMemo(
    () => jobsData?.jobs.filter((job) => job.status === 'completed' || job.status === 'error') ?? [],
    [jobsData],
  );

  const runErrorMessage = useMemo(() => (runError ? parsePulseErrorMessage(runError) : null), [runError]);

  const handleDownloadTemplate = useCallback(async () => {
    try {
      downloadBlob(await buildMatrixWorkbook([]), 'pulse-prompt-matrix-template.xlsx');
    } catch (error) {
      showPulseError(error, 'Download failed');
    }
  }, []);

  // Checks the model and the text this page owns, plus that the matrix yielded a column to run.
  // Everything about a column itself is a matrix row error.
  const validate = useCallback(() => {
    const nextErrors: Record<string, string> = {};

    if (modelId.length === 0) {
      nextErrors.modelId = 'Choose the model that will read the responses.';
    }

    if (values.persona.trim().length === 0) {
      nextErrors.persona = 'Describe who the model should be while reading these responses.';
    } else if (values.persona.length > MAX_PERSONA_LENGTH) {
      nextErrors.persona = 'Keep the persona under 4,000 characters.';
    }

    if ((values.resultsFocus?.length ?? 0) > MAX_RESULTS_FOCUS_LENGTH) {
      nextErrors.resultsFocus = 'Keep the results focus under 1,000 characters.';
    }

    if (matrix.fields.length === 0) {
      nextErrors.promptMatrix = 'Upload a prompt matrix with at least one usable row.';
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  }, [modelId, values, matrix.fields.length]);

  const handleSubmit = useCallback(async () => {
    if (!surveyFile || !mapping || !preview || preview.responseCount === 0) {
      return;
    }

    if (!validate()) {
      return;
    }

    resetPulse();
    setViewingJobId(null);

    const resultsFocus = values.resultsFocus?.trim() ? values.resultsFocus : null;

    try {
      await gateUserGroupAttribution(modelId, async (userGroupId) => {
        await startAnalysis({
          surveyFile,
          modelId,
          responseCount: preview.responseCount,
          config: { persona: values.persona, resultsFocus, ...mapping, fields: matrix.fields },
          userGroupId,
        });
      });
    } catch (error) {
      showPulseError(error, 'Couldn\'t start the analysis');
    }
  }, [
    surveyFile,
    mapping,
    preview,
    values,
    modelId,
    matrix.fields,
    validate,
    resetPulse,
    gateUserGroupAttribution,
    startAnalysis,
  ]);

  const lockReason = setupLockReason(modelId, isProcessing);

  // Mirrors what handleSubmit refuses, so a run that cannot start is disabled rather than
  // accepted and then rejected.
  const canSubmit = modelId.length > 0
    && !isProcessing
    && !isParsingMatrix
    && matrix.fields.length > 0
    && matrix.fileError === null
    && surveyFile !== null
    && mapping !== null
    && preview !== null
    && preview.responseCount > 0;

  const testDisabledReason = useMemo(() => {
    if (!preview || preview.rows.length === 0) {
      return 'Upload a survey and a prompt matrix to preview a response.';
    }
    if (matrix.fields.length === 0) {
      return 'Upload a prompt matrix with at least one output column to test.';
    }
    if (!modelId) {
      return MODEL_FIRST_REASON;
    }
    return null;
  }, [preview, matrix.fields.length, modelId]);

  return (
    <Stack spacing='xl'>
      <div>
        <Title order={1} mb='sm'>Survey Response Analysis</Title>
        <Text size='lg' color='dimmed'>
          Turn survey responses into structured columns you define, one row at a time.
        </Text>
      </div>

      <Stack spacing='lg'>
        <SetupStep step={1} title='Get the template' testId='pulse-step-template'>
          <Stack spacing='sm'>
            <Text size='sm' c='gray.4' data-testid='pulse-template-instructions'>
              {TEMPLATE_INSTRUCTIONS}
            </Text>
            <Button
              variant='light'
              leftIcon={<IconDownload />}
              data-testid='pulse-matrix-template-download'
              onClick={handleDownloadTemplate}
            >
              Download template
            </Button>
          </Stack>
        </SetupStep>

        <SetupStep step={2} title='Choose a model' testId='pulse-step-model'>
          <Select
            data-testid='pulse-model'
            label='Model'
            placeholder='Select a model'
            data={modelOptions}
            value={modelId || null}
            disabled={isProcessing}
            onChange={(value) => setValues((current) => ({ ...current, modelId: value ?? '' }))}
          />
          {errors.modelId && (
            <Text data-testid='pulse-error-model' size='sm' c='red.6'>{errors.modelId}</Text>
          )}
        </SetupStep>

        <SetupStep
          step={3}
          title='Upload the survey'
          disabled={lockReason !== null}
          disabledReason={lockReason}
          testId='pulse-step-survey'
        >
          <SurveyUpload
            file={surveyFile}
            layout={layout}
            preview={preview}
            error={layoutError ?? previewError}
            isLoading={isLoadingPreview}
            onFileChange={handleSurveyFileChange}
            onSheetChange={setSheetOverride}
          />
        </SetupStep>

        <SetupStep
          step={4}
          title='Upload the prompt matrix'
          disabled={lockReason !== null}
          disabledReason={lockReason}
          testId='pulse-step-matrix'
        >
          <PromptMatrixUpload
            file={matrixFile}
            fields={matrix.fields}
            rowErrors={matrix.rowErrors}
            fileError={matrix.fileError}
            isLoading={isParsingMatrix}
            preview={preview}
            onFileChange={setMatrixFile}
          />
        </SetupStep>

        <ConfigureForm
          values={values}
          errors={errors}
          disabled={lockReason !== null}
          disabledReason={lockReason}
          onChange={setValues}
        />

        <SetupStep
          step={7}
          title='Run analysis'
          disabled={lockReason !== null}
          disabledReason={lockReason}
          testId='pulse-step-run'
        >
          <Stack spacing='md'>
            <TestRowPanel
              agentId={id}
              modelId={modelId}
              persona={values.persona}
              fields={matrix.fields}
              rows={preview?.rows ?? []}
              disabledReason={testDisabledReason}
            />
            <Group position='right'>
              <Button
                data-testid='pulse-submit'
                disabled={!canSubmit}
                loading={isProcessing}
                onClick={handleSubmit}
              >
                Run analysis
              </Button>
            </Group>
          </Stack>
        </SetupStep>
      </Stack>

      {isProcessing && (
        <Group position='center' mt='md'>
          <Loader />
          <Stack spacing='xs'>
            <Text data-testid='pulse-progress'>
              {progress || 'Analyzing survey responses...'}
            </Text>
            <Text size='sm' color='dimmed'>
              Each response is processed in order. This runs in the background.
            </Text>
          </Stack>
        </Group>
      )}

      {runErrorMessage && (
        <Alert color='red' icon={<IconAlertCircle />} data-testid='pulse-error'>
          <Text size='sm' data-testid='pulse-error-cause'>{runErrorMessage.cause}</Text>
          {runErrorMessage.fix && (
            <Text size='sm' c='gray.4' data-testid='pulse-error-fix'>{`Fix: ${runErrorMessage.fix}`}</Text>
          )}
        </Alert>
      )}

      {runJobs.length > 0 && (
        <Stack bg='dark.6' p='lg' spacing='md'>
          <Group spacing='xs'>
            <ThemeIcon size='sm'>
              <IconChartHistogram style={{ pointerEvents: 'none' }} />
            </ThemeIcon>
            <Title order={2}>Runs</Title>
          </Group>

          <Select
            w='60%'
            label='Run'
            placeholder='Select a run'
            data={runJobs.map((job) => ({ value: job.id, label: formatRunLabel(job) }))}
            value={viewingJobId}
            onChange={(value) => setViewingJobId(value)}
            size='sm'
            clearable
            data-testid='pulse-job-picker'
          />

          {activeResultsData ? (
            <ProcessDashboard
              agentId={id}
              run={activeResultsData.run}
              fields={activeResultsData.fields}
              results={activeResultsData.results}
            />
          ) : viewingJobId && (
            <Group spacing='sm'>
              <Loader size='sm' />
              <Text size='sm' color='dimmed'>Loading run...</Text>
            </Group>
          )}
        </Stack>
      )}

      {!isProcessing && runJobs.length === 0 && (
        <Box py='xl'>
          <Center>
            <Stack align='center' spacing='md'>
              <IconAlertCircle size={48} color='gray' />
              <Text size='lg' color='dimmed' data-testid='pulse-empty-state'>
                Upload a survey and define your output columns to begin
              </Text>
            </Stack>
          </Center>
        </Box>
      )}
    </Stack>
  );
}
