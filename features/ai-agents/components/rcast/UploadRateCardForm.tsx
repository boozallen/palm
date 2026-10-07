import { useCallback, useMemo } from 'react';
import {
  Box,
  Button,
  Center,
  FileInput,
  FileInputProps,
  Group,
  Select,
  Stack,
  Text,
  ThemeIcon,
  Alert,
  Progress,
} from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { IconUpload, IconCheck, IconX, IconFile, IconClock } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { z } from 'zod';

import { useRcast } from '@/features/ai-agents/hooks/rcast/useRcast';
import useGetAvailableModels from '@/features/shared/api/get-available-models';
import ColumnRequirementsTable from '@/features/ai-agents/components/rcast/ColumnRequirementsTable';
import { useUserGroupAttribution } from '@/features/shared/hooks/userGroupAttribution/useUserGroupAttribution';

const uploadRateCardFormSchema = z.object({
  file: z.instanceof(File, { message: 'Please select a file' }),
  modelId: z.string().min(1, { message: 'Please select a model' }),
});

type UploadRateCardFormProps = Readonly<{
  aiAgentId: string;
}>;

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

export type UploadRateCardFormValues = {
  file: File | null;
  modelId: string;
};

export default function UploadRateCardForm({
  aiAgentId,
}: UploadRateCardFormProps) {
  const { data: modelData } = useGetAvailableModels();

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

  const form = useForm<UploadRateCardFormValues>({
    initialValues: {
      file: null,
      modelId: '',
    },
    validate: zodResolver(uploadRateCardFormSchema),
  });

  const handleComplete = useCallback(() => {
    form.reset();
    notifications.show({
      id: 'rate-card-processing-complete',
      title: 'Processing Complete',
      message: 'Rate card analysis has finished. SOC codes and wage data have been updated.',
      icon: <IconCheck />,
      variant: 'successful_operation',
      autoClose: false,
    });
  }, [form]);

  const { uploadAndProcessRateCard, isProcessing, jobStatus } = useRcast(aiAgentId, {
    onComplete: handleComplete,
  });

  const { gate: gateUserGroupAttribution } = useUserGroupAttribution();

  const fileSelected = form.values.file;

  const handleSubmit = async (values: UploadRateCardFormValues) => {
    if (!values.file || !values.modelId) {
      return;
    }

    try {
      const fileName = values.file.name.trim();
      const { modelId } = values;
      const arrayBuffer = await values.file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const fileContent = btoa(binary);

      await gateUserGroupAttribution(modelId, async (userGroupId) => {
        const result = await uploadAndProcessRateCard({
          fileContent,
          fileName,
          modelId,
          userGroupId,
        });

        if (result) {
          notifications.show({
            id: 'upload-rate-card-success',
            title: 'Processing Started',
            message: result.message,
            icon: <IconCheck />,
            variant: 'successful_operation',
            autoClose: true,
          });
        }
      });
    } catch (error) {
      notifications.show({
        id: 'upload-rate-card-failed',
        title: 'Upload Failed',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to upload rate card',
        icon: <IconX />,
        variant: 'failed_operation',
        autoClose: false,
      });
    }
  };

  return (
    <Stack spacing='sm'>
      <Stack spacing='sm'>
        <Text size='sm' mb='xs'>
          Your file must follow this column structure:
        </Text>

        <ColumnRequirementsTable />

        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Group align='center'>
            <Select
              w='250px'
              label='Model'
              description='Used for SOC code matching'
              placeholder='Select model'
              data={modelOptions}
              {...form.getInputProps('modelId')}
              disabled={isProcessing}
              required
            />

            <FileInput
              w='250px'
              valueComponent={ValueComponent}
              label='File Upload'
              description='Supports .xlsx, .csv'
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
              accept='.xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv'
              {...form.getInputProps('file')}
              required
              clearable
              aria-label='File Upload'
              clearButtonProps={{ 'aria-label': 'Clear file' }}
              disabled={isProcessing}
            />

            <Button
              mt='lg'
              type='submit'
              leftIcon={<IconUpload />}
              disabled={isProcessing}
            >
              Upload
            </Button>
          </Group>
        </form>
      </Stack>

      {isProcessing && (
        <Alert icon={<IconClock />} title='Processing' color='blue'>
          <Stack spacing='xs'>
            <Text size='sm'>
              Your rate card is being analyzed. This may take a few minutes...
            </Text>
            <Progress value={100} animate />
          </Stack>
        </Alert>
      )}

      {jobStatus === 'error' && (
        <Alert icon={<IconX />} title='Failed' color='red'>
          <Text size='sm'>
            An error occurred during processing.
          </Text>
        </Alert>
      )}
    </Stack>
  );
}
