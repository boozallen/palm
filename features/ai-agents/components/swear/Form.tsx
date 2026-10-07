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
  Title,
} from '@mantine/core';
import { IconUpload, IconFile, IconFileText } from '@tabler/icons-react';
import { useForm, zodResolver } from '@mantine/form';
import { z } from 'zod';

import useGetAvailableModels from '@/features/shared/api/get-available-models';

const warrantAnalysisSchema = z.object({
  file: z.instanceof(File, { message: 'Please select a file' }),
  model: z.string().min(1, { message: 'Please select a model' }),
});

export function Value({ file }: Readonly<{ file: File }>) {
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

const ValueComponent: FileInputProps['valueComponent'] = ({ value }) => {
  if (!value) {
    return <></>;
  }

  const file = Array.isArray(value) ? value[0] : value;
  return <Value file={file} />;
};

export type WarrantAnalysisFormValues = {
  file: File | null;
  model: string;
};

type FormProps = Readonly<{
  agentId: string;
  isLoading: boolean;
  hasSubmitted: boolean;
  onSubmit: (values: WarrantAnalysisFormValues) => void;
}>;

export default function Form({
  agentId: _agentId,
  isLoading,
  hasSubmitted: _hasSubmitted,
  onSubmit,
}: FormProps) {
  const { data: modelData } = useGetAvailableModels();

  const form = useForm<WarrantAnalysisFormValues>({
    initialValues: {
      file: null,
      model: '',
    },
    validate: zodResolver(warrantAnalysisSchema),
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

  const fileSelected = form.values.file;
  const isFormValid = form.values.file && form.values.model;

  return (
    <form
      onSubmit={form.onSubmit((values) => {
        onSubmit(values);
      })}
      data-testid='swear-form'
    >
      <Group position='apart' align='center' mb='lg'>
        <Group align='center' spacing='xs'>
          <ThemeIcon size='sm'>
            <IconFileText style={{ pointerEvents: 'none' }} />
          </ThemeIcon>
          <Title order={2}>Upload Warrant</Title>
        </Group>
      </Group>

      <Group align='center'>
        <FileInput
          w='250px'
          valueComponent={ValueComponent}
          label='Search Warrant'
          description='Supports .pdf, .docx'
          icon={
            <Group ml={fileSelected ? 'xxxs' : 'xxxl'} spacing='xs' noWrap>
              <ThemeIcon size={'xl'} ml={fileSelected ? '-xxs' : '-md'}>
                <IconUpload />
              </ThemeIcon>
              {!fileSelected && (
                <Text size='xl' style={{ whiteSpace: 'nowrap' }}>
                  Select file 
                </Text>
              )}
            </Group>
          }
          accept='.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          value={form.values.file}
          onChange={(value) => form.setFieldValue('file', value)}
          error={form.errors.file as string}
          required
          clearable
          aria-label='Search Warrant File'
          clearButtonProps={{ 'aria-label': 'Clear file', disabled: isLoading }}
          disabled={isLoading}
        />
        
        <Select
          w='250px'
          label='Model'
          description='Used for warrant analysis'
          placeholder='Select model'
          data={modelOptions}
          {...form.getInputProps('model')}
          disabled={isLoading}
          required
        />

        <Button
          mt='lg'
          type='submit'
          loading={isLoading}
          disabled={isLoading || !isFormValid}
          variant={isLoading ? 'loading' : 'filled'}
        >
          {isLoading ? 'Analyzing...' : 'Analyze'}
        </Button>
      </Group>
    </form>
  );
}
