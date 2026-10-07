/**
 * Conversational Workflow Planner
 * Chat-style interface for iterative workflow planning with the LLM
 */

import { useState, useRef, useEffect } from 'react';
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
  Box,
  ScrollArea,
  Alert,
  Accordion,
  Skeleton,
} from '@mantine/core';
import {
  IconSparkles,
  IconSend,
  IconUpload,
  IconX,
  IconCheck,
  IconAlertCircle,
  IconUser,
  IconRobot,
  IconDeviceFloppy,
  IconFiles,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { TRPCClientError } from '@trpc/client';

import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import useGetDocuments from '@/features/shared/api/document-upload/get-documents';
import useGetAvailableModels from '@/features/shared/api/get-available-models';
import { filterModelsByProviderIds } from '@/features/shared/utils/filterAvailableModels';
import { DocumentUploadStatus, DOCUMENT_UPLOAD_ACCEPTED_FILE_TYPES } from '@/features/shared/types/document';
import useGetPresignedUrl from '@/features/shared/api/document-upload/get-presigned-url';
import useProcessDocument from '@/features/shared/api/document-upload/process-document';
import usePlanWorkflowConversational from '@/features/workflows/api/plan-workflow-conversational';
import { useWorkflowBuilder } from '@/features/workflows/providers/WorkflowBuilderProvider';
import { workflowToGraph, graphToWorkflow } from '@/features/workflows/utils/workflow-conversion';
import { PrimitiveConfig } from '@/features/workflows/types/primitive';
import { trpc } from '@/libs';
import Markdown from '@/components/content/Markdown';
import { useUserGroupAttribution } from '@/features/shared/hooks/userGroupAttribution/useUserGroupAttribution';

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  isReadyToGenerate?: boolean;
}

interface ConversationalWorkflowPlannerProps {
  onSaveWorkflow: () => void;
}

export default function ConversationalWorkflowPlanner({
  onSaveWorkflow,
}: Readonly<ConversationalWorkflowPlannerProps>) {
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [fileInputValue, setFileInputValue] = useState<File | null>(null);
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [workflowGenerated, setWorkflowGenerated] = useState(false);
  const [attributedUserGroupId, setAttributedUserGroupId] = useState<string | undefined>(undefined);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const utils = trpc.useUtils();
  const { data: systemConfig } = useGetSystemConfig();
  const documentUploadProviderId = systemConfig?.documentLibraryDocumentUploadProviderId || '';
  const { data: libraryDocs } = useGetDocuments({ documentUploadProviderId });
  const { data: modelsData } = useGetAvailableModels();

  const { mutateAsync: getPresignedUrl } = useGetPresignedUrl();
  const { mutateAsync: processDocument } = useProcessDocument({
    onSuccess: () => {
      utils.shared.getDocuments.invalidate();
    },
  });

  const { nodes, edges, setNodes, setEdges, pinnedGroup } = useWorkflowBuilder();

  const {
    mutate: planConversational,
    isPending,
  } = usePlanWorkflowConversational();

  const { gate: gateUserGroupAttribution } = useUserGroupAttribution();

  const readyDocs = libraryDocs?.documents?.filter(
    (d) => d.uploadStatus === DocumentUploadStatus.Completed && d.text,
  ) ?? [];

  const documentOptions = readyDocs.map((d) => ({
    value: d.id,
    label: d.filename,
  }));

  const canSend = userInput.trim().length > 0;
  const isBusy = isPending || isUploading;
  const hasNodes = nodes.length > 0;

  // Auto-focus textarea on mount
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  // Auto-scroll to bottom when conversation updates
  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [conversation]);

  // Auto-focus input after LLM responds
  useEffect(() => {
    if (conversation.length > 0 && conversation[conversation.length - 1].role === 'assistant' && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [conversation]);

  const getCurrentWorkflow = (): PrimitiveConfig[] | undefined => {
    if (nodes.length === 0) {
      return undefined;
    }
    return graphToWorkflow(nodes, edges) as PrimitiveConfig[];
  };

  const handleSend = async () => {
    if (!canSend || isBusy) {
      return;
    }

    const messageText = userInput.trim();

    const sendWithGroup = (userGroupId: string | undefined) => {
      setUserInput('');

      // Add user message to conversation
      const userMessage: ConversationMessage = {
        role: 'user',
        content: messageText,
      };
      setConversation((prev) => [...prev, userMessage]);

      // Call the planning API
      planConversational(
        {
          userMessage: messageText,
          documentIds: selectedDocumentIds,
          conversationHistory: conversation,
          currentWorkflow: getCurrentWorkflow(),
          availableModels: filterModelsByProviderIds(modelsData?.availableModels || [], pinnedGroup?.aiProviderIds),
          userGroupId,
        },
        {
          onSuccess: (data) => {
            if (data.type === 'conversation') {
              const assistantMessage: ConversationMessage = {
                role: 'assistant',
                content: data.message,
                isReadyToGenerate: data.isReadyToGenerate,
              };
              setConversation((prev) => [...prev, assistantMessage]);
            } else if (data.type === 'generated') {
              const assistantMessage: ConversationMessage = {
                role: 'assistant',
                content: data.message,
              };
              setConversation((prev) => [...prev, assistantMessage]);

              // Update the workflow builder with generated nodes
              const { nodes: newNodes, edges: newEdges } = workflowToGraph(data.primitives);
              setNodes(newNodes);
              setEdges(newEdges);
              setWorkflowGenerated(true);
            }
          },
          onError: (error) => {
            notifications.show({
              title: 'Error',
              message: error.message || 'Failed to process your message. Please try again.',
              icon: <IconX />,
              color: 'red',
              autoClose: false,
            });
          },
        },
      );
    };

    // A pinned workflow's group is already fixed - no need to ask again on every turn.
    if (pinnedGroup) {
      sendWithGroup(pinnedGroup.id);
      return;
    }

    // Only gate once per planning session - reuse the chosen group for later turns.
    if (conversation.length > 0) {
      sendWithGroup(attributedUserGroupId);
      return;
    }

    const attributed = await gateUserGroupAttribution(undefined, (userGroupId) => {
      setAttributedUserGroupId(userGroupId);
      sendWithGroup(userGroupId);
    });
    if (!attributed) {
      return;
    }
  };

  const handleFileUpload = async (file: File | null) => {
    setFileInputValue(file);
    if (!file) {
      return;
    }

    setIsUploading(true);

    try {
      // Check if document already exists
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

      // Get presigned URL
      const { presignedUrl, fileKey } = await getPresignedUrl({
        fileName: file.name,
        contentType: file.type,
        documentUploadProviderId,
      });

      // Upload to S3
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

      // Queue for processing
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
        id: 'planner-document-processing',
      });

      // Poll until processed
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

      notifications.hide('planner-document-processing');

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
      notifications.hide('planner-document-processing');

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

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Paper
      p='md'
      bg='dark.6'
      w={500}
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 0,
        borderLeft: '1px solid var(--mantine-color-dark-4)',
      }}
    >
      <Stack spacing='md' style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Group spacing='sm' align='center'>
          <ThemeIcon size='sm' bg='transparent' c='gray.0'>
            <IconSparkles size={18} />
          </ThemeIcon>
          <Text size='lg' weight={700} c='gray.0'>
            Generate Workflow
          </Text>
        </Group>

        {/* Instructions - Only show if no conversation started */}
        {conversation.length === 0 && (
          <Alert
            icon={<IconAlertCircle size={16} />}
            color='blue'
            styles={{
              root: {
                backgroundColor: '#1c7ed6',
                border: '1px solid #1864ab',
              },
            }}
          >
            Describe the process or workflow you want to create. I&apos;ll ask clarifying questions to help design the optimal workflow for your needs.
          </Alert>
        )}

        {/* Document Selection - Only show if no conversation started */}
        {conversation.length === 0 && (
          <Accordion variant='contained'>
            <Accordion.Item value='documents'>
              <Accordion.Control icon={<IconFiles size={16} />}>
                Add files to context {selectedDocumentIds.length > 0 && `(${selectedDocumentIds.length})`}
              </Accordion.Control>
              <Accordion.Panel>
                <Stack spacing='md'>
                  <MultiSelect
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
                    size='sm'
                    variant='filled'
                    w='100%'
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
                    onChange={handleFileUpload}
                    accept={DOCUMENT_UPLOAD_ACCEPTED_FILE_TYPES.join(',')}
                    disabled={isBusy}
                    clearable={!isBusy}
                    size='sm'
                    variant='filled'
                  />
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
        )}

        {/* Conversation Area - Only show if conversation started */}
        {conversation.length > 0 && (
          <Box
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
            }}
          >
            <ScrollArea
              ref={scrollAreaRef}
              style={{ flex: 1 }}
              type='auto'
            >
              <Stack spacing='md' p='0'>
                {conversation.map((msg, idx) => (
                  <Box
                    key={idx}
                    p='0'
                    style={{
                      backgroundColor: msg.role === 'user' ? 'var(--mantine-color-dark-5)' : 'var(--mantine-color-dark-7)',
                      borderRadius: '8px',
                      border: '1px solid var(--mantine-color-dark-4)',
                    }}
                  >
                    <Group spacing='xs' mb='xs'>
                      <ThemeIcon size='sm' color={msg.role === 'user' ? 'blue' : 'violet'}>
                        {msg.role === 'user' ? <IconUser size={14} /> : <IconRobot size={14} />}
                      </ThemeIcon>
                      <Text size='sm' weight={600} color={msg.role === 'user' ? 'blue.4' : 'violet.4'}>
                        {msg.role === 'user' ? 'You' : 'Assistant'}
                      </Text>
                    </Group>
                    <Box pl='lg'>
                      <Markdown value={msg.content} />
                    </Box>
                  </Box>
                ))}
                {isPending && (
                  <Box
                    p='0'
                    style={{
                      backgroundColor: 'var(--mantine-color-dark-7)',
                      borderRadius: '8px',
                      border: '1px solid var(--mantine-color-dark-4)',
                    }}
                  >
                    <Group spacing='xs' mb='xs'>
                      <ThemeIcon size='sm' color='violet'>
                        <IconRobot size={14} />
                      </ThemeIcon>
                      <Text size='sm' weight={600} color='violet.4'>
                        Assistant
                      </Text>
                    </Group>
                    <Box p='sm' pl='lg'>
                      <Stack spacing='xs'>
                        <Skeleton height={12} width='90%' radius='sm' />
                        <Skeleton height={12} width='95%' radius='sm' />
                        <Skeleton height={12} width='75%' radius='sm' />
                      </Stack>
                    </Box>
                  </Box>
                )}
              </Stack>
            </ScrollArea>
          </Box>
        )}

        {/* Document Selection - Persistent above input once conversation started */}
        {conversation.length > 0 && (
          <Accordion variant='contained'>
            <Accordion.Item value='documents'>
              <Accordion.Control icon={<IconFiles size={16} />}>
                Add files to context {selectedDocumentIds.length > 0 && `(${selectedDocumentIds.length})`}
              </Accordion.Control>
              <Accordion.Panel>
                <Stack spacing='md'>
                  <MultiSelect
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
                    size='sm'
                    variant='filled'
                    w='100%'
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
                    onChange={handleFileUpload}
                    accept={DOCUMENT_UPLOAD_ACCEPTED_FILE_TYPES.join(',')}
                    disabled={isBusy}
                    clearable={!isBusy}
                    size='sm'
                    variant='filled'
                  />
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
        )}

        {/* Input Area - Always at bottom */}
        <Stack spacing='sm' style={{ flexShrink: 0 }}>
          <Textarea
            ref={textareaRef}
            placeholder={conversation.length === 0 ? 'Describe the workflow you want to create...' : 'Continue the conversation...'}
            value={userInput}
            onChange={(e) => setUserInput(e.currentTarget.value)}
            onKeyPress={handleKeyPress}
            autosize
            minRows={3}
            maxRows={6}
            disabled={isBusy}
            variant='filled'
             styles={(theme) => ({
                input: {
                  '&::placeholder': {
                    color: theme.colors.gray[8],
                  },
                },
              })}
          />
          <Group spacing='sm' grow>
            <Button
              leftIcon={<IconSend size={16} />}
              onClick={handleSend}
              disabled={!canSend || isBusy}
              loading={isPending}
              size='sm'
            >
              Send
            </Button>
            {workflowGenerated && hasNodes && (
              <Button
                leftIcon={<IconDeviceFloppy size={16} />}
                onClick={onSaveWorkflow}
                color='green'
                variant='light'
                size='sm'
              >
                Save Workflow
              </Button>
            )}
          </Group>
        </Stack>
      </Stack>
    </Paper>
  );
}
