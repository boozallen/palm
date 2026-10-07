/**
 * Workflow Generator
 * Chat-type input that lets users select data sources and describe their process,
 * then generates an optimized workflow via AI.
 */

import { useState } from 'react';
import {
  Stack,
  Textarea,
  MultiSelect,
  FileInput,
  Button,
  Group,
  Text,
  ThemeIcon,
  Paper,
} from '@mantine/core';
import {
  IconSparkles,
  IconRefresh,
  IconX,
  IconUpload,
  IconCheck,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { TRPCClientError } from '@trpc/client';

import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import useGetDocuments from '@/features/shared/api/document-upload/get-documents';
import { DocumentUploadStatus, DOCUMENT_UPLOAD_ACCEPTED_FILE_TYPES } from '@/features/shared/types/document';
import useGetPresignedUrl from '@/features/shared/api/document-upload/get-presigned-url';
import useProcessDocument from '@/features/shared/api/document-upload/process-document';
import useGenerateWorkflow from '@/features/workflows/api/generate-workflow';
import { useWorkflowBuilder } from '@/features/workflows/providers/WorkflowBuilderProvider';
import { workflowToGraph, graphToWorkflow } from '@/features/workflows/utils/workflow-conversion';
import { PrimitiveConfig } from '@/features/workflows/types/primitive';
import { trpc } from '@/libs';
import { useUserGroupAttribution } from '@/features/shared/hooks/userGroupAttribution/useUserGroupAttribution';

export default function WorkflowGenerator() {
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [fileInputValue, setFileInputValue] = useState<File | null>(null);

  const utils = trpc.useUtils();
  const { data: systemConfig } = useGetSystemConfig();
  const documentUploadProviderId = systemConfig?.documentLibraryDocumentUploadProviderId || '';
  const { data: libraryDocs } = useGetDocuments({ documentUploadProviderId });

  const { mutateAsync: getPresignedUrl } = useGetPresignedUrl();
  const { mutateAsync: processDocument } = useProcessDocument({
    onSuccess: () => {
      utils.shared.getDocuments.invalidate();
    },
  });

  const { nodes, edges, setNodes, setEdges, pinnedGroup } = useWorkflowBuilder();

  const {
    mutate: generate,
    isPending,
  } = useGenerateWorkflow();

  const { gate: gateUserGroupAttribution } = useUserGroupAttribution();

  const readyDocs = libraryDocs?.documents?.filter(
    (d) => d.uploadStatus === DocumentUploadStatus.Completed && d.text,
  ) ?? [];

  const documentOptions = readyDocs.map((d) => ({
    value: d.id,
    label: d.filename,
  }));

  const hasExistingWorkflow = nodes.length > 0;
  const canGenerate = description.trim().length > 0;
  const isBusy = isPending || isUploading;

  const getCurrentWorkflow = (): PrimitiveConfig[] | undefined => {
    if (nodes.length === 0) {
      return undefined;
    }
    return graphToWorkflow(nodes, edges) as PrimitiveConfig[];
  };

  const handleGenerate = async () => {
    if (!canGenerate) {
      return;
    }

    const runGenerate = (userGroupId: string | undefined) => {
      generate(
        {
          description,
          documentIds: selectedDocumentIds,
          currentWorkflow: hasExistingWorkflow ? getCurrentWorkflow() : undefined,
          userGroupId,
        },
        {
          onSuccess: (data) => {
            const { nodes: newNodes, edges: newEdges } = workflowToGraph(data.primitives);
            setNodes(newNodes);
            setEdges(newEdges);
          },
          onError: (error) => {
            notifications.show({
              id: 'generate_workflow_error',
              title: 'Failed to Generate Workflow',
              message:
                error.message ||
                'Could not generate workflow. Please try again.',
              icon: <IconX />,
              variant: 'failed_operation',
              autoClose: false,
              withCloseButton: true,
            });
          },
        },
      );
    };

    // A pinned workflow's group is already fixed - no need to ask again on every generate.
    if (pinnedGroup) {
      runGenerate(pinnedGroup.id);
    } else {
      await gateUserGroupAttribution(undefined, runGenerate);
    }
  };

  const handleFileUpload = async (file: File | null) => {
    setFileInputValue(file);
    if (!file) {
      return;
    }

    setIsUploading(true);

    try {
      // Check if document already exists in library
      const existingDoc = libraryDocs?.documents?.find(
        (doc) => doc.filename === file.name,
      );

      if (existingDoc?.uploadStatus === DocumentUploadStatus.Completed) {
        setSelectedDocumentIds((prev) =>
          prev.includes(existingDoc.id) ? prev : [...prev, existingDoc.id],
        );
        notifications.show({
          title: 'Duplicate Detected',
          message: `"${file.name}" already exists in your library and has been selected.`,
          icon: <IconCheck />,
          color: 'blue',
        });
        setIsUploading(false);
        setFileInputValue(null);
        return;
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
        xhr.timeout = 300000;

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

      notifications.show({
        title: 'Processing Document',
        message: 'Document queued for processing...',
        icon: <IconCheck />,
        variant: 'loading_operation',
        autoClose: false,
        id: 'generator-document-processing',
      });

      // Step 4: Poll until document is processed
      const maxAttempts = 150;
      let attempts = 0;

      while (attempts < maxAttempts) {
        const freshDocs = await utils.shared.getDocuments.fetch({ documentUploadProviderId });
        const uploadedDoc = freshDocs.documents.find((d) => d.id === result.documentId);

        if (uploadedDoc?.uploadStatus === DocumentUploadStatus.Failed) {
          throw new Error('Document failed to process');
        }

        if (uploadedDoc?.uploadStatus === DocumentUploadStatus.Completed) {
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 2000));
        attempts++;
      }

      if (attempts >= maxAttempts) {
        throw new Error('Document processing timeout - please check document library');
      }

      notifications.hide('generator-document-processing');

      // Auto-select the uploaded document
      setSelectedDocumentIds((prev) => [...prev, result.documentId]);

      notifications.show({
        title: 'Upload Complete',
        message: `"${file.name}" processed successfully`,
        icon: <IconCheck />,
        variant: 'successful_operation',
      });

      await utils.shared.getDocuments.refetch({ documentUploadProviderId });
    } catch (error) {
      notifications.hide('generator-document-processing');

      let message = 'Failed to upload document';
      if (error instanceof TRPCClientError || error instanceof Error) {
        message = error.message;
      }

      notifications.show({
        title: 'Upload Failed',
        message,
        icon: <IconX />,
        color: 'red',
        autoClose: false,
      });
    } finally {
      setIsUploading(false);
      setFileInputValue(null);
    }
  };

  const getButtonLabel = () => {
    if (isPending) {
      return 'Generating...';
    }
    if (hasExistingWorkflow) {
      return 'Regenerate';
    }
    return 'Generate';
  };

  const getButtonIcon = () => {
    if (hasExistingWorkflow && !isPending) {
      return <IconRefresh size={16} />;
    }
    return <IconSparkles size={16} />;
  };

  return (
    <Paper
      p='md'
      bg='dark.6'
      w={370}
      style={{
        height: '100%',
        overflowY: 'auto',
        borderRadius: 0,
        borderLeft: '1px solid var(--mantine-color-dark-4)',
      }}
    >
      <Stack spacing='xs' style={{ height: '100%' }}>
        <Group spacing='xs' align='center' mb='md'>
          <ThemeIcon size='sm' bg='transparent' c='gray.0'>
            <IconSparkles size={18} />
          </ThemeIcon>
          <Text size='lg' weight={700} c='gray.0' data-testid='generate-workflow-heading'>
            Generate Workflow
          </Text>
        </Group>

        <MultiSelect
          data-testid='document-library-select'
          label='Select from Document Library'
          placeholder={documentOptions.length > 0 ? 'Select documents' : 'No documents available'}
          data={documentOptions}
          value={selectedDocumentIds}
          onChange={setSelectedDocumentIds}
          searchable
          clearable
          maxDropdownHeight={200}
          disabled={isBusy}
          nothingFound='No documents found'
          w='100%'
        />

        <FileInput
          data-testid='upload-from-device-input'
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
          onChange={handleFileUpload}
          accept={DOCUMENT_UPLOAD_ACCEPTED_FILE_TYPES.join(',')}
          disabled={isBusy}
          clearable={!isBusy}
        />

        <Textarea
          data-testid='describe-process-textarea'
          label='Describe your process'
          placeholder='e.g. I want to analyze my compliance documents against our policy framework, identify gaps, and generate a report with recommendations...'
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
          autosize
          rows={5}
          maxRows={15}
          disabled={isBusy}
          variant='filled'
        />

        <Group spacing='lg' grow>
          <Button
            onClick={handleGenerate}
            disabled={!canGenerate || isBusy}
            loading={isPending}
            loaderPosition='left'
            leftIcon={!isPending ? getButtonIcon() : undefined}
          >
            {getButtonLabel()}
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}
