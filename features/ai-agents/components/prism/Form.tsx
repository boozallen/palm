import { useMemo } from 'react';
import {
  Group,
  Select,
  Button,
  FileInput,
  FileInputProps,
  Center,
  Box,
  Text,
  ThemeIcon,
  Stack,
} from '@mantine/core';
import { IconUpload, IconFile } from '@tabler/icons-react';
import { useForm, zodResolver } from '@mantine/form';
import { z } from 'zod';

import useGetAvailableModels from '@/features/shared/api/get-available-models';
import RequirementsFormatGuide from './RequirementsFormatGuide';

const prismFormSchema = z.object({
  requirementsFile: z.instanceof(File, { message: 'Please select a requirements spreadsheet' }),
  proposalFile: z.instanceof(File, { message: 'Please select a proposal document' }),
  model: z.string().min(1, { message: 'Please select a model' }),
});

export type PrismFormValues = {
  requirementsFile: File | null;
  proposalFile: File | null;
  model: string;
};

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

const FileValueComponent: FileInputProps['valueComponent'] = ({ value }) => {
  if (!value) {
    return <></>;
  }
  const file = Array.isArray(value) ? value[0] : value;
  return <FileValue file={file} />;
};

type FormProps = Readonly<{
  agentId: string;
  isLoading: boolean;
  onSubmit: (values: PrismFormValues) => void;
}>;

export default function Form({ agentId: _agentId, isLoading, onSubmit }: FormProps) {
  const { data: modelData } = useGetAvailableModels();

  const form = useForm<PrismFormValues>({
    initialValues: {
      requirementsFile: null,
      proposalFile: null,
      model: '',
    },
    validate: zodResolver(prismFormSchema),
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

  const isFormValid = form.values.requirementsFile && form.values.proposalFile && form.values.model;

  return (
    <form
      onSubmit={form.onSubmit((values) => onSubmit(values))}
      data-testid='prism-form'
    >
      <Stack spacing='md'>
        <RequirementsFormatGuide />
        <Group align='flex-end'>
          <FileInput
            w='280px'
            valueComponent={FileValueComponent}
            label='Requirements Spreadsheet'
            description='Supports .xlsx — requirements from column A'
            icon={
              <Group ml={form.values.requirementsFile ? 'xxxs' : 'xxxl'} spacing='xs' noWrap>
                <ThemeIcon size='xl' ml={form.values.requirementsFile ? '-xxs' : '-md'}>
                  <IconUpload />
                </ThemeIcon>
                {!form.values.requirementsFile && (
                  <Text size='xl' style={{ whiteSpace: 'nowrap' }}>
                    Select file
                  </Text>
                )}
              </Group>
            }
            accept='.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            value={form.values.requirementsFile}
            onChange={(value) => form.setFieldValue('requirementsFile', value)}
            error={form.errors.requirementsFile as string}
            required
            clearable
            aria-label='Requirements Spreadsheet'
            clearButtonProps={{ 'aria-label': 'Clear requirements file', disabled: isLoading }}
            disabled={isLoading}
          />

          <FileInput
            w='280px'
            valueComponent={FileValueComponent}
            label='Proposal Document'
            description='Supports .pdf, .docx'
            icon={
              <Group ml={form.values.proposalFile ? 'xxxs' : 'xxxl'} spacing='xs' noWrap>
                <ThemeIcon size='xl' ml={form.values.proposalFile ? '-xxs' : '-md'}>
                  <IconUpload />
                </ThemeIcon>
                {!form.values.proposalFile && (
                  <Text size='xl' style={{ whiteSpace: 'nowrap' }}>
                    Select file
                  </Text>
                )}
              </Group>
            }
            accept='.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            value={form.values.proposalFile}
            onChange={(value) => form.setFieldValue('proposalFile', value)}
            error={form.errors.proposalFile as string}
            required
            clearable
            aria-label='Proposal Document'
            clearButtonProps={{ 'aria-label': 'Clear proposal file', disabled: isLoading }}
            disabled={isLoading}
          />

          <Select
            w='250px'
            label='Model'
            description='Used for compliance analysis'
            placeholder='Select model'
            data={modelOptions}
            {...form.getInputProps('model')}
            disabled={isLoading}
            required
          />

          <Button
            mb='md'
            type='submit'
            loading={isLoading}
            disabled={isLoading || !isFormValid}
            variant={isLoading ? 'loading' : 'filled'}
          >
            {isLoading ? 'Analyzing...' : 'Analyze'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
