import { Dispatch, SetStateAction, useState } from 'react';
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
import { IconCheck, IconFile, IconUpload } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';
import { TRPCClientError } from '@trpc/client';

import {
  DOCUMENT_UPLOAD_ACCEPTED_FILE_TYPES,
  addDocument,
  AddDocument,
} from '@/features/shared/types/document';
import useGetPresignedUrl from '@/features/shared/api/document-upload/get-presigned-url';
import useProcessDocument from '@/features/shared/api/document-upload/process-document';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import { trpc } from '@/libs';

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

  if (Array.isArray(value)) {
    return (
      <Group spacing='sm' py='xs'>
        {value.map((file) => (
          <Value file={file} key={`${file.name}-${file.size}`} />
        ))}
      </Group>
    );
  }

  return <Value file={value} />;
};

type AddDocumentFormProps = Readonly<{
  setFormCompleted: Dispatch<SetStateAction<boolean>>;
}>;

export default function AddDocumentForm({
  setFormCompleted,
}: AddDocumentFormProps) {
  const utils = trpc.useUtils();

  const {
    mutateAsync: getPresignedUrl,
  } = useGetPresignedUrl();

  const {
    mutateAsync: processDocument,
  } = useProcessDocument({
    onSuccess: () => {
      utils.shared.getDocuments.invalidate();
    },
  });

  const systemConfig = useGetSystemConfig();
  const documentUploadProviderId = systemConfig.data?.documentLibraryDocumentUploadProviderId || '';

  const addDocumentForm = useForm<AddDocument>({
    initialValues: {
      files: [],
    },
    validate: zodResolver(addDocument),
  });

  const [isProcessingFiles, setIsProcessingFiles] = useState(false);

  const filesSelected =
    addDocumentForm.values.files && addDocumentForm.values.files.length;

  const handleSubmit = async (values: AddDocument) => {
    setIsProcessingFiles(true);

    try {
      // Upload files sequentially to avoid bandwidth contention and network timeouts
      for (const file of values.files) {
        // Step 1: Get presigned URL
        const { presignedUrl, fileKey } = await getPresignedUrl({
          fileName: file.name,
          contentType: file.type,
          documentUploadProviderId,
        });

        // Step 2: Upload directly to S3 with XMLHttpRequest for better timeout control
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.timeout = 300000; // 5 minute timeout (100MB max file size)
          const startTime = Date.now();

          xhr.addEventListener('load', () => {
            if (xhr.status === 200) {
              resolve();
            } else {
              reject(new Error(`Upload failed for ${file.name}: ${xhr.status} ${xhr.statusText}`));
            }
          });

          xhr.addEventListener('error', () => {
            reject(new Error(`Network error uploading "${file.name}". Please check your connection and try again.`));
          });

          xhr.addEventListener('timeout', () => {
            const elapsed = Math.round((Date.now() - startTime) / 1000);
            if (elapsed < 300) {
              // Less than 5 minutes - likely network issue
              reject(new Error(`Network error uploading "${file.name}". Please check your connection and try again.`));
            } else {
              reject(new Error(`Large file upload failed for "${file.name}". Please try again.`));
            }
          });

          xhr.open('PUT', presignedUrl);
          xhr.setRequestHeader('Content-Type', file.type);
          xhr.send(file);
        });

        // Step 3: Process document
        await processDocument({
          fileName: file.name,
          contentType: file.type,
          fileSize: file.size,
          fileKey,
          documentUploadProviderId,
        });
      }
      
      setIsProcessingFiles(false);

      notifications.show({
        id: 'upload-document-success',
        title: 'Upload Successful',
        message: `${filesSelected} document${filesSelected === 1 ? '' : 's'} uploaded and queued for processing`,
        icon: <IconCheck />,
        variant: 'successful_operation',
      });

      handleClose();
    } catch (error) {
      setIsProcessingFiles(false);

      let message = `Failed to upload document${filesSelected === 1 ? '' : 's'}`;

      if (error instanceof TRPCClientError || error instanceof Error) {
        message = error.message;
      }

      notifications.show({
        id: 'upload-personal-document-failed',
        title: 'Failed to Upload',
        message: message,
        icon: <IconX />,
        variant: 'failed_operation',
        autoClose: false,
      });
    }
  };

  const handleClose = () => {
    addDocumentForm.reset();
    setFormCompleted(true);
  };

  return (
    <form onSubmit={addDocumentForm.onSubmit(handleSubmit)}>
      <FileInput
        valueComponent={ValueComponent}
        label='File Upload'
        // mantine's FileInput component no longer supports the placeholder prop,
        // so instead we've nested a placeholder within the icon property
        icon={
          <Group ml={filesSelected ? 'xxxs' : 'xxxl'} spacing='xs' noWrap>
            <ThemeIcon size={'xl'} ml={filesSelected ? '-xxs' : '-md'}>
              <IconUpload />
            </ThemeIcon>
            {!filesSelected && (
              <Text size='xl' style={{ whiteSpace: 'nowrap' }}>
                Select files
              </Text>
            )}
          </Group>
        }
        accept={DOCUMENT_UPLOAD_ACCEPTED_FILE_TYPES.join(',')}
        multiple
        clearable
        {...addDocumentForm.getInputProps('files')}
        aria-label='File Upload'
        clearButtonProps={{ 'aria-label': 'Clear documents' }}
      />
      <Group spacing='lg' grow>
        <Button variant='outline' onClick={handleClose}>
          Cancel
        </Button>
        <Button type='submit' loading={isProcessingFiles}>
          Upload
        </Button>
      </Group>
    </form>
  );
}

