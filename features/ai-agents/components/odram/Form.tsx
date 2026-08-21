import { useEffect, useMemo, useState } from 'react';
import {
  Accordion,
  Group,
  Select,
  Button,
  FileInput,
  FileInputProps,
  Center,
  Box,
  Text,
  ThemeIcon,
  Title,
  Stack,
} from '@mantine/core';
import { IconUpload, IconFile, IconFileText } from '@tabler/icons-react';
import { useForm, zodResolver } from '@mantine/form';
import { z } from 'zod';

import useGetAvailableModels from '@/features/shared/api/get-available-models';
import DocumentPicker from '@/features/ai-agents/components/odram/DocumentPicker';
import OdramFormatGuide from '@/features/ai-agents/components/odram/OdramFormatGuide';
import parsePromptMatrixPreview from '@/features/ai-agents/utils/odram/parsePromptMatrixPreview';
import type { OdramDocumentMapping, OdramQuestionContext } from '@/features/ai-agents/utils/odram/worker/queue';

const ACCEPTED_PROMPT_MATRIX_FILE_TYPES = '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const ACCEPTED_ODRAM_FILE_TYPES = '.pdf,.docx,.xlsx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const ACCEPTED_PROPOSAL_FILE_TYPES = '.pdf,.docx,.pptx,.xlsx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const odramAnalysisSchema = z.object({
  promptMatrixFile: z.instanceof(File, { message: 'Please select the Prompt Matrix file' }),
  odramFile: z.instanceof(File, { message: 'Please select the ODRAM responses file' }),
  proposalFiles: z.array(z.instanceof(File)).min(1, { message: 'Please add at least one proposal document' }),
  model: z.string().min(1, { message: 'Please select a model' }),
  documentMapping: z.record(z.coerce.number(), z.array(z.string())).nullable(),
  questionContext: z.record(z.coerce.number(), z.string()).nullable(),
});

function FileValue({ file }: Readonly<{ file: File }>) {
  return (
    <Center
      sx={(theme) => ({
        backgroundColor: theme.colors.dark[7],
        fontSize: theme.fontSizes.xs,
        padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
        borderRadius: theme.radius.sm,
        width: '100%',
      })}
    >
      <IconFile size={18} />
      <Box
        sx={(theme) => ({
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
          overflow: 'hidden',
          display: 'inline-block',
          marginLeft: theme.spacing.sm,
          width: '85%',
        })}
      >
        {file.name}
      </Box>
    </Center>
  );
}

const SingleValueComponent: FileInputProps['valueComponent'] = ({ value }) => {
  if (!value) {
    return <></>;
  }
  const file = Array.isArray(value) ? value[0] : value;
  return <FileValue file={file} />;
};

const MultiValueComponent: FileInputProps['valueComponent'] = ({ value }) => {
  if (!value) {
    return <></>;
  }
  const files = Array.isArray(value) ? value : [value];
  return (
    <Stack spacing={4}>
      {files.map((file) => (
        <FileValue key={file.name} file={file} />
      ))}
    </Stack>
  );
};

export type OdramAnalysisFormValues = {
  promptMatrixFile: File | null;
  odramFile: File | null;
  proposalFiles: File[];
  model: string;
  documentMapping: OdramDocumentMapping | null;
  questionContext: OdramQuestionContext | null;
};

type FormProps = Readonly<{
  agentId: string;
  isLoading: boolean;
  onSubmit: (values: OdramAnalysisFormValues) => void;
}>;

export default function Form({
  agentId: _agentId,
  isLoading,
  onSubmit,
}: FormProps) {
  const { data: modelData } = useGetAvailableModels();

  const [matrixQuestions, setMatrixQuestions] = useState<{ id: number; name: string }[]>([]);
  const [matrixError, setMatrixError] = useState<string | null>(null);

  const form = useForm<OdramAnalysisFormValues>({
    initialValues: {
      promptMatrixFile: null,
      odramFile: null,
      proposalFiles: [],
      model: '',
      documentMapping: null,
      questionContext: null,
    },
    validate: zodResolver(odramAnalysisSchema),
  });

  const modelOptions = useMemo(() => {
    if (!modelData) {
      return [];
    }

    return modelData.availableModels.map((model) => ({
      value: model.id,
      label: model.name,
      group: model.providerLabel,
    }));
  }, [modelData]);

  // Parse Prompt Matrix when file is selected
  const handlePromptMatrixChange = async (file: File | null) => {
    form.setFieldValue('promptMatrixFile', file);
    setMatrixError(null);

    if (!file) {
      setMatrixQuestions([]);
      return;
    }

    try {
      const questions = await parsePromptMatrixPreview(file);
      setMatrixQuestions(questions);
    } catch (e) {
      setMatrixError((e as Error).message);
      setMatrixQuestions([]);
    }
  };

  // Stable primitive so the effect only fires when the actual list of names changes
  const proposalFileNamesKey = form.values.proposalFiles.map((f) => f.name).join('\0');

  const proposalFileNames = useMemo(
    () => (proposalFileNamesKey ? proposalFileNamesKey.split('\0') : []),
    [proposalFileNamesKey],
  );

  // Stable key for matrix questions so effect doesn't re-fire on same list
  const matrixQuestionsKey = matrixQuestions.map((q) => q.id).join('\0');

  // Re-initialize document mapping when proposal files or matrix questions change (default = all selected)
  useEffect(() => {
    if (proposalFileNames.length === 0 || matrixQuestions.length === 0) {
      form.setFieldValue('documentMapping', null);
      form.setFieldValue('questionContext', null);
      return;
    }

    const mapping: OdramDocumentMapping = {};
    for (const q of matrixQuestions) {
      mapping[q.id] = [...proposalFileNames];
    }
    form.setFieldValue('documentMapping', mapping);
    form.setFieldValue('questionContext', {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposalFileNamesKey, matrixQuestionsKey]);

  const isFormValid = form.values.promptMatrixFile
    && form.values.odramFile
    && form.values.proposalFiles.length > 0
    && form.values.model
    && matrixQuestions.length > 0;

  return (
    <form
      onSubmit={form.onSubmit((values) => {
        onSubmit(values);
      })}
      data-testid='odram-form'
    >
      <Group position='apart' align='center' mb='lg'>
        <Group align='center' spacing='xs'>
          <ThemeIcon size='sm'>
            <IconFileText style={{ pointerEvents: 'none' }} />
          </ThemeIcon>
          <Title order={2}>Upload Documents</Title>
        </Group>
      </Group>

      <Stack spacing='md'>
        <Group align='flex-start'>
          <FileInput
            w='300px'
            valueComponent={SingleValueComponent}
            label='Prompt Matrix'
            description='ODRAM Prompt Matrix spreadsheet (.xlsx)'
            icon={
              <Group ml={form.values.promptMatrixFile ? 'xxxs' : 'xxxl'} spacing='xs' noWrap>
                <ThemeIcon size='xl' ml={form.values.promptMatrixFile ? '-xxs' : '-md'}>
                  <IconUpload />
                </ThemeIcon>
                {!form.values.promptMatrixFile && (
                  <Text size='xl' style={{ whiteSpace: 'nowrap' }}>
                    Select file
                  </Text>
                )}
              </Group>
            }
            accept={ACCEPTED_PROMPT_MATRIX_FILE_TYPES}
            value={form.values.promptMatrixFile}
            onChange={handlePromptMatrixChange}
            error={matrixError || (form.errors.promptMatrixFile as string)}
            required
            clearable
            aria-label='Prompt Matrix File'
            clearButtonProps={{ 'aria-label': 'Clear file', disabled: isLoading }}
            disabled={isLoading}
          />

          <FileInput
            w='300px'
            valueComponent={SingleValueComponent}
            label='ODRAM Responses'
            description='Team-completed ODRAM form (.xlsx, .pdf, .docx)'
            icon={
              <Group ml={form.values.odramFile ? 'xxxs' : 'xxxl'} spacing='xs' noWrap>
                <ThemeIcon size='xl' ml={form.values.odramFile ? '-xxs' : '-md'}>
                  <IconUpload />
                </ThemeIcon>
                {!form.values.odramFile && (
                  <Text size='xl' style={{ whiteSpace: 'nowrap' }}>
                    Select file
                  </Text>
                )}
              </Group>
            }
            accept={ACCEPTED_ODRAM_FILE_TYPES}
            value={form.values.odramFile}
            onChange={(value) => form.setFieldValue('odramFile', value)}
            error={form.errors.odramFile as string}
            required
            clearable
            aria-label='ODRAM Responses File'
            clearButtonProps={{ 'aria-label': 'Clear file', disabled: isLoading }}
            disabled={isLoading}
          />

          <FileInput
            w='300px'
            valueComponent={MultiValueComponent}
            label='Proposal Documents'
            description='RFP, tech volumes, pricing (.pdf, .docx, .pptx, .xlsx)'
            icon={
              <Group ml={form.values.proposalFiles.length > 0 ? 'xxxs' : 'xxxl'} spacing='xs' noWrap>
                <ThemeIcon size='xl' ml={form.values.proposalFiles.length > 0 ? '-xxs' : '-md'}>
                  <IconUpload />
                </ThemeIcon>
                {form.values.proposalFiles.length === 0 && (
                  <Text size='xl' style={{ whiteSpace: 'nowrap' }}>
                    Select files
                  </Text>
                )}
              </Group>
            }
            accept={ACCEPTED_PROPOSAL_FILE_TYPES}
            multiple
            value={form.values.proposalFiles}
            onChange={(value) => form.setFieldValue('proposalFiles', value)}
            error={form.errors.proposalFiles as string}
            required
            clearable
            aria-label='Proposal Documents'
            clearButtonProps={{ 'aria-label': 'Clear files', disabled: isLoading }}
            disabled={isLoading}
          />

          <Select
            w='250px'
            label='Model'
            description='Used for risk analysis'
            placeholder='Select model'
            data={modelOptions}
            {...form.getInputProps('model')}
            disabled={isLoading}
            required
          />
        </Group>

        {form.values.odramFile?.name.endsWith('.xlsx') && (
          <OdramFormatGuide />
        )}

        {matrixQuestions.length > 0 && (
          <Text size='xs' color='dimmed'>
            {matrixQuestions.length} questions loaded from Prompt Matrix
          </Text>
        )}

        {form.values.proposalFiles.length > 0 && form.values.documentMapping && matrixQuestions.length > 0 && (
          <Accordion variant='separated'>
            <Accordion.Item value='document-mapping'>
              <Accordion.Control>
                <Text fw={500} size='sm'>Document-to-Question Mapping</Text>
              </Accordion.Control>
              <Accordion.Panel>
                <DocumentPicker
                  questions={matrixQuestions}
                  fileNames={proposalFileNames}
                  mapping={form.values.documentMapping}
                  onChange={(mapping) => form.setFieldValue('documentMapping', mapping)}
                  questionContext={form.values.questionContext ?? {}}
                  onContextChange={(ctx) => form.setFieldValue('questionContext', ctx)}
                  disabled={isLoading}
                />
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
        )}
      </Stack>

      <Button
        type='submit'
        loading={isLoading}
        disabled={isLoading || !isFormValid}
        variant={isLoading ? 'loading' : 'filled'}
        w='fit-content'
        mt='md'
      >
        {isLoading ? 'Analyzing...' : 'Run ODRAM Analysis'}
      </Button>
    </form>
  );
}
