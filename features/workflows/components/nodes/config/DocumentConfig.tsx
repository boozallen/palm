/**
 * Document Input Configuration Form
 * Documents are selected/uploaded here at workflow creation time.
 */

import { useState } from 'react';
import { Stack, Select, FileInput, Text, Group, ThemeIcon } from '@mantine/core';
import { IconUpload } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconX } from '@tabler/icons-react';

import { TRPCClientError } from '@trpc/client';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import useGetDocuments from '@/features/shared/api/document-upload/get-documents';
import { DocumentUploadStatus, DOCUMENT_UPLOAD_ACCEPTED_FILE_TYPES } from '@/features/shared/types/document';
import useGetPresignedUrl from '@/features/shared/api/document-upload/get-presigned-url';
import useProcessDocument from '@/features/shared/api/document-upload/process-document';
import { trpc } from '@/libs';

interface DocumentConfigProps {
  config: {
    documentId?: string;
  };
  onChange: (config: any) => void;
  onUploadingChange?: (isUploading: boolean) => void;
}

export default function DocumentConfig({ config, onChange, onUploadingChange }: Readonly<DocumentConfigProps>) {
  const utils = trpc.useUtils();
  const { data: systemConfig } = useGetSystemConfig();
  const documentUploadProviderId = systemConfig?.documentLibraryDocumentUploadProviderId || '';
  const { data: libraryDocs } = useGetDocuments({ documentUploadProviderId });
  const [isUploading, setIsUploading] = useState(false);
  const [fileInputValue, setFileInputValue] = useState<File | null>(null);

  const { mutateAsync: getPresignedUrl } = useGetPresignedUrl();
  const { mutateAsync: processDocument } = useProcessDocument({
    onSuccess: () => {
      utils.shared.getDocuments.invalidate();
    },
  });

  const readyDocs = libraryDocs?.documents?.filter(
    (d) => d.uploadStatus === DocumentUploadStatus.Completed
  ) ?? [];

  const libraryOptions = readyDocs.map((d) => ({ value: d.id, label: d.filename }));

  const handleFileUpload = async (files: File[] | null) => {
    if (!files || files.length === 0) {return;}

    setIsUploading(true);
    onUploadingChange?.(true);

    try {
      const uploadedDocIds: string[] = [];
      const existingDocIds: string[] = [];
      const duplicateNames: string[] = [];

      // Upload files sequentially (same as AddDocumentForm)
      for (const file of files) {
        // Check if document already exists in library
        const existingDoc = libraryDocs?.documents?.find(
          doc => doc.filename === file.name
        );

        if (existingDoc?.uploadStatus === DocumentUploadStatus.Completed) {
          // Document already exists and is ready - skip upload
          existingDocIds.push(existingDoc.id);
          duplicateNames.push(file.name);
          continue;
        }

        // Step 1: Get presigned URL
        const { presignedUrl, fileKey } = await getPresignedUrl({
          fileName: file.name,
          contentType: file.type,
          documentUploadProviderId,
        });

        // Step 2: Upload to S3
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.timeout = 300000; // 5 minute timeout

          xhr.addEventListener('load', () => {
            if (xhr.status === 200) {
              resolve();
            } else {
              reject(new Error(`Upload failed for ${file.name}: ${xhr.status}`));
            }
          });

          xhr.addEventListener('error', () => {
            reject(new Error(`Network error uploading "${file.name}"`));
          });

          xhr.addEventListener('timeout', () => {
            reject(new Error(`Upload timeout for "${file.name}"`));
          });

          xhr.open('PUT', presignedUrl);
          xhr.setRequestHeader('Content-Type', file.type);
          xhr.send(file);
        });

        // Step 3: Queue document for processing
        const result = await processDocument({
          fileName: file.name,
          contentType: file.type,
          fileSize: file.size,
          fileKey,
          documentUploadProviderId,
        });

        uploadedDocIds.push(result.documentId);
      }

      // Only show processing notification if we have docs to process
      if (uploadedDocIds.length > 0) {
        notifications.show({
          title: 'Processing Documents',
          message: `${uploadedDocIds.length} document${uploadedDocIds.length === 1 ? '' : 's'} queued for processing...`,
          icon: <IconCheck />,
          variant: 'loading_operation',
          autoClose: false,
          id: 'document-processing',
        });

        // Step 4: Poll until all documents are processed
        const pollForCompletion = async (): Promise<boolean> => {
          const result = await utils.shared.getDocuments.fetch({ documentUploadProviderId });

          const uploadedDocs = result.documents.filter(d => uploadedDocIds.includes(d.id));
          const allCompleted = uploadedDocs.every(d => d.uploadStatus === DocumentUploadStatus.Completed);
          const anyFailed = uploadedDocs.some(d => d.uploadStatus === DocumentUploadStatus.Failed);

          if (anyFailed) {
            throw new Error('One or more documents failed to process');
          }

          return allCompleted;
        };

        // Poll every 2 seconds until complete (max 5 minutes)
        const maxAttempts = 150; // 5 minutes
        let attempts = 0;

        while (attempts < maxAttempts) {
          const completed = await pollForCompletion();
          if (completed) {
            break;
          }
          await new Promise(resolve => setTimeout(resolve, 2000));
          attempts++;
        }

        if (attempts >= maxAttempts) {
          throw new Error('Document processing timeout - please check document library');
        }

        notifications.hide('document-processing');
      }

      // Set the first uploaded or existing document as the selection
      const firstDocId = uploadedDocIds[0] || existingDocIds[0];
      if (firstDocId) {
        onChange({
          ...config,
          documentId: firstDocId,
        });
      }

      setIsUploading(false);
      onUploadingChange?.(false);
      
      // Clear the file input
      setFileInputValue(null);

      // Show success notification for uploaded documents
      if (uploadedDocIds.length > 0) {
        notifications.show({
          title: 'Upload Complete',
          message: `${uploadedDocIds.length} document${uploadedDocIds.length === 1 ? '' : 's'} processed successfully`,
          icon: <IconCheck />,
          variant: 'successful_operation',
        });
      }

      // Show duplicate notification if any existed
      if (existingDocIds.length > 0) {
        notifications.show({
          title: `Duplicate${duplicateNames.length === 1 ? '' : 's'} Detected`,
          message: `Detected existing file${duplicateNames.length === 1 ? '' : 's'}: ${duplicateNames.map(name => `"${name}"`).join(', ')}`,
          icon: <IconCheck />,
          color: 'blue',
        });
      }

      // Refetch documents to update the Select options with newly uploaded docs
      await utils.shared.getDocuments.refetch({ documentUploadProviderId });
    } catch (error) {
      setIsUploading(false);
      onUploadingChange?.(false);
      
      // Clear the file input
      setFileInputValue(null);

      let message = 'Failed to upload documents';
      if (error instanceof TRPCClientError || error instanceof Error) {
        message = error.message;
      }

      notifications.hide('document-processing');
      notifications.show({
        title: 'Upload Failed',
        message,
        icon: <IconX />,
        color: 'red',
        autoClose: false,
      });
    }
  };

  const selectedDocId = config.documentId;
  const hasLibrarySelection = !!selectedDocId;

  return (
    <Stack spacing='xs'>
      <Select
        label='Select from Document Library'
        placeholder={hasLibrarySelection ? 'Document selected' : 'Select a document'}
        data={libraryOptions}
        value={selectedDocId || null}
        onChange={(id) => onChange({ ...config, documentId: id || undefined })}
        searchable
        clearable
        maxDropdownHeight={300}
        disabled={isUploading}
      />

      <FileInput
        label='Upload from Device'
        description='Uploads are added to your Document Library'
        icon={
          <Group ml={fileInputValue ? 'xxxs' : 'xxxl'} spacing='xs' noWrap>
            <ThemeIcon size='lg' ml={fileInputValue ? '-xxs' : '-xl'}>
              <IconUpload />
            </ThemeIcon>
            {!fileInputValue && (
              <Text size='lg' style={{ whiteSpace: 'nowrap' }}>
                Select file
              </Text>
            )}
          </Group>
        }
        value={fileInputValue}
        onChange={(file) => {
          setFileInputValue(file);
          handleFileUpload(file ? [file] : null);
        }}
        accept={DOCUMENT_UPLOAD_ACCEPTED_FILE_TYPES.join(',')}
        disabled={isUploading}
        clearable={!isUploading}
      />
    </Stack>
  );
}
