import { Dispatch, SetStateAction } from 'react';
import { Box, Button, Center, FileInput, FileInputProps, Group } from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { IconFile, IconUpload } from '@tabler/icons-react';

import { ACCEPTED_FILE_TYPES, addDocument, AddDocument } from '@/features/profile/types/document';

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
          <Value
            file={file}
            key={`${file.name}-${file.size}`}
          />
        ))}
      </Group>
    );
  }

  return <Value file={value} />;
};

type AddDocumentFormProps = Readonly<{
  setFormCompleted: Dispatch<SetStateAction<boolean>>;
}>;

export default function AddDocumentForm({ setFormCompleted }: AddDocumentFormProps) {
  const addDocumentForm = useForm<AddDocument>({
    initialValues: {
      files: [],
    },
    validate: zodResolver(addDocument),
  });

  const handleSubmit = async (_values: AddDocument) => {
    // try & catch
    handleClose();
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
        // mantine's FileInput component no longer supports the placeholder prop
        //placeholder='Select file(s)'
        accept={ACCEPTED_FILE_TYPES.join(',')}
        multiple
        clearable
        icon={<IconUpload />}
        {...addDocumentForm.getInputProps('files')}
        aria-label='File upload'
        clearButtonProps={{ 'aria-label': 'Clear documents' }}
      />
      <Group spacing='lg' grow>
        <Button variant='outline' onClick={handleClose}>Cancel</Button>
        <Button type='submit'>Upload</Button>
      </Group>
    </form>
  );
}
