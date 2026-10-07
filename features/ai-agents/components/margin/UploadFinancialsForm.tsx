import { useCallback, useState } from 'react';
import {
  Box,
  Button,
  Center,
  FileInput,
  FileInputProps,
  Group,
  Text,
  ThemeIcon,
} from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { IconUpload, IconFile, IconCheck } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { z } from 'zod';

import useUploadFinancials from '@/features/ai-agents/api/margin/upload-financials';
import { useGetMarginUploadUrl } from '@/features/ai-agents/api/margin/get-margin-upload-url';
import type { MarginAnalysisResult } from '@/features/ai-agents/types/margin';

async function uploadToS3(presignedUrl: string, file: File): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.timeout = 300000;

    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        resolve();
      } else {
        reject(new Error(`Upload failed for ${file.name}: ${xhr.status} ${xhr.statusText}`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error(`Network error uploading ${file.name}`)));
    xhr.addEventListener('timeout', () => reject(new Error(`Upload timed out for ${file.name}`)));

    xhr.open('PUT', presignedUrl);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.send(file);
  });
}

const schema = z.object({
  file: z.instanceof(File, { message: 'Please select a file' }),
});

type FormValues = {
  file: File | null;
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

const ValueComponent: FileInputProps['valueComponent'] = ({ value }) => {
  if (!value) {
    return <></>;
  }
  const file = Array.isArray(value) ? value[0] : value;
  return <FileValue file={file} />;
};

type Props = Readonly<{
  aiAgentId: string;
  onComplete: (analysisId: string, result: MarginAnalysisResult) => void;
}>;

export default function UploadFinancialsForm({ aiAgentId, onComplete }: Props) {
  const mutation = useUploadFinancials();
  const getUploadUrl = useGetMarginUploadUrl();
  const [isUploading, setIsUploading] = useState(false);

  const isProcessing = getUploadUrl.isPending || isUploading || mutation.isPending;

  const form = useForm<FormValues>({
    initialValues: { file: null },
    validate: zodResolver(schema),
  });

  const fileSelected = form.values.file;

  const handleSubmit = useCallback(
    async (values: FormValues) => {
      if (!values.file) {
        return;
      }

      try {
        // Step 1: Get presigned upload URL
        const { fileKey, presignedUrl, documentUploadProviderId } =
          await getUploadUrl.mutateAsync({
            aiAgentId,
            fileName: values.file.name.trim(),
            contentType: values.file.type || 'text/csv',
          });

        // Step 2: Upload file directly to S3
        setIsUploading(true);
        try {
          await uploadToS3(presignedUrl, values.file);
        } finally {
          setIsUploading(false);
        }

        // Step 3: Trigger analysis with file key
        const data = await mutation.mutateAsync({
          aiAgentId,
          fileKey,
          fileName: values.file.name.trim(),
          documentUploadProviderId,
        });

        form.reset();
        notifications.show({
          title: 'Analysis Complete',
          message: `${data.result.totalJobsAnalyzed} jobs analyzed — ${data.result.totalFlaggedJobs} flagged.`,
          icon: <IconCheck />,
          variant: 'successful_operation',
          autoClose: 5000,
        });
        onComplete(data.analysisId, data.result);
      } catch (error) {
        notifications.show({
          title: 'Upload Failed',
          message:
            error instanceof Error ? error.message : 'Failed to process financials file.',
          color: 'red',
        });
      }
    },
    [aiAgentId, form, mutation, getUploadUrl, onComplete],
  );

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <Group align='center'>
        <FileInput
          w='250px'
          label='FF Financials CSV'
          description='Required: .csv only'
          valueComponent={ValueComponent}
          icon={
            <Group ml={fileSelected ? 'xxxs' : 'xxxl'} spacing='xs' noWrap>
              <ThemeIcon size='xl' ml={fileSelected ? '-xxs' : '-md'}>
                <IconUpload />
              </ThemeIcon>
              {!fileSelected && (
                <Text size='xl' style={{ whiteSpace: 'nowrap' }}>
                  Select file
                </Text>
              )}
            </Group>
          }
          accept='.csv,text/csv'
          {...form.getInputProps('file')}
          required
          clearable
          aria-label='FF Financials CSV'
          clearButtonProps={{ 'aria-label': 'Clear file' }}
          disabled={isProcessing}
        />
        <Button
          mt='lg'
          type='submit'
          leftIcon={<IconUpload />}
          loading={isProcessing}
        >
          Analyze
        </Button>
      </Group>
    </form>
  );
}
