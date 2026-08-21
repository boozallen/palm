import { useState, useRef } from 'react';
import {
  Modal,
  Text,
  Group,
  Stack,
  useMantineTheme,
  Progress,
  Box,
} from '@mantine/core';
import { IconFile, IconX } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { IconCheck } from '@tabler/icons-react';
import { TRPCClientError } from '@trpc/client';

import {
  DOCUMENT_UPLOAD_ACCEPTED_FILE_TYPES,
  MAX_FILE_SIZE_MB,
  MAX_FILE_SIZE,
  Document,
  DocumentUploadStatus,
  DOCUMENT_LIBRARY_DOCUMENT_LIMIT,
} from '@/features/shared/types/document';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import useGetPresignedUrl from '@/features/shared/api/document-upload/get-presigned-url';
import useProcessDocument from '@/features/shared/api/document-upload/process-document';
import useGetDocuments from '@/features/shared/api/document-upload/get-documents';
import { trpc } from '@/libs';

type AddSourcesModalProps = Readonly<{
  isModalOpen: boolean;
  closeModalHandler: () => void;
  documentSourceCount: number;
  onDocumentsUploaded?: (documentIds: string[]) => void;
  onUploadStart?: () => void;
  setUploadingDocuments?: (updater: (prev: Document[]) => Document[]) => void;
}>;

export default function AddSourcesModal({
  isModalOpen,
  closeModalHandler,
  documentSourceCount,
  onDocumentsUploaded,
  onUploadStart,
  setUploadingDocuments,
}: AddSourcesModalProps) {
  const theme = useMantineTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const { data: systemConfig } = useGetSystemConfig();
  const documentUploadProviderId = systemConfig?.documentLibraryDocumentUploadProviderId || '';

  const { data: userDocuments } = useGetDocuments({
    documentUploadProviderId,
  });

  const utils = trpc.useUtils();
  const { mutateAsync: getPresignedUrl } = useGetPresignedUrl();
  const { mutateAsync: processDocument } = useProcessDocument({
    onSuccess: () => {
      utils.shared.getDocuments.invalidate();
    },
  });

  const progressValue = (documentSourceCount / DOCUMENT_LIBRARY_DOCUMENT_LIMIT) * 100;
  const isAtDocumentLimit = documentSourceCount >= DOCUMENT_LIBRARY_DOCUMENT_LIMIT;

  const handleFiles = async (files: FileList | null) => {
    if (!files || isAtDocumentLimit) {
      return;
    }

    const filesArray = Array.from(files);

    const validFiles: File[] = [];
    const invalidFiles: Array<{ file: File; reason: string }> = [];

    filesArray.forEach(file => {
      if (file.size > MAX_FILE_SIZE) {
        invalidFiles.push({
          file,
          reason: `File size exceeds ${MAX_FILE_SIZE_MB}MB limit`,
        });
      } else {
        validFiles.push(file);
      }
    });

    if (invalidFiles.length > 0) {
      invalidFiles.forEach(({ file, reason }) => {
        notifications.show({
          id: `upload-documents-rejected-${file.name}`,
          title: 'File Rejected',
          message: `${file.name}: ${reason}`,
          icon: <IconX />,
          variant: 'failed_operation',
          autoClose: true,
        });
      });
    }

    if (validFiles.length > 0) {
      await startUpload(validFiles);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (!isAtDocumentLimit) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAtDocumentLimit) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleClick = () => {
    if (!isAtDocumentLimit) {
      fileInputRef.current?.click();
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  };

  const startUpload = async (filesToProcess: File[]) => {
    handleClose();

    if (onUploadStart) {
      onUploadStart();
    }

    const uploadedDocumentIds: string[] = [];

    const filesToUpload = filesToProcess.map(file => {
      const existingDoc = userDocuments?.documents?.find(
        doc => doc.filename === file.name
      );

      return {
        file,
        existingDoc,
        tempId: `temporary-${Date.now()}-${Math.random()}`,
      };
    });

    const newUploadingDocs: Document[] = filesToUpload
      .filter(({ existingDoc }) => !existingDoc)
      .map(({ file, tempId }) => ({
        filename: file.name,
        id: tempId,
        userId: '',
        uploadStatus: DocumentUploadStatus.Pending,
        createdAt: new Date(),
        adminCreated: false,
      }));

    if (setUploadingDocuments) {
      setUploadingDocuments((prev) => [...prev, ...newUploadingDocs]);
    }

    const existingDocumentIds: string[] = [];
    filesToUpload.forEach(({ existingDoc }) => {
      if (existingDoc && existingDoc.uploadStatus === DocumentUploadStatus.Completed) {
        existingDocumentIds.push(existingDoc.id);
        uploadedDocumentIds.push(existingDoc.id);
      }
    });

    try {
      for (const { file, existingDoc, tempId } of filesToUpload) {
        if (existingDoc) {
          continue;
        }

        try {
          const { presignedUrl, fileKey } = await getPresignedUrl({
            fileName: file.name,
            contentType: file.type,
            documentUploadProviderId,
          });

          await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.timeout = 300000;
            const startTime = Date.now();

            xhr.addEventListener('load', () => {
              if (xhr.status === 200) {
                resolve();
              } else {
                reject(new Error(`Upload failed for ${file.name}`));
              }
            });

            xhr.addEventListener('error', () => {
              reject(new Error(`Network error uploading "${file.name}"`));
            });

            xhr.addEventListener('timeout', () => {
              const elapsed = Math.round((Date.now() - startTime) / 1000);
              if (elapsed < 300) {
                reject(new Error(`Network error uploading "${file.name}"`));
              } else {
                reject(new Error(`Large file upload failed for "${file.name}"`));
              }
            });

            xhr.open('PUT', presignedUrl);
            xhr.setRequestHeader('Content-Type', file.type);
            xhr.send(file);
          });

          await processDocument({
            fileName: file.name,
            contentType: file.type,
            fileSize: file.size,
            fileKey,
            documentUploadProviderId,
          });
        } catch (error) {
          const errorMessage = error instanceof TRPCClientError || error instanceof Error
            ? error.message
            : 'Upload failed';

          if (setUploadingDocuments) {
            setUploadingDocuments((prev: Document[]) =>
              prev.map((doc: Document) =>
                doc.id === tempId
                  ? { ...doc, uploadStatus: DocumentUploadStatus.Failed }
                  : doc
              )
            );
          }

          notifications.show({
            id: `upload-documents-failed-${tempId}`,
            title: 'Upload Failed',
            message: errorMessage,
            icon: <IconX />,
            variant: 'failed_operation',
            autoClose: true,
          });
        }
      }

      if (uploadedDocumentIds.length > 0 && onDocumentsUploaded) {
        onDocumentsUploaded(uploadedDocumentIds);
      }

      if (existingDocumentIds.length > 0) {
        const existingFiles = filesToUpload
          .filter(({ existingDoc }) => existingDoc && existingDocumentIds.includes(existingDoc.id))
          .map(({ file }) => file.name);

        notifications.show({
          id: 'upload-documents-success',
          title: `Duplicate${existingFiles.length === 1 ? '' : 's'} Detected`,
          message: `Detected existing file${existingFiles.length === 1 ? '' : 's'}: ${existingFiles.map(name => `"${name}"`).join(', ')}`,
          icon: <IconCheck />,
          variant: 'successful_operation',
          autoClose: 3000,
        });
      }
    } catch (error) {
      // Individual file errors are handled above
    }
  };

  const handleClose = () => {
    closeModalHandler();
  };

  return (
    <Modal
      opened={isModalOpen}
      onClose={handleClose}
      withCloseButton={true}
      title='Add Data Sources'
      centered
      size='xl'
    >
      <Text color='gray.6' size='sm' mb='xl'>
        Upload documents to help PALM generate more relevant and accurate responses.
        <br />
        (Examples: proposal responses, research reports, meeting transcripts, technical specifications, etc.)
      </Text>

      <Box
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
        sx={(theme) => ({
          border: '2px dashed',
          borderColor: isAtDocumentLimit
            ? theme.colors.gray[9]
            : isDragging ? theme.colors.blue[6] : theme.colors.gray[8],
          backgroundColor: isAtDocumentLimit
            ? theme.colors.dark[8]
            : isDragging ? theme.colors.dark[5] : theme.colors.dark[6],
          borderRadius: theme.radius.sm,
          cursor: isAtDocumentLimit ? 'not-allowed' : 'pointer',
          transition: 'all 0.1s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: theme.spacing.xl,
          opacity: isAtDocumentLimit ? 0.5 : 1,
          '&:hover': {
            backgroundColor: isAtDocumentLimit
              ? theme.colors.dark[8]
              : theme.colors.dark[5],
            borderColor: isAtDocumentLimit
              ? theme.colors.gray[9]
              : theme.colors.gray[5],
          },
        })}
      >
        <Stack align='center' spacing='sm' c='gray.0'>
          <IconFile size={48} stroke={1.5} />
          <Text size='lg' inline>
            {isAtDocumentLimit ? 'Document upload limit reached' : 'Upload documents'}
          </Text>
          <Text size='sm' inline display='block' mb='md'>
            {isAtDocumentLimit
              ? 'Please reach out to your manager to request increased storage capacity.'
              : <>Drag & drop or <Text component='span' color='blue' inherit>choose file</Text> to upload</>
            }
          </Text>
          {!isAtDocumentLimit && (
            <Text size='xs'>
              Supported file types: {DOCUMENT_UPLOAD_ACCEPTED_FILE_TYPES.join(', ')} (max {MAX_FILE_SIZE_MB}MB per file)
            </Text>
          )}
        </Stack>
      </Box>

      <input
        ref={fileInputRef}
        type='file'
        multiple
        accept={DOCUMENT_UPLOAD_ACCEPTED_FILE_TYPES.join(',')}
        onChange={handleFileInputChange}
        style={{ display: 'none' }}
        disabled={isAtDocumentLimit}
        data-testid='file-input'
      />

      <Box mt='xl'>
        <Group position='apart' mb='xs'>
          <Group spacing={8}>
            <IconFile size={18} color={theme.colors.gray[5]} />
            <Text size='sm' weight={500}>
              Document limit
            </Text>
          </Group>
          <Text size='sm' color='gray.5'>
            {documentSourceCount} / {DOCUMENT_LIBRARY_DOCUMENT_LIMIT}
          </Text>
        </Group>
        <Progress
          value={progressValue}
          size='sm'
          color={progressValue > 80 ? 'red' : 'blue'}
          radius='xs'
        />
      </Box>
    </Modal>
  );
}
