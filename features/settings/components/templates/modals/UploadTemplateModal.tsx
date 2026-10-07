import { useState } from 'react';
import {
  Box,
  Button,
  Center,
  FileInput,
  FileInputProps,
  Group,
  Modal,
  Text,
  ThemeIcon,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconFile, IconUpload, IconX } from '@tabler/icons-react';

import useCreateTemplate from '@/features/settings/api/templates/create-template';
import useGetTemplatePresignedUrl from '@/features/settings/api/templates/get-template-presigned-url';

type UploadTemplateModalProps = Readonly<{
  modalOpened: boolean;
  closeModalHandler: () => void;
}>;

type UploadTemplateFormValues = {
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

const FileValueComponent: FileInputProps['valueComponent'] = ({ value }) => {
  if (!value) {
    return <></>;
  }
  const file = Array.isArray(value) ? value[0] : value;
  return <FileValue file={file} />;
};

export default function UploadTemplateModal({ modalOpened, closeModalHandler }: UploadTemplateModalProps) {
  const [isUploading, setIsUploading] = useState(false);

  const { mutateAsync: createTemplate } = useCreateTemplate();
  const { mutateAsync: getPresignedUrl } = useGetTemplatePresignedUrl();

  const form = useForm<UploadTemplateFormValues>({
    initialValues: { file: null },
    validate: {
      file: (value) => (value ? null : 'Please select a file'),
    },
  });

  const fileSelected = form.values.file;

  const handleClose = () => {
    form.reset();
    closeModalHandler();
  };

  const handleSubmit = async (values: UploadTemplateFormValues) => {
    if (!values.file) {
      return;
    }

    setIsUploading(true);

    const file = values.file;

    try {
      // Step 1: get presigned S3 URL
      const { presignedUrl, fileKey } = await getPresignedUrl({
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
      });

      // Step 2: PUT directly to S3 (bypasses proxy)
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.timeout = 120000;
        xhr.addEventListener('load', () => {
          if (xhr.status === 200) {
            resolve();
          } else {
            reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
          }
        });
        xhr.addEventListener('error', () => reject(new Error('Upload failed')));
        xhr.addEventListener('timeout', () => reject(new Error('Upload timed out')));
        xhr.open('PUT', presignedUrl);
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
        xhr.send(file);
      });

      // Step 3: confirm — server fetches from S3, saves to DB, deletes from S3
      await createTemplate({
        fileName: file.name,
        fileKey,
      });

      notifications.show({
        id: 'upload-template-success',
        title: 'Template Uploaded',
        message: `${file.name} was uploaded successfully.`,
        icon: <IconCheck />,
        variant: 'successful_operation',
      });

      handleClose();
    } catch (error) {
      notifications.show({
        id: 'upload-template-error',
        title: 'Upload Failed',
        message: error instanceof Error ? error.message : 'Unable to upload template. Please try again later.',
        autoClose: false,
        withCloseButton: true,
        icon: <IconX />,
        variant: 'failed_operation',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Modal
      opened={modalOpened}
      onClose={handleClose}
      withCloseButton={false}
      title='Upload Template'
      centered
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <FileInput
          label='File'
          valueComponent={FileValueComponent}
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
          data-testid='template-file-input'
          clearable
          clearButtonProps={{ 'aria-label': 'Clear file' }}
          {...form.getInputProps('file')}
        />

        <Group spacing='lg' grow mt='md'>
          <Button variant='outline' onClick={handleClose}>Cancel</Button>
          <Button type='submit' loading={isUploading} leftIcon={<IconUpload />}>
            {isUploading ? 'Uploading' : 'Upload'}
          </Button>
        </Group>
      </form>
    </Modal>
  );
}
