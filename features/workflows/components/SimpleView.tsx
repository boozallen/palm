/**
 * SimpleView - A simplified, clean workflow view
 *
 * Renders all workflow nodes in a minimal layout
 * with a Run button and basic execution status.
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  Box,
  Stack,
  Text,
  Button,
  Loader,
  Alert,
  Divider,
  Accordion,
  Group,
  ThemeIcon,
  Badge,
  Modal,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Node } from 'reactflow';
import {
  IconBrandGithub,
  IconRocket,
  IconCheck,
  IconX,
  IconUpload,
  IconPlayerStop,
  IconExternalLink,
  IconPencil,
} from '@tabler/icons-react';
import useGetAvailableGitHubProviders from '@/features/shared/api/get-available-github-providers';
import { usePushWorkflowArtifactToGithub } from '@/features/workflows/hooks/usePushWorkflowArtifactToGithub';
import { useSaveWorkflowArtifactVersion } from '@/features/workflows/hooks/useSaveWorkflowArtifactVersion';
import { useGetWorkflowArtifactVersions } from '@/features/workflows/api/get-workflow-artifact-versions';
import PushToGithubModal from '@/features/shared/components/modals/PushToGithubModal';
import ArtifactEditor from '@/features/shared/components/ArtifactEditor';
import ArtifactVersionSelector from '@/features/shared/components/ArtifactVersionSelector';
import { useTrackClientEvent } from '@/features/shared/hooks/useTrackClientEvent';
import { useUserGroupAttribution } from '@/features/shared/hooks/userGroupAttribution/useUserGroupAttribution';

import { PrimitiveType } from '@/features/workflows/types/primitive';
import { getNodeDef } from '@/features/workflows/utils/node-registry';
import { useWorkflowBuilder } from '@/features/workflows/providers/WorkflowBuilderProvider';
import { PrimitiveNodeData } from '@/features/workflows/components/nodes/PrimitiveNode';
import { useExecuteWorkflow } from '@/features/workflows/hooks/useExecuteWorkflow';
import { useGetWorkflowStatus } from '@/features/workflows/api/get-workflow-status';
import { useCancelWorkflowExecution } from '@/features/workflows/api/cancel-workflow-execution';
import { convertMarkdownToDocx } from '@/features/chat/utils/artifacts/convertMarkdownToDocx';
import { convertMarkdownToExcel } from '@/features/chat/utils/artifacts/convertMarkdownToXlsx';
import { trpc } from '@/libs';
import { getFileTypeConfig } from '@/features/chat/utils/chatHelperFunctions';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import useGetDocuments from '@/features/shared/api/document-upload/get-documents';
import { DocumentUploadStatus, BINARY_FILE_EXTENSIONS } from '@/features/shared/types/document';

interface SimpleViewProps {
  workflowId?: string;
  onSaveNodeConfig?: (nodeId: string, label: string, config: Record<string, unknown>) => Promise<void>;
}

/* ─── Node Component ─────────────────────────────────────────── */

function NodeConfig({
  node,
  onSaveNodeConfig,
}: Readonly<{
  node: Node<PrimitiveNodeData>;
  onSaveNodeConfig?: (nodeId: string, label: string, config: Record<string, unknown>) => Promise<void>;
}>) {
  const def = getNodeDef(node.data.type);
  const { setNodes } = useWorkflowBuilder();
  const ConfigComponent = def.ConfigComponent;

  const handleConfigChange = useCallback((newConfig: Record<string, unknown>) => {
    setNodes((nds: Node<PrimitiveNodeData>[]) =>
      nds.map(n =>
        n.id === node.id
          ? { ...n, data: { ...n.data, config: newConfig } }
          : n,
      ),
    );

    if (onSaveNodeConfig) {
      onSaveNodeConfig(node.id, node.data.label, newConfig);
    }
  }, [node.id, node.data.label, setNodes, onSaveNodeConfig]);

  return (
    <ConfigComponent
      config={node.data.config ?? {}}
      onChange={handleConfigChange}
    />
  );
}

/* ─── Artifact helpers ────────────────────────────────────────── */

interface ArtifactInfo {
  primitiveId: string;
  artifactId: string | undefined;
  report: string | undefined;
  format: string | undefined;
  filename: string | undefined;
  contentType: string | undefined;
  displayFilename: string;
}

function parseArtifactTraces(trace: Record<string, unknown>[]): ArtifactInfo[] {
  return trace
    .filter(
      (t) =>
        t.primitiveType === PrimitiveType.ARTIFACT &&
        (t.status === 'completed' || t.status === 'success') &&
        ((t.output as Record<string, unknown> | undefined)?.report ||
          (t.output as Record<string, unknown> | undefined)?.artifactId),
    )
    .map((t) => {
      const output = t.output as Record<string, unknown>;
      const config = (t.config ?? {}) as Record<string, unknown>;
      // New format: output.artifactId, output.label, output.fileExtension
      // Old format: output.report, output.filename, config.format
      const artifactId = output.artifactId as string | undefined;
      const format = (output.fileExtension as string | undefined) ?? (config.format as string | undefined);
      const filename = (output.label as string | undefined) ?? (output.filename as string | undefined);
      const report = output.report as string | undefined;
      const displayFilename = filename && filename.includes('.')
        ? filename
        : filename
          ? `${filename}${format}`
          : `report${format}`;

      return {
        primitiveId: t.primitiveId as string,
        artifactId,
        report,
        format,
        filename,
        contentType: output.contentType as string | undefined,
        displayFilename: displayFilename ?? 'report',
      };
    });
}

async function downloadArtifact(artifact: ArtifactInfo) {
  if (!artifact.report) { return; }

  let blob: Blob;

  if (artifact.format === '.xlsx') {
    try {
      blob = await convertMarkdownToExcel(artifact.report);
    } catch {
      blob = new Blob([artifact.report], { type: 'text/plain' });
    }
  } else if (artifact.format === '.docx') {
    try {
      blob = await convertMarkdownToDocx(artifact.report);
    } catch {
      blob = new Blob([artifact.report], { type: 'text/plain' });
    }
  } else if (artifact.format === '.pptx') {
    try {
      const { convertMarkdownToPptx } = await import('@/features/chat/utils/artifacts/convertMarkdownToPptx');
      blob = await convertMarkdownToPptx(artifact.report);
    } catch {
      blob = new Blob([artifact.report], { type: 'text/plain' });
    }
  } else {
    blob = new Blob([artifact.report], { type: artifact.contentType ?? 'text/plain' });
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = artifact.displayFilename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ─── Execution status hook ───────────────────────────────────── */

function useExecutionTrace(executionId: string | null, onComplete: () => void) {
  const { data: statusData } = useGetWorkflowStatus(executionId);
  const hasCalledComplete = useRef(false);

  useEffect(() => {
    hasCalledComplete.current = false;
  }, [executionId]);

  const execution = statusData?.execution;
  const liveTrace = statusData?.progress?.trace;
  const finalTrace = execution?.trace;

  const activeTrace = useMemo(
    () => ((liveTrace?.length ? liveTrace : finalTrace) ?? []) as Record<string, unknown>[],
    [liveTrace, finalTrace],
  );

  const status = (execution?.status as string | undefined) ?? null;
  const isTerminal = status === 'completed' || status === 'failed' || status === 'cancelled';

  useEffect(() => {
    if (isTerminal && !hasCalledComplete.current) {
      hasCalledComplete.current = true;
      onComplete();
    }
  }, [isTerminal, onComplete]);

  const traceDataMap = useMemo(() => {
    const map = new Map<string, Record<string, unknown>>();
    activeTrace.forEach((t: Record<string, unknown>) => {
      map.set(t.primitiveId as string, t);
    });
    return map;
  }, [activeTrace]);

  return {
    status,
    execution,
    traceDataMap,
  };
}

/* ─── Execution Status ────────────────────────────────────────── */

function ExecutionStatus({
  status,
  execution,
}: {
  status: string | null;
  execution: unknown;
}) {
  if (!status || status === 'pending' || status === 'running') {
    return null;
  }

  if (status === 'failed') {
    return (
      <Alert
        icon={<IconX size={14} />}
        color='red'
        variant='light'
        p='sm'
      >
        <Text size='xs'>{(execution as Record<string, unknown>)?.error as string ?? 'An error occurred'}</Text>
      </Alert>
    );
  }

  return null;
}

/* ─── Main Component ──────────────────────────────────────────── */

export default function SimpleView({ workflowId, onSaveNodeConfig }: SimpleViewProps) {
  const { nodes, edges, getCurrentCanvasState, pinnedGroup } = useWorkflowBuilder();
  const executeWorkflow = useExecuteWorkflow();
  const { gate: gateUserGroupAttribution } = useUserGroupAttribution();
  const utils = trpc.useUtils();

  const [executionId, setExecutionId] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  // Build hierarchical structure by levels using edges
  const nodeHierarchy = useMemo(() => {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const childrenMap = new Map<string, Node<PrimitiveNodeData>[]>();
    const parentCounts = new Map<string, number>();

    // Build children map from edges
    edges.forEach(edge => {
      const parent = edge.source;
      const child = edge.target;
      const childNode = nodeMap.get(child);

      if (childNode) {
        const siblings = childrenMap.get(parent) ?? [];
        siblings.push(childNode);
        childrenMap.set(parent, siblings);

        parentCounts.set(child, (parentCounts.get(child) ?? 0) + 1);
      }
    });

    // Find root nodes (nodes with no incoming edges)
    const rootNodes: Node<PrimitiveNodeData>[] = nodes.filter(
      node => !parentCounts.has(node.id),
    );

    // Sort children by X position (left to right) within each parent
    childrenMap.forEach((children) => {
      children.sort((a, b) => (a.position?.x ?? 0) - (b.position?.x ?? 0));
    });

    // Sort root nodes by Y position (top to bottom)
    rootNodes.sort((a, b) => (a.position?.y ?? 0) - (b.position?.y ?? 0));

    // Build levels: breadth-first traversal to group siblings
    const levels: Node<PrimitiveNodeData>[][] = [];
    const visited = new Set<string>();
    const queue: Node<PrimitiveNodeData>[] = [...rootNodes];

    while (queue.length > 0) {
      const levelSize = queue.length;
      const currentLevel: Node<PrimitiveNodeData>[] = [];

      for (let i = 0; i < levelSize; i++) {
        const node = queue.shift()!;
        if (visited.has(node.id)) {
          continue;
        }
        visited.add(node.id);
        currentLevel.push(node);

        // Add children to queue
        const children = childrenMap.get(node.id) ?? [];
        queue.push(...children);
      }

      if (currentLevel.length > 0) {
        levels.push(currentLevel);
      }
    }

    return levels;
  }, [nodes, edges]);

  const handleExecute = async () => {
    if (!workflowId) { return; }

    const runExecution = async (userGroupId: string | undefined) => {
      try {
        setIsExecuting(true);
        const canvasState = getCurrentCanvasState();

        const result = await executeWorkflow.mutateAsync({
          workflowId,
          input: {},
          canvasState,
          userGroupId,
        });

        setExecutionId(result.executionId);
        utils.workflows.getWorkflow.invalidate({ workflowId });
      } catch (error) {
        setIsExecuting(false);
        const message = error instanceof Error ? error.message : 'Failed to execute workflow';
        notifications.show({
          title: 'Execution Error',
          message,
          color: 'red',
          autoClose: false,
        });
      }
    };

    // A pinned workflow's group is already fixed - no need to ask again on every run.
    if (pinnedGroup) {
      await runExecution(pinnedGroup.id);
    } else {
      await gateUserGroupAttribution(undefined, runExecution);
    }
  };

  const handleExecutionComplete = useCallback(() => {
    setIsExecuting(false);
    if (workflowId) {
      utils.workflows.getWorkflow.invalidate({ workflowId });
    }
  }, [workflowId, utils.workflows.getWorkflow]);

  if (nodes.length === 0) {
    return (
      <Box style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Stack align='center' spacing='xs'>
          <Text size='lg' c='gray.4' fw={500}>
            No workflow steps
          </Text>
          <Text size='sm' c='gray.6'>
            Switch to Canvas view to build a workflow
          </Text>
        </Stack>
      </Box>
    );
  }

  return (
    <Box
      style={{
        flex: 1,
        height: '100%',
        overflow: 'auto',
        backgroundColor: 'var(--mantine-color-dark-8)',
      }}
      p='md'
      pt='lg'
    >
      <SimpleViewContent
        nodeHierarchy={nodeHierarchy}
        onSaveNodeConfig={onSaveNodeConfig}
        workflowId={workflowId}
        executionId={executionId}
        isExecuting={isExecuting}
        onExecute={handleExecute}
        onExecutionComplete={handleExecutionComplete}
        executeIsPending={executeWorkflow.isPending}
      />
    </Box>
  );
}

function SimpleViewContent({
  nodeHierarchy,
  onSaveNodeConfig,
  workflowId,
  executionId,
  isExecuting,
  onExecute,
  onExecutionComplete,
  executeIsPending,
}: Readonly<{
  nodeHierarchy: Node<PrimitiveNodeData>[][];
  onSaveNodeConfig?: (nodeId: string, label: string, config: Record<string, unknown>) => Promise<void>;
  workflowId?: string;
  executionId: string | null;
  isExecuting: boolean;
  onExecute: () => void;
  onExecutionComplete: () => void;
  executeIsPending: boolean;
}>) {
  const { status, execution, traceDataMap } = useExecutionTrace(executionId, onExecutionComplete);
  const cancelExecution = useCancelWorkflowExecution();
  const track = useTrackClientEvent();

  const utils = trpc.useUtils();
  const [pushModalArtifact, setPushModalArtifact] = useState<ArtifactInfo | null>(null);
  const [publishedArtifacts, setPublishedArtifacts] = useState<Record<string, string>>({}); // artifactId -> pagesUrl
  const [editArtifact, setEditArtifact] = useState<{ info: ArtifactInfo; content: string } | null>(null);
  const [isLoadingEditContent, setIsLoadingEditContent] = useState(false);
  const [viewedVersionIndex, setViewedVersionIndex] = useState<number | null>(null);
  const pushToGithub = usePushWorkflowArtifactToGithub();
  const saveArtifactVersion = useSaveWorkflowArtifactVersion();
  const { data: versionsData } = useGetWorkflowArtifactVersions(editArtifact?.info.artifactId ?? '');
  const versions = versionsData?.versions ?? [];
  const effectiveVersionIndex = viewedVersionIndex ?? versions.length - 1;
  const viewedVersion = versions.length > 0 ? versions[effectiveVersionIndex] : null;
  const { data: githubProviders } = useGetAvailableGitHubProviders();
  const hasGithubProviders =
    (githubProviders?.availableGitHubProviders?.length ?? 0) > 0;

  const handleCancel = async () => {
    if (!executionId) { return; }

    try {
      await cancelExecution.mutateAsync({ executionId });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to cancel workflow';
      notifications.show({
        title: 'Cancel Error',
        message,
        color: 'red',
      });
    }
  };

  const handleDownloadArtifact = async (artifact: ArtifactInfo) => {
    let artifactToDownload = artifact;
    if (!artifact.report && artifact.artifactId) {
      try {
        const fetched = await utils.workflows.getWorkflowArtifact.fetch({ artifactId: artifact.artifactId });
        artifactToDownload = { ...artifact, report: fetched.content };
      } catch {
        notifications.show({
          title: 'Download failed',
          message: 'Could not fetch artifact content. Please try again.',
          color: 'red',
        });
        return;
      }
    }
    await downloadArtifact(artifactToDownload);
    track.download.workflowArtifact({
      artifactId: artifact.artifactId,
      filename: artifact.displayFilename,
      workflowId,
      workflowExecutionId: executionId,
      primitiveId: artifact.primitiveId,
    });
  };

  const handlePushToGithub = async (providerId: string) => {
    if (!pushModalArtifact?.artifactId) { return; }
    const artifactId = pushModalArtifact.artifactId;
    setPushModalArtifact(null);

    try {
      const result = await pushToGithub.mutateAsync({
        artifactId,
        githubProviderId: providerId,
      });
      if (result.pagesUrl) {
        setPublishedArtifacts((prev) => ({ ...prev, [artifactId]: result.pagesUrl! }));
      }
      notifications.show({
        title: 'Published to GitHub',
        message: '',
        icon: <IconCheck />,
        autoClose: 8000,
        variant: 'successful_operation',
      });
    } catch (error) {
      notifications.show({
        title: 'Push to GitHub failed',
        message: error instanceof Error ? error.message : 'Failed to push artifact to GitHub',
        icon: <IconX />,
        autoClose: true,
        variant: 'failed_operation',
      });
    }
  };

  const handleEditArtifact = async (artifact: ArtifactInfo) => {
    if (!artifact.artifactId) { return; }
    setIsLoadingEditContent(true);
    try {
      const fetched = await utils.workflows.getWorkflowArtifact.fetch({ artifactId: artifact.artifactId });
      setViewedVersionIndex(null);
      setEditArtifact({ info: artifact, content: fetched.content });
      track.editArtifact.workflowArtifact({
        artifactId: artifact.artifactId,
        filename: artifact.displayFilename,
        workflowId,
        workflowExecutionId: executionId,
        primitiveId: artifact.primitiveId,
      });
    } catch {
      notifications.show({
        title: 'Could not open editor',
        message: 'Failed to fetch artifact content. Please try again.',
        color: 'red',
      });
    } finally {
      setIsLoadingEditContent(false);
    }
  };

  const handleSaveEditedArtifact = async (content: string) => {
    if (!editArtifact?.info.artifactId) { return; }
    try {
      const result = await saveArtifactVersion.mutateAsync({
        artifactId: editArtifact.info.artifactId,
        content,
      });
      setEditArtifact(null);
      track.saveArtifactVersion.workflowArtifact({
        artifactId: editArtifact.info.artifactId,
        filename: editArtifact.info.displayFilename,
        workflowId,
        workflowExecutionId: executionId,
        primitiveId: editArtifact.info.primitiveId,
      }, result.versionNumber);
      notifications.show({
        title: 'New version saved',
        message: '',
        icon: <IconCheck />,
        autoClose: true,
        variant: 'successful_operation',
      });
    } catch (error) {
      notifications.show({
        title: 'Save failed',
        message: error instanceof Error ? error.message : 'Failed to save artifact version',
        icon: <IconX />,
        autoClose: true,
        variant: 'failed_operation',
      });
    }
  };

  const handleRestoreArtifactVersion = async () => {
    if (!editArtifact?.info.artifactId || !viewedVersion) { return; }
    try {
      await saveArtifactVersion.mutateAsync({
        artifactId: editArtifact.info.artifactId,
        content: viewedVersion.content,
      });
      setEditArtifact({ ...editArtifact, content: viewedVersion.content });
      setViewedVersionIndex(null);
      track.restoreArtifactVersion.workflowArtifact({
        artifactId: editArtifact.info.artifactId,
        filename: editArtifact.info.displayFilename,
        workflowId,
        workflowExecutionId: executionId,
        primitiveId: editArtifact.info.primitiveId,
      }, viewedVersion.versionNumber);
      notifications.show({
        title: 'Version restored',
        message: '',
        icon: <IconCheck />,
        autoClose: true,
        variant: 'successful_operation',
      });
    } catch (error) {
      notifications.show({
        title: 'Restore failed',
        message: error instanceof Error ? error.message : 'Failed to restore artifact version',
        icon: <IconX />,
        autoClose: true,
        variant: 'failed_operation',
      });
    }
  };

  // Fetch documents for displaying badges
  const { data: systemConfig } = useGetSystemConfig();
  const documentUploadProviderId = systemConfig?.documentLibraryDocumentUploadProviderId || '';
  const { data: libraryDocs } = useGetDocuments({ documentUploadProviderId });
  const documents = (libraryDocs?.documents?.filter(
    (d) => d.uploadStatus === DocumentUploadStatus.Completed && d.text,
  ) ?? []).map((d) => ({
    id: d.id,
    filename: d.filename,
    uploadStatus: d.uploadStatus,
    text: d.text ?? '',
  }));

  // Get completed artifacts for download
  const artifacts = useMemo(() => {
    if (!traceDataMap || traceDataMap.size === 0) { return []; }
    const allTraces = Array.from(traceDataMap.values());
    return parseArtifactTraces(allTraces);
  }, [traceDataMap]);

  return (
    <Stack spacing='md' style={{ maxWidth: '100%', margin: '0 auto', paddingBottom: '24px' }}>
      <PushToGithubModal
        modalOpened={!!pushModalArtifact}
        closeModalHandler={() => setPushModalArtifact(null)}
        onConfirm={handlePushToGithub}
        providers={githubProviders?.availableGitHubProviders ?? []}
        isLoading={pushToGithub.isPending}
      />

      <Modal
        opened={!!editArtifact}
        onClose={() => setEditArtifact(null)}
        title={editArtifact?.info.displayFilename ?? 'Edit artifact'}
        size='xl'
        styles={{ body: { height: '70vh', display: 'flex', flexDirection: 'column' } }}
      >
        {editArtifact && (
          <>
            {versions.length > 0 && (
              <Box px='sm' py='xs' bg='dark.6'>
                <ArtifactVersionSelector
                  versions={versions}
                  selectedIndex={effectiveVersionIndex}
                  onSelectIndex={(index) => {
                    setViewedVersionIndex(index);
                    if (editArtifact?.info.artifactId) {
                      track.navigateArtifactVersion.workflowArtifact({
                        artifactId: editArtifact.info.artifactId,
                        filename: editArtifact.info.displayFilename,
                        workflowId,
                        workflowExecutionId: executionId,
                        primitiveId: editArtifact.info.primitiveId,
                      }, versions[index].versionNumber);
                    }
                  }}
                  onRestore={handleRestoreArtifactVersion}
                  isRestoring={saveArtifactVersion.isPending}
                />
              </Box>
            )}
            <Box style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <ArtifactEditor
                content={viewedVersion ? viewedVersion.content : editArtifact.content}
                fileExtension={editArtifact.info.format ?? ''}
                onSave={handleSaveEditedArtifact}
                onCancel={() => {
                  if (editArtifact?.info.artifactId) {
                    track.cancelEditArtifact.workflowArtifact({
                      artifactId: editArtifact.info.artifactId,
                      filename: editArtifact.info.displayFilename,
                      workflowId,
                      workflowExecutionId: executionId,
                      primitiveId: editArtifact.info.primitiveId,
                    });
                  }
                  setEditArtifact(null);
                }}
                isSaving={saveArtifactVersion.isPending}
              />
            </Box>
          </>
        )}
      </Modal>

      {/* Workflow Nodes - levels with siblings side-by-side */}
      {nodeHierarchy.length > 0 && (
        <Stack spacing='lg'>
          {nodeHierarchy.map((level, levelIndex) => (
            <Box key={`level-${levelIndex}`}>
              {level.length === 1 ? (
                // Single node - full width
                <Box style={{ maxWidth: 550, margin: '0 auto' }}>
                  <NodeAccordionItem
                    node={level[0]}
                    traceDataMap={traceDataMap}
                    documents={documents}
                    isExecuting={isExecuting}
                    onSaveNodeConfig={onSaveNodeConfig}
                  />
                </Box>
              ) : (
                // Multiple siblings - display horizontally
                <Group spacing='md' align='flex-start' position='center' noWrap>
                  {level.map((node) => (
                    <Box key={node.id} style={{ flex: 1, minWidth: 0, maxWidth: 400 }}>
                      <NodeAccordionItem
                        node={node}
                        traceDataMap={traceDataMap}
                        documents={documents}
                        isExecuting={isExecuting}
                        onSaveNodeConfig={onSaveNodeConfig}
                      />
                    </Box>
                  ))}
                </Group>
              )}
            </Box>
          ))}
        </Stack>
      )}

      {nodeHierarchy.length > 0 && (
        <Divider
          color='dark.4'
        />
      )}

      {/* Run or Cancel Button */}
      {isExecuting ? (
        <Button
          leftIcon={<IconPlayerStop size={16} />}
          size='md'
          onClick={handleCancel}
          loading={cancelExecution.isPending}
          color='red'
          variant='outline'
          fullWidth
          style={{ maxWidth: 550, margin: '0 auto' }}
        >
          Cancel
        </Button>
      ) : (
        <Button
          leftIcon={<IconRocket size={16} />}
          size='md'
          onClick={onExecute}
          loading={executeIsPending}
          fullWidth
          style={{ maxWidth: 550, margin: '0 auto' }}
        >
          Run Workflow
        </Button>
      )}

      {/* Execution Status */}
      <Box style={{ maxWidth: 550, margin: '0 auto', width: '100%' }}>
        <ExecutionStatus status={status} execution={execution} />
      </Box>

      {/* Download Artifacts */}
      {artifacts.length > 0 && (
        <Stack spacing='xs' style={{ maxWidth: 550, margin: '0 auto' }}>
          <Text size='xs' fw={600} c='gray.4' tt='uppercase' style={{ letterSpacing: '0.5px' }}>
            Output:
          </Text>
          {artifacts.map((artifact) => (
            <Group key={artifact.primitiveId} spacing='xs' noWrap>
              {(artifact.report || artifact.artifactId) && (
                <Button
                  leftIcon={<IconUpload size={14} />}
                  variant='light'
                  color='green'
                  onClick={() => handleDownloadArtifact(artifact)}
                  style={{ flex: 1 }}
                  size='sm'
                >
                  Download
                </Button>
              )}
              {artifact.artifactId && artifact.format &&
                !BINARY_FILE_EXTENSIONS.includes(artifact.format.toLowerCase()) && (
                <Button
                  leftIcon={<IconPencil size={14} />}
                  variant='light'
                  color='gray'
                  size='sm'
                  onClick={() => handleEditArtifact(artifact)}
                  loading={isLoadingEditContent && editArtifact?.info.primitiveId === artifact.primitiveId}
                >
                  Edit
                </Button>
              )}
              {artifact.artifactId && (publishedArtifacts[artifact.artifactId] || hasGithubProviders) && (
                publishedArtifacts[artifact.artifactId] ? (
                  <Button
                    leftIcon={<IconExternalLink size={14} />}
                    variant='light'
                    color='gray'
                    size='sm'
                    component='a'
                    href={publishedArtifacts[artifact.artifactId]}
                    target='_blank'
                    rel='noopener noreferrer'
                    onClick={() => track.externalLink(
                      `View published artifact: ${artifact.displayFilename}`,
                      publishedArtifacts[artifact.artifactId!],
                    )}
                  >
                    View
                  </Button>
                ) : (
                  <Button
                    leftIcon={<IconBrandGithub size={14} />}
                    variant='light'
                    color='gray'
                    size='sm'
                    onClick={() => setPushModalArtifact(artifact)}
                    loading={pushToGithub.isPending && pushModalArtifact?.primitiveId === artifact.primitiveId}
                  >
                    Publish
                  </Button>
                )
              )}
            </Group>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

/* ─── Node Accordion Item ────────────────────────────────────────── */

function NodeAccordionItem({
  node,
  traceDataMap,
  documents,
  isExecuting,
  onSaveNodeConfig,
}: Readonly<{
  node: Node<PrimitiveNodeData>;
  traceDataMap: Map<string, Record<string, unknown>>;
  documents: Array<{ id: string; filename: string; uploadStatus: DocumentUploadStatus; text: string }>;
  isExecuting: boolean;
  onSaveNodeConfig?: (nodeId: string, label: string, config: Record<string, unknown>) => Promise<void>;
}>) {
  return (
    <Accordion
      variant='separated'
      multiple
      defaultValue={[]}
      styles={{
        item: {
          backgroundColor: 'var(--mantine-color-dark-7)',
          borderColor: 'var(--mantine-color-dark-4)',
        },
        control: {
          minHeight: 'auto',
          backgroundColor: 'var(--mantine-color-dark-7)',
          borderRadius: '6px',
          '&:hover': {
            backgroundColor: 'var(--mantine-color-dark-6)',
          },
          '&[data-active]': {
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
          },
        },
        label: {
          fontSize: '13px',
          fontWeight: 500,
          width: '100%',
        },
        content: {
          paddingTop: '8px',
          backgroundColor: 'var(--mantine-color-dark-7)',
          borderBottomLeftRadius: '6px',
          borderBottomRightRadius: '6px',
        },
        chevron: {
          width: '16px',
          height: '16px',
        },
      }}
    >
      {(() => {
        const def = getNodeDef(node.data.type);
        const IconComponent = def.icon;

        // Get execution status for this node
        const traceData = traceDataMap.get(node.id);
        const nodeStatus = traceData?.status as string | undefined;

        // Get selected document filename for badge (only for document nodes)
        const isDocumentNode = node.data.type === PrimitiveType.DOCUMENT;
        const documentId = node.data.config?.documentId as string | undefined;
        const selectedDoc = documentId ? documents.find(doc => doc.id === documentId) : undefined;
        const documentFilename = selectedDoc?.filename;

        // Check if node should be disabled (workflow is executing but this node hasn't started)
        const isDisabled = isExecuting && !nodeStatus;

        return (
          <Accordion.Item
            key={node.id}
            value={node.id}
            style={{
              borderColor: nodeStatus === 'running' ? 'var(--mantine-color-blue-6)' : undefined,
              borderWidth: nodeStatus === 'running' ? '2px' : undefined,
              opacity: isDisabled ? 0.5 : 1,
              pointerEvents: isDisabled ? 'none' : 'auto',
            }}
          >
            <Accordion.Control
              style={{
                backgroundColor: nodeStatus === 'running' ? 'var(--mantine-color-dark-6)' : undefined,
              }}
            >
              <Box style={{ width: '100%' }}>
                <Group spacing='xs' noWrap position='apart'>
                  <Group spacing='xs' noWrap>
                    <ThemeIcon size='md' bg='transparent' c='gray.5'>
                      <IconComponent size={16} />
                    </ThemeIcon>
                    <Text
                      size='md'
                      c='gray.0'
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {node.data.label}
                    </Text>
                  </Group>
                  {nodeStatus && (
                    <Badge
                      size='sm'
                      color={
                        nodeStatus === 'running' ? 'blue' :
                        nodeStatus === 'completed' || nodeStatus === 'success' ? 'green' :
                        nodeStatus === 'failed' || nodeStatus === 'error' ? 'red' : 'gray'
                      }
                      variant={nodeStatus === 'running' ? 'filled' : 'light'}
                      leftSection={
                        nodeStatus === 'running' ? <Loader size={10} color='white' /> :
                        nodeStatus === 'completed' || nodeStatus === 'success' ? <IconCheck size={12} /> :
                        nodeStatus === 'failed' || nodeStatus === 'error' ? <IconX size={12} /> : undefined
                      }
                      style={{ textTransform: 'capitalize' }}
                    >
                      {nodeStatus === 'running' ? 'Running' :
                       nodeStatus === 'completed' || nodeStatus === 'success' ? 'Complete' :
                       nodeStatus === 'failed' || nodeStatus === 'error' ? 'Failed' : nodeStatus}
                    </Badge>
                  )}
                </Group>

                {isDocumentNode && documentFilename && (() => {
                  const fileConfig = getFileTypeConfig(documentFilename);
                  const FileIcon = fileConfig.icon;

                  return (
                    <Badge
                      size='xs'
                      variant='light'
                      color={fileConfig.color}
                      leftSection={
                        <ThemeIcon
                          size={12}
                          color={fileConfig.color}
                          variant='light'
                          style={{ border: 'none' }}
                          mt='xxs'
                        >
                          <FileIcon size={10} />
                        </ThemeIcon>
                      }
                      style={{
                        textTransform: 'none',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '100%',
                        fontWeight: 500,
                        marginTop: '6px',
                      }}
                    >
                      {documentFilename}
                    </Badge>
                  );
                })()}
              </Box>
            </Accordion.Control>
            <Accordion.Panel>
              <NodeConfig
                node={node}
                onSaveNodeConfig={onSaveNodeConfig}
              />
            </Accordion.Panel>
          </Accordion.Item>
        );
      })()}
    </Accordion>
  );
}
