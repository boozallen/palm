import { useState, useEffect, useRef, useContext } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import {
  SimpleGrid,
  Stack,
  Text,
  Title,
  Box,
  Button,
  Flex,
  Paper,
  Badge,
  Group,
  Alert,
  Timeline,
  Collapse,
  ActionIcon,
  ScrollArea,
  UnstyledButton,
  ThemeIcon,
  CopyButton,
  Tooltip,
  Avatar,
  HoverCard,
  Divider,
  Spoiler,
  SegmentedControl,
  Skeleton,
  Loader,
  Progress,
} from '@mantine/core';
import {
  IconRocket,
  IconCheck,
  IconX,
  IconAlertCircle,
  IconUpload,
  IconDeviceFloppy,
  IconChevronDown,
  IconChevronUp,
  IconEye,
  IconCode,
  IconCopy,
  IconFileDescription,
  IconVideo,
  IconDownload,
  IconLayoutDashboard,
  IconTopologyStarRing3,
  IconPlayerPlay,
  IconPlayerStop,
  IconHandStop,
  IconExternalLink,
  IconBrandGithub,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { Node, Edge } from 'reactflow';

import { useGetWorkflow } from '@/features/workflows/api/get-workflow';
import { useExecuteWorkflow } from '@/features/workflows/hooks/useExecuteWorkflow';
import { useGetWorkflowStatus } from '@/features/workflows/api/get-workflow-status';
import { useUpdateWorkflow } from '@/features/workflows/hooks/useUpdateWorkflow';
import { useContinueWorkflowExecution } from '@/features/workflows/api/continue-workflow-execution';
import { useCancelWorkflowExecution } from '@/features/workflows/api/cancel-workflow-execution';
import { trpc } from '@/libs';
import Markdown from '@/components/content/Markdown';
import { PREVIEW_AS_RENDERED_FILE_TYPES } from '@/features/shared/types/document';
import { convertMarkdownToDocx } from '@/features/chat/utils/artifacts/convertMarkdownToDocx';
import { convertMarkdownToExcel } from '@/features/chat/utils/artifacts/convertMarkdownToXlsx';
import { useGetUserWorkflowsAccess } from '@/features/shared/api/get-user-workflows-access';
import useGetAvailableGitHubProviders from '@/features/shared/api/get-available-github-providers';
import PushToGithubModal from '@/features/shared/components/modals/PushToGithubModal';
import { usePushWorkflowArtifactToGithub } from '@/features/workflows/hooks/usePushWorkflowArtifactToGithub';
import { useUserGroupAttribution } from '@/features/shared/hooks/userGroupAttribution/useUserGroupAttribution';
import useGetAvailableModels from '@/features/shared/api/get-available-models';
import WorkflowBuilder, { WorkflowViewMode } from '@/features/workflows/components/WorkflowBuilder';
import { WorkflowBuilderProvider, useWorkflowBuilder } from '@/features/workflows/providers/WorkflowBuilderProvider';
import { workflowToGraph, graphToWorkflow, validateWorkflowGraph } from '@/features/workflows/utils/workflow-conversion';
import { PrimitiveType, PrimitiveConfig } from '@/features/workflows/types/primitive';
import { WorkflowStatus, WorkflowStatusLabels } from '@/features/workflows/types/workflow';
import { PrimitiveNodeData } from '@/features/workflows/components/nodes/PrimitiveNode';
import { getNodeDef } from '@/features/workflows/utils/node-registry';
import Breadcrumbs from '@/components/elements/Breadcrumbs';
import CenteredLoader from '@/features/shared/components/CenteredLoader';
import { SafeExitContext } from '@/features/shared/utils';
import { useTrackClientEvent } from '@/features/shared/hooks/useTrackClientEvent';

const VideoPlayer = dynamic(
  () => import('@/features/video-generation/components/VideoPlayer'),
  { ssr: false },
);

// RAG Citation component for workflow LLM prompt node results (similar to chat citations)
const WorkflowCitationContent = ({ citation, sourceLabel }: { citation: string; sourceLabel: string }) => {
  return (
    <Stack spacing='xs'>
      <Group position='apart' align='center' noWrap my='sm'>
        <Title weight='bold' color='blue' order={4} size='sm'>
          {sourceLabel}
        </Title>
      </Group>
      <Text size='xs' color='gray.6'>
        {citation}
      </Text>
    </Stack>
  );
};

const WorkflowCitations = ({ citations }: { citations: any[] }) => {
  const MAX_DISPLAYED_CITATION_ICONS = 3;
  const displayedCitations = citations.slice(0, MAX_DISPLAYED_CITATION_ICONS);
  const remainingCitations = citations.slice(MAX_DISPLAYED_CITATION_ICONS);
  const remainingCitationsCount = remainingCitations.length;

  const remainingCitationsHovercardContent = (
    <Stack spacing='md'>
      {remainingCitations.map((citation, index) => (
        <div key={`${citation.id || index}`}>
          <WorkflowCitationContent
            citation={citation.content}
            sourceLabel={citation.source}
          />
          {index < remainingCitations.length - 1 && <Divider color='gray.2' />}
        </div>
      ))}
    </Stack>
  );

  return (
    <Avatar.Group spacing='sm'>
      {displayedCitations.map((citation, index) => (
        <HoverCard
          key={`${citation.id || index}`}
          shadow='md'
          withArrow
          position='bottom-start'
          withinPortal
        >
          <HoverCard.Target>
            <Avatar
              color='dark.6'
              bg='gray.0'
              radius='xl'
              size='sm'
              style={{ cursor: 'pointer' }}
            >
              <IconFileDescription size={14} />
            </Avatar>
          </HoverCard.Target>
          <HoverCard.Dropdown
            style={{
              maxWidth: '400px',
              maxHeight: '300px',
              overflow: 'auto',
            }}
          >
            <WorkflowCitationContent
              citation={citation.content}
              sourceLabel={citation.source}
            />
          </HoverCard.Dropdown>
        </HoverCard>
      ))}
      {remainingCitationsCount > 0 && (
        <HoverCard
          shadow='md'
          withArrow
          position='bottom-start'
          withinPortal
        >
          <HoverCard.Target>
            <Avatar
              color='dark.6'
              bg='gray.0'
              radius='xl'
              size='sm'
              style={{ cursor: 'pointer' }}
            >
              <Text size='xs' weight={500} color='dark.6'>+{remainingCitationsCount}</Text>
            </Avatar>
          </HoverCard.Target>
          <HoverCard.Dropdown
            style={{
              maxWidth: '400px',
              maxHeight: '300px',
              overflow: 'auto',
            }}
          >
            {remainingCitationsHovercardContent}
          </HoverCard.Dropdown>
        </HoverCard>
      )}
    </Avatar.Group>
  );
};

// Utility function to format duration
const formatDuration = (startedAt: string | Date, completedAt?: string | Date | null, isRunning?: boolean) => {
  if (!startedAt || !completedAt || isRunning) {
    return ''; // Return empty string instead of null
  }
  const startTime = new Date(startedAt);
  const endTime = new Date(completedAt);
  
  // Check for invalid dates
  if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
    return '';
  }
  
  const durationMs = endTime.getTime() - startTime.getTime();
  
  // Check for invalid duration calculation
  if (isNaN(durationMs) || durationMs < 0) {
    return '';
  }
  
  const seconds = Math.max(0, Math.round(durationMs / 1000));
  if (seconds === 0) {
    return '<1s';
  }
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
};

// Utility function to format time ago
const formatTimeAgo = (timestamp: string | Date) => {
  const now = new Date();
  const time = new Date(timestamp);
  const diffMs = now.getTime() - time.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMinutes < 1) {
    return 'just now';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  return `${diffDays}d ago`;
};

// Build DFS tree order so children appear immediately after their parent
const buildPrimitiveTreeOrder = (primitives: any[]): string[] => {
  const visited = new Set<string>();
  const order: string[] = [];

  const allPredsVisited = (nodeId: string): boolean =>
    (primitives.find((p: any) => p.id === nodeId)?.predecessorIds ?? []).every(
      (id: string) => visited.has(id),
    );

  const visit = (nodeId: string) => {
    if (visited.has(nodeId) || !allPredsVisited(nodeId)) { return; }
    visited.add(nodeId);
    order.push(nodeId);
    primitives
      .filter((p: any) => (p.predecessorIds ?? []).includes(nodeId))
      .sort((a: any, b: any) => a.id.localeCompare(b.id))
      .forEach((child: any) => visit(child.id));
  };

  primitives
    .filter((p: any) => (p.predecessorIds ?? []).length === 0)
    .sort((a: any, b: any) => a.id.localeCompare(b.id))
    .forEach((p: any) => visit(p.id));

  // Catch any disconnected nodes
  primitives.filter((p: any) => !visited.has(p.id)).forEach((p: any) => order.push(p.id));
  return order;
};

// Build depth map based on actual graph structure - nodes are nested when they represent branching
const buildPrimitiveDepthMap = (primitives: any[]): Map<string, number> => {
  const map = new Map<string, number>();

  // Build children mapping for each node
  const children = new Map<string, string[]>();
  primitives.forEach((primitive: any) => {
    (primitive.predecessorIds ?? []).forEach((predId: string) => {
      if (!children.has(predId)) {
        children.set(predId, []);
      }
      children.get(predId)!.push(primitive.id);
    });
  });

  const getDepth = (nodeId: string): number => {
    if (map.has(nodeId)) { return map.get(nodeId)!; }

    const node = primitives.find((p: any) => p.id === nodeId);
    if (!node) {
      map.set(nodeId, 0);
      return 0;
    }

    const predecessorIds = node.predecessorIds ?? [];
    
    // Root nodes (no predecessors) are at depth 0
    if (predecessorIds.length === 0) {
      map.set(nodeId, 0);
      return 0;
    }

    // Convergence nodes (multiple predecessors) return to depth 0
    if (predecessorIds.length > 1) {
      map.set(nodeId, 0);
      return 0;
    }

    // Single predecessor - check if we should nest based on parent's branching
    const predId = predecessorIds[0];
    const predChildren = children.get(predId) ?? [];
    
    if (predChildren.length > 1) {
      // This node is part of a branching structure, so it should be nested
      const depth = 1 + getDepth(predId);
      map.set(nodeId, depth);
      return depth;
    } else {
      // Linear flow - inherit the parent's depth without adding
      const depth = getDepth(predId);
      map.set(nodeId, depth);
      return depth;
    }
  };

  // Process all primitives
  primitives.forEach((p: any) => getDepth(p.id));
  
  return map;
};

// Builds a structural snapshot string from a list of primitives.
// Only id, type, and position are included so config-only changes don't trigger "unsaved changes".
const buildWorkflowSnapshot = (primitives: PrimitiveConfig[]): string => {
  const toComparable = (p: PrimitiveConfig) => ({ id: p.id, type: p.type, position: p.position });
  const sortById = (arr: ReturnType<typeof toComparable>[]) =>
    [...arr].sort((a, b) => a.id.localeCompare(b.id));
  const nodesPart = JSON.stringify(sortById(primitives.map(toComparable)));
  const edgesPart = primitives
    .flatMap(p => (p.predecessorIds ?? []).map(predId => `${predId}->${p.id}`))
    .sort()
    .join(',');
  return nodesPart + edgesPart;
};

type RenderJobStatus = 'starting' | 'queued' | 'processing' | 'done' | 'error';

type RenderJobInfo = {
  jobId?: string;
  status: RenderJobStatus;
  progress?: string;
  downloadUrl?: string;
  error?: string;
};

// Utility function to get status badge color
const getStatusColor = (status: string) => {
  switch (status) {
    case WorkflowStatus.COMPLETED:
      return 'green';
    case WorkflowStatus.FAILED:
      return 'red';
    case WorkflowStatus.RUNNING:
      return 'blue';
    case WorkflowStatus.PAUSED:
      return 'yellow';
    case WorkflowStatus.CANCELLED:
      return 'orange';
    default:
      return 'gray';
  }
};

function WorkflowPageContent() {
  const router = useRouter();
  const { workflowId, slug, executionId: queryExecutionId } = router.query;

  const track = useTrackClientEvent();

  const [executionId, setExecutionId] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isContinuing, setIsContinuing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  // Tracks the structural snapshot of the last-saved workflow (id + type + position per primitive).
  // Updated synchronously after every successful save so the hasChanges comparison never
  // races against an async workflow query refetch.
  const savedSnapshotRef = useRef<string | null>(null);
  const { setSafeExitFormToDirty } = useContext(SafeExitContext);

  useEffect(() => {
    setSafeExitFormToDirty(hasChanges);

    return () => {
      setSafeExitFormToDirty(false);
    };
  }, [hasChanges, setSafeExitFormToDirty]);
  const [isSavingNodeConfig, setIsSavingNodeConfig] = useState(false);
  const [showExecutionPanel, setShowExecutionPanel] = useState(false);
  const [expandedExecutions, setExpandedExecutions] = useState<Set<string>>(new Set());
  const [expandedPreviews, setExpandedPreviews] = useState<Set<string>>(new Set());
  const [fetchedArtifacts, setFetchedArtifacts] = useState<Record<string, string>>({}); // artifactId -> content (shared across all executions)
  const [artifactPagesUrls, setArtifactPagesUrls] = useState<Record<string, string | null>>({}); // artifactId -> githubPagesUrl
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
  const [controlMode, setControlMode] = useState<'edit' | 'run'>('edit');
  const [renderJobs, setRenderJobs] = useState<Record<string, RenderJobInfo>>({});
  const renderJobsRef = useRef<Record<string, RenderJobInfo>>({});
  const [enableContinueGates, setEnableContinueGates] = useState(false);
  const [githubPushArtifactId, setGithubPushArtifactId] = useState<string | null>(null);
  const { data: githubProviders } = useGetAvailableGitHubProviders();
  const pushWorkflowArtifactToGithub = usePushWorkflowArtifactToGithub();
  const [workflowViewMode, setWorkflowViewMode] = useState<WorkflowViewMode>('canvas');
  const hasInvalidatedRef = useRef(false);
  const hasProcessedInitialRunRef = useRef(false);
  const executionScrollRef = useRef<HTMLDivElement>(null);
  const [shouldAutoRun, setShouldAutoRun] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(!!router.query.run);

  // Fetch workflow data first - needed by the run effect below
  const { data: workflow, isLoading: loadingWorkflow } = useGetWorkflow(
    workflowId as string
  );

  const { nodes, edges, setNodes, setEdges, viewport, setViewport, pinnedGroup, setPinnedGroup, loadFromLocalStorage, clearLocalStorage, getCurrentCanvasState } = useWorkflowBuilder();

  // Seed the pinned group from the saved workflow (read-only here; the pin is immutable).
  useEffect(() => {
    if (workflow?.pinnedUserGroup !== undefined) {
      setPinnedGroup(workflow.pinnedUserGroup);
    }
  }, [workflow?.pinnedUserGroup, setPinnedGroup]);

  // Auto-open execution panel and set execution ID if requested via query param
  useEffect(() => {
    if (router.query.run && !hasProcessedInitialRunRef.current && workflow) {
      hasProcessedInitialRunRef.current = true;

      setShowExecutionPanel(true);
      setControlMode('run');
      setEnableContinueGates(true); // Enable step-by-step gates for run

      if (queryExecutionId && typeof queryExecutionId === 'string') {
        setExecutionId(queryExecutionId);
        setIsExecuting(true);
        setIsInitialLoading(false);
      } else {
        // Flag to auto-run after component is ready
        setShouldAutoRun(true);
      }

      // Clean up the query parameter after the auto-run has been triggered
      // Delay to ensure the workflow execution has started and UI is ready
      setTimeout(() => {
        const { run: _, ...restQuery } = router.query;
        router.replace(
          {
            pathname: router.pathname,
            query: restQuery,
          },
          undefined,
          { shallow: true }
        );
      }, 1000);
    }
  }, [router.query.run, queryExecutionId, router, workflow]);

  // Debug: log workflow data
  useEffect(() => {
  }, [workflow, loadingWorkflow]);

  // Track if we've already loaded data to prevent infinite loops
  const [hasLoadedInitialData, setHasLoadedInitialData] = useState(false);

  useEffect(() => {
    if (workflow?.definition && workflowId && !hasLoadedInitialData) {
      // First, try to load from localStorage (unsaved work)
      loadFromLocalStorage(workflowId as string);

      // Check if localStorage had data by checking if nodes were populated
      setTimeout(() => {
        if (nodes.length === 0 && workflow.definition.primitives) {
          // Initialize from saved workflow (DB state)
          // workflowToGraph already puts config in node.data.config
          const { nodes: workflowNodes, edges: workflowEdges } = workflowToGraph(workflow.definition.primitives);

          setNodes(workflowNodes);
          setEdges(workflowEdges.map((edge: Edge) => ({ ...edge, type: 'default' })));

          if (workflow.definition.viewport) {
            setViewport(workflow.definition.viewport);
          }
        }
        // Record the DB-saved state as the baseline for the hasChanges comparison.
        // Any localStorage-loaded changes will show as diverging from this snapshot.
        savedSnapshotRef.current = buildWorkflowSnapshot(workflow.definition.primitives ?? []);
        setHasLoadedInitialData(true);
        setHasChanges(false);
      }, 0);
    }
  }, [workflow, workflowId, loadFromLocalStorage, setNodes, setEdges, hasLoadedInitialData]);

  useEffect(() => {
    // Skip comparison while a node config save is in progress
    if (isSavingNodeConfig) {
      return;
    }

    // Wait until initial data has loaded and a saved snapshot is available
    if (!hasLoadedInitialData || savedSnapshotRef.current === null) {
      setHasChanges(false);
      return;
    }

    try {
      const currentSnapshot = buildWorkflowSnapshot(graphToWorkflow(nodes, edges));
      setHasChanges(currentSnapshot !== savedSnapshotRef.current);
    } catch {
      setHasChanges(false);
    }
  }, [nodes, edges, hasLoadedInitialData, isSavingNodeConfig]);

  const executeWorkflow = useExecuteWorkflow();
  const { gate: gateUserGroupAttribution } = useUserGroupAttribution();
  const updateWorkflow = useUpdateWorkflow();
  const continueExecution = useContinueWorkflowExecution();
  const cancelExecution = useCancelWorkflowExecution();
  const { data: statusData } = useGetWorkflowStatus(executionId);
  const utils = trpc.useUtils();
  const renderToMp4Mutation = trpc.video.renderToMp4.useMutation();
  const hasPromptNode = nodes.some(n => n.data.type === PrimitiveType.PROMPT);
  const { data: modelsData } = useGetAvailableModels({ enabled: hasPromptNode });

  // Helper to get human-readable model name
  const getModelName = (modelId: string): string => {
    if (!modelsData) {
      return modelId;
    }
    const model = modelsData.availableModels.find(m => m.id === modelId);
    return model?.name || modelId;
  };

  // Reset invalidation flag when a new execution starts
  useEffect(() => {
    if (executionId) {
      hasInvalidatedRef.current = false;
    }
  }, [executionId]);

  // Populate artifactPagesUrls from DB data whenever execution status loads (current execution)
  useEffect(() => {
    if (statusData?.execution?.artifactGithubPages) {
      setArtifactPagesUrls((prev) => ({
        ...prev,
        ...statusData.execution.artifactGithubPages, // DB values always win
      }));
    }
  }, [statusData?.execution?.artifactGithubPages]);

  // Populate artifactPagesUrls from all recent executions' artifact data (previous executions sidebar)
  useEffect(() => {
    if (workflow?.recentExecutions) {
      const pagesUrls: Record<string, string | null> = {};
      for (const execution of workflow.recentExecutions) {
        for (const artifact of execution.artifacts) {
          pagesUrls[artifact.id] = artifact.githubPagesUrl ?? null;
        }
      }
      setArtifactPagesUrls((prev) => ({ ...prev, ...pagesUrls }));
    }
  }, [workflow?.recentExecutions]);

  // Refresh workflow when execution completes (only once per execution)
  useEffect(() => {
    if (statusData?.execution) {
      const status = statusData.execution.status;
      if (status === WorkflowStatus.COMPLETED || status === WorkflowStatus.FAILED || status === WorkflowStatus.CANCELLED) {
        setIsExecuting(false);
        setIsCancelling(false);
        setIsContinuing(false);
        if (!hasInvalidatedRef.current) {
          hasInvalidatedRef.current = true;
          utils.workflows.getWorkflow.invalidate({ workflowId: workflowId as string });
        }
      }
      // Reset continue state when workflow resumes from paused state
      if (status === WorkflowStatus.RUNNING && isContinuing) {
        setIsContinuing(false);
      }
    }
  }, [statusData, utils.workflows.getWorkflow, workflowId, isContinuing]);

  // Keep renderJobsRef in sync with renderJobs state so the polling interval always reads fresh data
  useEffect(() => {
    renderJobsRef.current = renderJobs;
  }, [renderJobs]);

  // Poll active render jobs every 5 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      const activeEntries = Object.entries(renderJobsRef.current).filter(
        ([, info]) => info.status === 'queued' || info.status === 'processing',
      );
      if (activeEntries.length === 0) {
        return;
      }
      for (const [previewId, info] of activeEntries) {
        if (!info.jobId) {
          continue;
        }
        try {
          const result = await utils.video.getRenderStatus.fetch({ jobId: info.jobId });
          setRenderJobs((prev) => ({
            ...prev,
            [previewId]: {
              jobId: info.jobId,
              status: result.status,
              progress: result.progress,
              downloadUrl: result.downloadUrl,
              error: result.error,
            },
          }));
        } catch {
          // silently ignore transient poll errors
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [utils.video.getRenderStatus]);

  // Handle expanding/collapsing execution details
  const toggleExecutionExpansion = (executionId: string) => {
    setExpandedExecutions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(executionId)) {
        newSet.delete(executionId);
      } else {
        newSet.add(executionId);
      }
      return newSet;
    });
  };

  // Toggle expansion for recent executions (independent of main execution display)
  const handleRecentExecutionClick = (executionId: string) => {
    toggleExecutionExpansion(executionId);
  };

  // Toggle preview expansion for reports
  const togglePreviewExpansion = (previewId: string) => {
    setExpandedPreviews(prev => {
      const newSet = new Set(prev);
      if (newSet.has(previewId)) {
        newSet.delete(previewId);
      } else {
        newSet.add(previewId);
      }
      return newSet;
    });
  };

  const handleSave = async () => {
    try {
      const validation = validateWorkflowGraph(nodes, edges);
      if (!validation.valid) {
        notifications.show({
          title: 'Workflow Validation Failed',
          message: validation.errors.join(', '),
          color: 'red',
          icon: <IconX />,
        });
        return;
      }

      const primitives = graphToWorkflow(nodes, edges);

      await updateWorkflow.mutateAsync({
        workflowId: workflowId as string,
        primitives,
        viewport,
      });

      // Update the baseline snapshot synchronously so the hasChanges effect compares
      // against what we just saved rather than the (potentially stale) workflow query.
      savedSnapshotRef.current = buildWorkflowSnapshot(primitives);
      clearLocalStorage(workflowId as string);
      setHasChanges(false);
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to update workflow',
        color: 'red',
        icon: <IconX />,
      });
    }
  };

  const handleSaveNodeConfig = async (nodeId: string, label: string, config: Record<string, unknown>) => {
    try {
      setIsSavingNodeConfig(true);

      if (!workflow?.definition) {
        throw new Error('Workflow not found');
      }

      // Update nodes state
      setNodes((currentNodes: Node<PrimitiveNodeData>[]) =>
        currentNodes.map((node: Node<PrimitiveNodeData>) =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, label, config } }
            : node
        )
      );

      // Build updated nodes for conversion (nodes state is async, so we compute manually)
      const updatedNodes = nodes.map((node: Node<PrimitiveNodeData>) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, label, config } }
          : node
      );

      const currentPrimitives = graphToWorkflow(updatedNodes, edges);

      await updateWorkflow.mutateAsync({
        workflowId: workflowId as string,
        primitives: currentPrimitives,
        viewport,
      });

      // Update the baseline snapshot — this save includes current node positions, so
      // the canvas is now in sync with the DB even if nodes were dragged beforehand.
      savedSnapshotRef.current = buildWorkflowSnapshot(currentPrimitives);
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to save node configuration');
    } finally {
      setIsSavingNodeConfig(false);
    }
  };

  const handleExecute = async () => {
    const runExecution = async (userGroupId: string | undefined) => {
      try {
        const input: Record<string, any> = {};

        setIsExecuting(true);

        // Clear node selection when starting execution
        setNodes((nds: Node<PrimitiveNodeData>[]) =>
          nds.map((node: Node<PrimitiveNodeData>) => ({ ...node, selected: false }))
        );

        // Get current canvas state for execution
        const canvasState = getCurrentCanvasState();

        const result = await executeWorkflow.mutateAsync({
          workflowId: workflowId as string,
          input,
          canvasState,
          enableContinueGates,
          userGroupId,
        });

        setExecutionId(result.executionId);

        // Invalidate workflow query to refresh recent executions
        utils.workflows.getWorkflow.invalidate({ workflowId: workflowId as string });
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

  // Auto-run workflow after component is ready
  useEffect(() => {
    if (shouldAutoRun && workflow && !isExecuting) {
      setShouldAutoRun(false);
      handleExecute();
      // Clear initial loading state once execution starts
      setIsInitialLoading(false);
    }
  }, [shouldAutoRun, workflow, isExecuting]);

  if (loadingWorkflow || isInitialLoading) {
    return <CenteredLoader />;
  }

  if (!workflow) {
    return (
      <Stack p='xl'>
        <Alert icon={<IconAlertCircle size={16} />} title='Not Found' color='red'>
          Workflow not found
        </Alert>
      </Stack>
    );
  }

  const liveTrace = statusData?.progress?.trace;
  const finalTrace = statusData?.execution?.trace;
  const activeTrace = (liveTrace?.length ? liveTrace : finalTrace) ?? [];

  const primitives: any[] = workflow.definition?.primitives ?? [];
  const treeOrder = buildPrimitiveTreeOrder(primitives);
  const depthMap = buildPrimitiveDepthMap(primitives);

  // Sort trace maintaining proper hierarchical relationships
  const sortedTrace = [...activeTrace].sort((a: any, b: any) => {
    const ai = treeOrder.indexOf(a.primitiveId);
    const bi = treeOrder.indexOf(b.primitiveId);
    if (ai === -1 && bi === -1) { return 0; }
    if (ai === -1) { return 1; }
    if (bi === -1) { return -1; }
    return ai - bi;
  });

  const calculateTotalTimelineItems = () => sortedTrace.length;

  const totalTimelineItems = calculateTotalTimelineItems();

  const handlePushToGithub = async (providerId: string) => {
    if (!githubPushArtifactId) { return; }
    const artifactId = githubPushArtifactId;
    setGithubPushArtifactId(null);

    try {
      const result = await pushWorkflowArtifactToGithub.mutateAsync({
        artifactId,
        githubProviderId: providerId,
      });
      if (result.pagesUrl) {
        setArtifactPagesUrls((prev) => ({ ...prev, [artifactId]: result.pagesUrl }));
      }
      notifications.show({
        title: 'Artifact pushed to GitHub',
        message: (
          <div>
            Artifact {result.action} successfully on GitHub
            <br />
            <a
              href={result.url}
              target='_blank'
              rel='noopener noreferrer'
              style={{ color: '#4dabf7', textDecoration: 'underline' }}
            >
              View on GitHub
            </a>
            {result.pagesUrl && (
              <>
                <br />
                <a
                  href={result.pagesUrl}
                  target='_blank'
                  rel='noopener noreferrer'
                  style={{ color: '#4dabf7', textDecoration: 'underline' }}
                >
                  View on GitHub Pages
                </a>
              </>
            )}
          </div>
        ),
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

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <SimpleGrid cols={1} p='md' pb='0' bg='dark.7'>
        <Stack spacing='xxs'>
          <Title fz='xxl' order={1} align='left' color='gray.1'>
            {workflow.name}
          </Title>
          {workflow.description && (
            <Text fz='md' c='gray.6'>{workflow.description}</Text>
          )}
        </Stack>
        <Flex justify='space-between' align='center'>
          <Breadcrumbs links={[
            { title: 'Workflows', href: '/workflows' },
            { title: workflow.name, href: null },
          ]} />
          <Group spacing='xs'>
            {/* Canvas/Simple View Toggle - Icon only with tooltips */}
            <Group spacing={4}>
              <Tooltip label='Canvas view for editing workflow steps'>
                <ActionIcon
                  variant={workflowViewMode === 'canvas' ? 'filled' : 'subtle'}
                  color={workflowViewMode === 'canvas' ? 'blue' : 'gray'}
                  onClick={() => setWorkflowViewMode('canvas')}
                  size='md'
                >
                  <IconTopologyStarRing3 size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label='Simplified view'>
                <ActionIcon
                  variant={workflowViewMode === 'simple' ? 'filled' : 'subtle'}
                  color={workflowViewMode === 'simple' ? 'blue' : 'gray'}
                  onClick={() => setWorkflowViewMode('simple')}
                  size='md'
                >
                  <IconLayoutDashboard size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>
            {/* Save Button - Always visible but disabled when no changes */}
            <ActionIcon
              variant='light'
              disabled={!hasChanges}
              loading={updateWorkflow.isPending}
              onClick={handleSave}
              size='md'
              color={hasChanges ? 'gray' : 'blue'}
              sx={(theme) => ({
                backgroundColor: hasChanges ? theme.colors.blue[6] : theme.colors.dark[4],
                color: hasChanges ? theme.white : theme.colors.gray[6],
                '&:hover': {
                  backgroundColor: hasChanges ? theme.colors.blue[5] : theme.colors.dark[4],
                },
                '&:disabled': {
                  backgroundColor: `${theme.colors.dark[4]} !important`,
                  color: `${theme.colors.gray[6]} !important`,
                },
              })}
            >
              <IconDeviceFloppy size={24} />
            </ActionIcon>
          </Group>
        </Flex>
      </SimpleGrid>

      <Box style={{ 
        display: 'flex', 
        flexGrow: 1, 
        backgroundColor: 'var(--mantine-color-dark-8)', 
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Main Canvas Area - Full width container */}
        <Box style={{
          width: '100%',
          position: 'relative',
          display: 'flex',
        }} p='md'>
          {/* Workflow Controls - Only show Edit/Run toggle in canvas mode */}
          {workflowViewMode === 'canvas' && (
            <Box style={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <SegmentedControl
                mt='-md'
                styles={{
                  label: {
                    padding: '4px 8px',
                  },
                }}
                value={controlMode}
                onChange={(value: string) => {
                  setControlMode(value as 'edit' | 'run');
                  if (value === 'run') {
                    setShowExecutionPanel(true);
                  } else {
                    setShowExecutionPanel(false);
                  }
                }}
                data={[
                  {
                    value: 'edit',
                    label: 'Editor',
                  },
                  {
                    value: 'run',
                    label: 'Executions',
                  },
                ]}
              />
            </Box>
          )}

          <PushToGithubModal
            modalOpened={!!githubPushArtifactId}
            closeModalHandler={() => setGithubPushArtifactId(null)}
            onConfirm={handlePushToGithub}
            providers={githubProviders?.availableGitHubProviders ?? []}
            isLoading={pushWorkflowArtifactToGithub.isPending}
          />

          <WorkflowBuilder
            workflowId={workflowId as string}
            onSaveNodeConfig={handleSaveNodeConfig}
            viewMode={workflowViewMode}
            executionTrace={activeTrace as Array<{ primitiveId: string; status: string }>}
            isExecuting={isExecuting}
            executionPanel={showExecutionPanel && workflowViewMode === 'canvas' ? (
              <Box 
                bg='dark.6' 
                style={{ 
                  width: '40%',
                  borderLeft: '1px solid var(--mantine-color-dark-4)',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <Box 
                  p='md'
                  style={{
                    flex: 1,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <Stack 
                    spacing='md'
                    style={{
                      flex: 1,
                      overflow: 'hidden',
                      maxHeight: '100%',
                    }}
                  >
                    <Stack spacing='sm' style={{ flexShrink: 0 }}>
                      {/* Run Button with Continue Gates Toggle */}
                      <Group spacing='sm' position='right'>
                        <Tooltip label='Pause for confirmation between steps' position='left'>
                          <ActionIcon
                            size='lg'
                            variant={!isExecuting && enableContinueGates ? 'filled' : 'outline'}
                            color={!isExecuting && enableContinueGates ? 'blue' : 'gray'}
                            onClick={() => setEnableContinueGates(!enableContinueGates)}
                            disabled={isExecuting}
                          >
                            <IconHandStop size={20} />
                          </ActionIcon>
                        </Tooltip>
                        <Button
                          leftIcon={!isExecuting ? <IconRocket size={16} /> : undefined}
                          onClick={async () => {
                            if (isExecuting) {
                              // Stop the workflow
                              setIsCancelling(true);
                              try {
                                await cancelExecution.mutateAsync({
                                  executionId: executionId!,
                                });
                                // Don't set isExecuting/isCancelling to false here - let the useEffect handle it when status changes to CANCELLED
                              } catch (error) {
                                notifications.show({
                                  title: 'Error',
                                  message: error instanceof Error ? error.message : 'Failed to stop workflow',
                                  color: 'red',
                                  icon: <IconX />,
                                });
                                setIsExecuting(false);
                                setIsCancelling(false);
                              }
                            } else {
                              // Run the workflow
                              handleExecute();
                            }
                          }}
                          disabled={statusData?.execution?.status === WorkflowStatus.PAUSED || isCancelling}
                          loading={isExecuting && isCancelling}
                          variant={isExecuting ? 'outline' : 'filled'}
                          size='sm'
                          color={isExecuting ? 'red' : 'blue'}
                        >
                          {isExecuting ? 'Cancel' : 'Run'}
                        </Button>
                      </Group>
                    </Stack>

                    {/* Scrollable Execution Results Container */}
                    <Box
                      style={{
                        flex: 1,
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      <Box
                        ref={executionScrollRef}
                        style={{
                          flex: 1,
                          overflowY: 'auto',
                          overflowX: 'hidden',
                        }}
                      >
                        <Stack spacing='lg'>

                {/* Execution Results */}
                {statusData?.execution && (
                  <Paper p='md' withBorder bg='dark.6'>
                    <Stack spacing='md'>
                      <Group position='apart'>
                        <Text size='xssm' color='gray.6'>
                          {statusData.execution.status === WorkflowStatus.COMPLETED
                            ? `Succeeded ${formatTimeAgo(statusData.execution.completedAt || statusData.execution.startedAt)}${formatDuration(statusData.execution.startedAt, statusData.execution.completedAt) ? ` in ${formatDuration(statusData.execution.startedAt, statusData.execution.completedAt)}` : ''}`
                            : statusData.execution.status === WorkflowStatus.FAILED
                              ? `Failed ${formatTimeAgo(statusData.execution.completedAt || statusData.execution.startedAt)}`
                              : statusData.execution.status === WorkflowStatus.CANCELLED
                                ? `Cancelled ${formatTimeAgo(statusData.execution.completedAt || statusData.execution.startedAt)}`
                                : statusData.execution.status === WorkflowStatus.RUNNING
                                  ? 'Running...'
                                  : 'Execution'
                          }
                        </Text>
                        <Badge color={getStatusColor(statusData.execution.status)}>
                          {WorkflowStatusLabels[statusData.execution.status as WorkflowStatus]}
                        </Badge>
                      </Group>

                      {activeTrace.length > 0 ? (
                        <Timeline active={totalTimelineItems} bulletSize={30} lineWidth={2}>
                          {sortedTrace.map((trace: any) => {
                            // For finished executions, only use the historical config from execution trace
                            // Don't fall back to current definition as that would be misleading
                            const config = trace.config || {};

                            const detail = (() => {
                              switch (trace.primitiveType) {
                                case PrimitiveType.DOCUMENT: {
                                  const docs: any[] = trace.output?.documents || [];
                                  if (docs.length === 0) { return null; }
                                  return (
                                    <Text size='xs' color='gray.6'>
                                      {docs.map((d: any) => d.filename).join(', ')}
                                    </Text>
                                  );
                                }
                                case PrimitiveType.PROMPT: {
                                  const model = trace.metadata?.model || config.model;
                                  const prompt = trace.metadata?.prompt || config.prompt;
                                  const response = trace.output?.response;
                                  const citations = trace.output?.citations || [];

                                  return (
                                    <Stack spacing={4}>
                                      {model && (
                                        <Box>
                                          <Text size='sm' weight={500} color='blue.6'>Model:</Text>
                                          <Text size='xs' color='gray.6'>{getModelName(model)}</Text>
                                        </Box>
                                      )}
                                      {prompt && (
                                        <Box>
                                          <Text size='sm' weight={500} color='blue.6'>Prompt:</Text>
                                          <Spoiler maxHeight={48} showLabel='Show more' hideLabel='Show less'>
                                            <Text size='xs' color='gray.6'>{prompt}</Text>
                                          </Spoiler>
                                        </Box>
                                      )}
                                      {response && (
                                        <Box>
                                          <Text size='sm' weight={500} color='green.6'>Output:</Text>
                                          <Spoiler maxHeight={48} showLabel='Show more' hideLabel='Show less'>
                                            <Text size='xs' color='gray.6'>{response}</Text>
                                          </Spoiler>

                                          {/* Citations (RAG sources) */}
                                          {citations.length > 0 && (
                                            <Box mt={6}>
                                              <WorkflowCitations citations={citations} />
                                            </Box>
                                          )}
</Box>
                                      )}
                                    </Stack>
                                  );
                                }
                                case PrimitiveType.ARTIFACT: {
                                  // Backward compatibility: support both old and new output structures
                                  const artifactId = trace.output?.artifactId;
                                  const label = trace.output?.label || trace.output?.filename; // New || Old
                                  const fileExtension = trace.output?.fileExtension || trace.output?.format || config.format; // New || Old || Config
                                  const legacyContent = trace.output?.report; // Old structure had content inline

                                  const displayFilename = label && label.includes('.') ? label : label ? `${label}${fileExtension}` : `report${fileExtension}`;
                                  const previewId = `${trace.primitiveId}-preview-${statusData.execution.id}`;
                                  const isPreviewExpanded = expandedPreviews.has(previewId);

                                  // Get content: fetched from DB, or legacy inline content
                                  const artifactContent = artifactId ? fetchedArtifacts[artifactId] : legacyContent;

                                  return (
                                    <Stack spacing={6}>
                                      {label && (artifactId || legacyContent) && (
                                        <Box>
                                          <Stack spacing={8}>
                                            <Group pt='xs' spacing={8}>
                                              <Button
                                                leftIcon={<IconEye size={12} />}
                                                size='xs'
                                                variant='outline'
                                                color='blue'
                                                onClick={async (e: React.MouseEvent) => {
                                                  e.stopPropagation();
                                                  // Fetch artifact content if not already cached
                                                  if (artifactId && !fetchedArtifacts[artifactId] && !isPreviewExpanded) {
                                                    try {
                                                      const artifact = await utils.client.workflows.getWorkflowArtifact.query({ artifactId });
                                                      setFetchedArtifacts(prev => ({ ...prev, [artifactId]: artifact.content }));
                                                      setArtifactPagesUrls(prev => ({ ...prev, [artifactId]: artifact.githubPagesUrl ?? null }));
                                                    } catch (error) {
                                                      console.error('Failed to fetch artifact for preview:', error);
                                                    }
                                                  }
                                                  togglePreviewExpansion(previewId);
                                                }}
                                              >
                                                {isPreviewExpanded ? 'Hide' : 'Preview'}
                                              </Button>
                                              {fileExtension !== '.mp4' && (
                                                <Button
                                                  leftIcon={<IconUpload size={12} />}
                                                  size='xs'
                                                  color='green'
                                                  variant='light'
                                                  onClick={async (e: React.MouseEvent) => {
                                                    e.stopPropagation();

                                                    // Fetch content: new structure uses artifactId, old structure has content inline
                                                    let actualContent: string;
                                                    if (artifactId) {
                                                      try {
                                                        const artifact = await utils.client.workflows.getWorkflowArtifact.query({ artifactId });
                                                        actualContent = artifact.content;
                                                      } catch (error) {
                                                        console.error('Failed to fetch artifact:', error);
                                                        return;
                                                      }
                                                    } else {
                                                      // Backward compatibility: use inline content
                                                      actualContent = legacyContent || '';
                                                    }

                                                    let blob: Blob;

                                                    if (fileExtension === '.xlsx') {
                                                      try {
                                                        blob = await convertMarkdownToExcel(actualContent);
                                                      } catch {
                                                        blob = new Blob([actualContent], { type: 'text/plain' });
                                                      }
                                                    } else if (fileExtension === '.docx') {
                                                      try {
                                                        blob = await convertMarkdownToDocx(actualContent);
                                                      } catch {
                                                        blob = new Blob([actualContent], { type: 'text/plain' });
                                                      }
                                                    } else if (fileExtension === '.pptx') {
                                                      try {
                                                        const { convertMarkdownToPptx } = await import('@/features/chat/utils/artifacts/convertMarkdownToPptx');
                                                        blob = await convertMarkdownToPptx(actualContent);
                                                      } catch (error) {
                                                        console.error('Failed to convert markdown to pptx:', error);
                                                        blob = new Blob([actualContent], { type: 'text/plain' });
                                                      }
                                                    } else {
                                                      // Determine content type from fileExtension
                                                      const contentTypeMap: Record<string, string> = {
                                                        '.json': 'application/json',
                                                        '.html': 'text/html',
                                                        '.csv': 'text/csv',
                                                        '.txt': 'text/plain',
                                                        '.mmd': 'text/vnd.mermaid',
                                                        '.md': 'text/markdown',
                                                      };
                                                      const contentType = contentTypeMap[fileExtension] || 'application/octet-stream';
                                                      blob = new Blob([actualContent], { type: contentType });
                                                    }

                                                    const url = URL.createObjectURL(blob);
                                                    const a = document.createElement('a');
                                                    a.href = url;
                                                    a.download = displayFilename;
                                                    a.click();
                                                    URL.revokeObjectURL(url);
                                                    track.download.workflowArtifact({
                                                      artifactId,
                                                      filename: displayFilename,
                                                      workflowId: typeof workflowId === 'string' ? workflowId : null,
                                                      workflowExecutionId: statusData.execution.id,
                                                      primitiveId: trace.primitiveId,
                                                    });
                                                  }}
                                                >
                                                  Download
                                                </Button>
                                              )}
                                              {fileExtension === '.html' && (
                                                <Button
                                                  leftIcon={<IconExternalLink size={12} />}
                                                  size='xs'
                                                  onClick={(e: React.MouseEvent) => {
                                                    e.stopPropagation();
                                                    const url = `/workflows/${slug}/view/${statusData.execution.id}/${trace.primitiveId}`;
                                                    track.navigate(displayFilename, url);
                                                    window.open(url, '_blank');
                                                  }}
                                                >
                                                  Open
                                                </Button>
                                              )}
                                              {fileExtension === '.html' && artifactId && (artifactPagesUrls[artifactId] !== undefined || (githubProviders?.availableGitHubProviders?.length ?? 0) > 0) && (
                                                artifactPagesUrls[artifactId] ? (
                                                  <Button
                                                    leftIcon={<IconExternalLink size={12} />}
                                                    size='xs'
                                                    color='gray'
                                                    variant='light'
                                                    component='a'
                                                    href={artifactPagesUrls[artifactId]!}
                                                    target='_blank'
                                                    rel='noopener noreferrer'
                                                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                                                  >
                                                    View
                                                  </Button>
                                                ) : (
                                                  <Button
                                                    leftIcon={<IconBrandGithub size={12} />}
                                                    size='xs'
                                                    color='gray'
                                                    variant='light'
                                                    loading={pushWorkflowArtifactToGithub.isPending && githubPushArtifactId === artifactId}
                                                    onClick={(e: React.MouseEvent) => {
                                                      e.stopPropagation();
                                                      setGithubPushArtifactId(artifactId);
                                                    }}
                                                  >
                                                    Publish
                                                  </Button>
                                                )
                                              )}
                                              {fileExtension === '.mp4' && !renderJobs[previewId] && (
                                                <Button
                                                  leftIcon={<IconVideo size={12} />}
                                                  size='xs'
                                                  color='violet'
                                                  variant='light'
                                                  onClick={async (e: React.MouseEvent) => {
                                                    e.stopPropagation();
                                                    let slidesJson: string;
                                                    if (artifactId) {
                                                      try {
                                                        const artifact = await utils.client.workflows.getWorkflowArtifact.query({ artifactId });
                                                        slidesJson = artifact.content;
                                                      } catch (error) {
                                                        console.error('Failed to fetch artifact:', error);
                                                        return;
                                                      }
                                                    } else {
                                                      slidesJson = legacyContent || '';
                                                    }
                                                    setRenderJobs((prev) => ({
                                                      ...prev,
                                                      [previewId]: { status: 'starting' },
                                                    }));
                                                    renderToMp4Mutation.mutate(
                                                      { slidesJson },
                                                      {
                                                        onSuccess: ({ jobId }) => {
                                                          setRenderJobs((prev) => ({
                                                            ...prev,
                                                            [previewId]: { jobId, status: 'queued' },
                                                          }));
                                                        },
                                                        onError: (err) => {
                                                          setRenderJobs((prev) => ({
                                                            ...prev,
                                                            [previewId]: { status: 'error', error: err.message },
                                                          }));
                                                        },
                                                      },
                                                    );
                                                  }}
                                                >
                                                  Export MP4
                                                </Button>
                                              )}
                                              {fileExtension === '.mp4' && renderJobs[previewId] && (renderJobs[previewId].status === 'starting' || renderJobs[previewId].status === 'queued' || renderJobs[previewId].status === 'processing') && (
                                                <Stack spacing={4} style={{ minWidth: 120 }}>
                                                  <Text size='xs' color='dimmed'>
                                                    {renderJobs[previewId].status === 'starting'
                                                      ? 'Starting...'
                                                      : renderJobs[previewId].status === 'queued'
                                                      ? 'Queued...'
                                                      : renderJobs[previewId].progress ?? 'Rendering...'}
                                                  </Text>
                                                  {renderJobs[previewId].status === 'processing' && (
                                                    <Progress
                                                      value={parseInt((renderJobs[previewId].progress ?? '0%').match(/(\d+)/)?.[1] ?? '0')}
                                                      size='xs'
                                                      color='violet'
                                                    />
                                                  )}
                                                </Stack>
                                              )}
                                              {fileExtension === '.mp4' && renderJobs[previewId]?.status === 'done' && renderJobs[previewId].downloadUrl && (
                                                <Button
                                                  component='a'
                                                  href={renderJobs[previewId].downloadUrl}
                                                  leftIcon={<IconDownload size={12} />}
                                                  size='xs'
                                                  color='green'
                                                  variant='filled'
                                                >
                                                  Download MP4
                                                </Button>
                                              )}
                                              {fileExtension === '.mp4' && renderJobs[previewId]?.status === 'error' && (
                                                <Text size='xs' color='red.6'>
                                                  {renderJobs[previewId].error ?? 'Render failed'}
                                                </Text>
                                              )}
                                            </Group>

                                            <Collapse in={isPreviewExpanded}>
                                                {artifactContent ? (
                                                <Box
                                                  style={{
                                                    border: '1px solid var(--mantine-color-dark-4)',
                                                    borderRadius: '8px',
                                                    backgroundColor: 'var(--mantine-color-dark-7)',
                                                    maxHeight: '500px',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                  }}
                                                >
                                                {/* Artifact Header */}
                                                <Group
                                                  px='md'
                                                  py='sm'
                                                  position='apart'
                                                  bg='dark.4'
                                                  style={{ borderBottom: '1px solid var(--mantine-color-dark-4)' }}
                                                >
                                                  {PREVIEW_AS_RENDERED_FILE_TYPES.includes(fileExtension) ? (
                                                    <Box bg='dark.8' style={{ borderRadius: '8px' }}>
                                                      <UnstyledButton
                                                        variant='toggle_artifact_view'
                                                        className={viewMode === 'preview' ? 'active' : ''}
                                                        onClick={() => setViewMode('preview')}
                                                        aria-label='Preview'
                                                      >
                                                        <ThemeIcon size='md'>
                                                          <IconEye stroke={1.5} size='sm' />
                                                        </ThemeIcon>
                                                      </UnstyledButton>
                                                      <UnstyledButton
                                                        variant='toggle_artifact_view'
                                                        className={viewMode === 'preview' ? '' : 'active'}
                                                        onClick={() => setViewMode('code')}
                                                        aria-label='Code'
                                                      >
                                                        <ThemeIcon size='md'>
                                                          <IconCode stroke={1.5} size='sm' />
                                                        </ThemeIcon>
                                                      </UnstyledButton>
                                                    </Box>
                                                  ) : (
                                                    <Box />
                                                  )}

                                                  <Group spacing='sm'>
                                                    <CopyButton value={artifactContent || ''} timeout={2000}>
                                                      {({ copied, copy }) => (
                                                        <Tooltip label={copied ? 'Copied' : 'Copy'} position='left'>
                                                          <ActionIcon
                                                            size='sm'
                                                            color={copied ? 'teal' : 'gray'}
                                                            onClick={() => {
                                                              copy();
                                                              track.copy.workflowArtifact({
                                                                artifactId,
                                                                filename: displayFilename,
                                                                workflowId: typeof workflowId === 'string' ? workflowId : null,
                                                                workflowExecutionId: statusData.execution.id,
                                                                primitiveId: trace.primitiveId,
                                                              });
                                                            }}
                                                          >
                                                            {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                                                          </ActionIcon>
                                                        </Tooltip>
                                                      )}
                                                    </CopyButton>
                                                  </Group>
                                                </Group>

                                                {/* Artifact Content */}
                                                <Box
                                                  style={{
                                                    minHeight: fileExtension === '.mp4' ? '400px' : '200px',
                                                    ...(fileExtension === '.html' && viewMode === 'preview' ? { height: '80vh' } : {}),
                                                    overflow: 'auto',
                                                    backgroundColor: (fileExtension === '.md' || fileExtension === '.html') && viewMode === 'preview' ? 'var(--mantine-color-dark-6)' : 'var(--mantine-color-dark-9)',
                                                  }}
                                                >
                                                  <Stack h='100%' bg='dark.4'>
                                                    {fileExtension === '.mp4' ? (
                                                      <VideoPlayer content={artifactContent || ''} artifactId={artifactId || ''} />
                                                    ) : fileExtension === '.html' && viewMode === 'preview' ? (
                                                      <Markdown
                                                        value={artifactContent || ''}
                                                        fileExtension={fileExtension}
                                                        isPreview
                                                      />
                                                    ) : (
                                                      <ScrollArea h='100%'>
                                                        <Markdown
                                                          value={artifactContent || ''}
                                                          fileExtension={fileExtension}
                                                          isPreview={viewMode === 'preview'}
                                                        />
                                                      </ScrollArea>
                                                    )}
                                                  </Stack>
                                                </Box>
                                                </Box>
                                                ) : (
                                                  <Box
                                                    p='xl'
                                                    style={{
                                                      border: '1px solid var(--mantine-color-dark-4)',
                                                      borderRadius: '8px',
                                                      backgroundColor: 'var(--mantine-color-dark-7)',
                                                      textAlign: 'center',
                                                    }}
                                                  >
                                                    <Loader size='sm' />
                                                    <Text size='xs' color='dimmed' mt='md'>Loading artifact...</Text>
                                                  </Box>
                                                )}
                                            </Collapse>
                                          </Stack>
                                        </Box>
                                      )}
                                      {!label && (
                                        <Box>
                                          <Text size='xs' weight={500} color='orange.6'>Status:</Text>
                                          <Text size='xs' color='dimmed' mt={2}>
                                            Generating {fileExtension} report...
                                          </Text>
                                        </Box>
                                      )}
                                    </Stack>
                                  );
                                }
                                default:
                                  return null;
                              }
                            })();

                            const isRunning = trace.status === 'running';

                            const runningDetail = (() => {
                              if (!isRunning) { return null; }
                              switch (trace.primitiveType) {
                                case PrimitiveType.PROMPT: {
                                  const model = trace.metadata?.model || config.model;
                                  const prompt = trace.metadata?.prompt || config.prompt;
                                  return (
                                    <Stack spacing={4}>
                                      {model && (
                                        <Box>
                                          <Text size='sm' weight={500} color='blue.6'>Model:</Text>
                                          <Text size='xs' color='gray.6'>{getModelName(model)}</Text>
                                        </Box>
                                      )}
                                      {prompt && (
                                        <Box>
                                          <Text size='sm' weight={500} color='blue.6'>Prompt:</Text>
                                          <Spoiler maxHeight={48} showLabel='Show more' hideLabel='Show less'>
                                            <Text size='xs' color='gray.6'>{prompt}</Text>
                                          </Spoiler>
                                        </Box>
                                      )}
                                      <Box>
                                        <Text size='sm' weight={500} color='green.6'>Output:</Text>
                                        <Stack spacing={4} mt={4}>
                                          <Skeleton height={8} width='100%' />
                                          <Skeleton height={8} width='100%' />
                                          <Skeleton height={8} width='65%' />
                                        </Stack>
                                      </Box>
                                    </Stack>
                                  );
                                }
                                case PrimitiveType.DOCUMENT: {
                                  const hasDocument = !!config.documentId;
                                  const embedded = config.embeddedDocuments?.length ?? 0;
                                  const total = (hasDocument ? 1 : 0) + embedded;
                                  return total > 0 ? (
                                    <Text size='xs' color='dimmed'>Loading {total} document{total !== 1 ? 's' : ''}...</Text>
                                  ) : null;
                                }
                                case PrimitiveType.ARTIFACT: {
                                  const format = config.format || '.md';
                                  return <Text size='xs' color='dimmed'>Generating {format} report...</Text>;
                                }
                                default:
                                  return null;
                              }
                            })();

                            const depth = depthMap.get(trace.primitiveId) ?? 0;

                            const IconComponent = getNodeDef(trace.primitiveType as PrimitiveType).icon;

                            const timelineItems = [
                              <Timeline.Item
                                key={trace.primitiveId}
                                bullet={isRunning ? <Loader size={18} color='white' /> : <IconComponent size={18} />}
                                lineVariant={depth > 0 ? 'dotted' : 'solid'}
                                title={
                                  <Group spacing={6}>
                                    <Text size='md' weight={700} color='gray.6'>
                                      {trace.primitiveName}
                                    </Text>
                                    {isRunning && <Badge size='xs' color='blue' variant='light'>Running</Badge>}
                                    {formatDuration(trace.startedAt, trace.completedAt, isRunning) && (
                                      <Badge size='xs' color='gray' variant='light' style={{ textTransform: 'lowercase' }}>
                                        {formatDuration(trace.startedAt, trace.completedAt, isRunning)}
                                      </Badge>
                                    )}
                                  </Group>
                                }
                                style={{
                                  ...(depth > 0 && {
                                    marginLeft: depth * 24,
                                    borderLeft: '2px solid var(--mantine-color-violet-6)',
                                  }),
                                }}
                              >
                                <Stack spacing={2}>
                                  {isRunning && statusData.execution.status === WorkflowStatus.RUNNING ? runningDetail : detail}
                                  {trace.error && (
                                    <Alert icon={<IconX size={14} />} color='red' mt={4} title='Error'>
                                      {trace.error}
                                    </Alert>
                                  )}
                                </Stack>
                              </Timeline.Item>,
                            ];

                            return timelineItems;
                          })}
                        </Timeline>
                      ) : null}

                      {/* Continue/Cancel Buttons - shown after timeline when paused */}
                      {statusData.execution.status === WorkflowStatus.PAUSED && (
                        <Group spacing='sm' position='center'>
                          <Tooltip label='Continue to next step'>
                            <Button
                              leftIcon={<IconPlayerPlay size={16} />}
                              size='xs'
                              color='green'
                              loading={isContinuing}
                              disabled={isContinuing || isCancelling}
                              onClick={async () => {
                                setIsContinuing(true);
                                try {
                                  await continueExecution.mutateAsync({
                                    executionId: executionId!,
                                  });
                                } catch (error) {
                                  notifications.show({
                                    title: 'Error',
                                    message: error instanceof Error ? error.message : 'Failed to continue workflow',
                                    color: 'red',
                                    icon: <IconX />,
                                  });
                                  setIsContinuing(false);
                                }
                              }}
                            >
                              Continue
                            </Button>
                          </Tooltip>
                          <Tooltip label='Cancel workflow execution'>
                            <Button
                              leftIcon={<IconPlayerStop size={16} />}
                              size='xs'
                              color='red'
                              variant='outline'
                              loading={isCancelling}
                              disabled={isCancelling || isContinuing}
                              onClick={async () => {
                                setIsCancelling(true);
                                try {
                                  await cancelExecution.mutateAsync({
                                    executionId: executionId!,
                                  });
                                  setIsExecuting(false);
                                } catch (error) {
                                  notifications.show({
                                    title: 'Error',
                                    message: error instanceof Error ? error.message : 'Failed to cancel workflow',
                                    color: 'red',
                                    icon: <IconX />,
                                  });
                                  setIsCancelling(false);
                                }
                              }}
                            >
                              Cancel
                            </Button>
                          </Tooltip>
                        </Group>
                      )}

                      {/* Cancelled Alert */}
                      {statusData.execution.status === WorkflowStatus.CANCELLED && (
                        <Alert icon={<IconX size={16} />} color='orange' title='Cancelled'>
                          Workflow execution was cancelled by the user.
                        </Alert>
                      )}

                      {/* Execution Failed Alert */}
                      {statusData.execution.error && statusData.execution.status !== WorkflowStatus.CANCELLED && (
                        <Alert icon={<IconX size={16} />} color='red' title='Execution Failed'>
                          {statusData.execution.error}
                        </Alert>
                      )}
                    </Stack>
                  </Paper>
                )}

                {/* Recent Executions */}
                {workflow.recentExecutions && workflow.recentExecutions.filter((execution: any) => execution.id !== executionId).length > 0 && (
                  <Paper p='md' withBorder bg='dark.6'>
                    <Stack spacing='md'>
                      <Text weight={500}>Previous Executions</Text>
                      {workflow.recentExecutions
                        .filter((execution: any) => execution.id !== executionId) // Filter out current execution
                        .map((execution: any) => {
                        const isExpanded = expandedExecutions.has(execution.id);
                        
                        return (
                          <Box key={execution.id}>
                            <Paper 
                              p='sm'
                              withBorder
                              style={{ 
                                cursor: 'pointer',
                                backgroundColor: isExpanded 
                                  ? 'var(--mantine-color-dark-5)' 
                                  : 'var(--mantine-color-dark-7)',
                                borderColor: isExpanded 
                                  ? 'var(--mantine-color-blue-6)' 
                                  : 'var(--mantine-color-dark-4)',
                              }}
                              onClick={() => handleRecentExecutionClick(execution.id)}
                            >
                              <Group position='apart' align='center'>
                                <Group spacing='sm'>
                                  <ActionIcon
                                    size='xs'
                                    variant='subtle'
                                    color='gray'
                                  >
                                    {isExpanded ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />}
                                  </ActionIcon>
                                  <Text size='sm'>{new Date(execution.startedAt).toLocaleString()}</Text>
                                </Group>
                                {isExpanded ? '' : <Badge color={getStatusColor(execution.status)}>{WorkflowStatusLabels[execution.status as WorkflowStatus]}</Badge>}
                              </Group>
                            </Paper>
                            
                            <Collapse in={isExpanded}>
                              <Box style={{
                                backgroundColor: 'var(--mantine-color-dark-8)',
                              }}>
                                {isExpanded && (
                                  <ExecutionDetails
                                    executionId={execution.id}
                                    workflow={workflow}
                                    slug={slug as string}
                                    getModelName={getModelName}
                                    expandedPreviews={expandedPreviews}
                                    togglePreviewExpansion={togglePreviewExpansion}
                                    viewMode={viewMode}
                                    setViewMode={setViewMode}
                                    fetchedArtifacts={fetchedArtifacts}
                                    setFetchedArtifacts={setFetchedArtifacts}
                                    artifactPagesUrls={artifactPagesUrls}
                                    setArtifactPagesUrls={setArtifactPagesUrls}
                                  />
                                )}
                              </Box>
                            </Collapse>
                          </Box>
                        );
                      })}
                    </Stack>
                  </Paper>
                )}
                        </Stack>
                      </Box>
                    </Box>
                  </Stack>
                </Box>
              </Box>
            ) : undefined}
          />
        </Box>
      </Box>

    </Box>
  );
}

// Component for displaying individual execution details
function ExecutionDetails({
  executionId,
  workflow,
  slug,
  getModelName,
  expandedPreviews,
  togglePreviewExpansion,
  viewMode,
  setViewMode,
  fetchedArtifacts,
  setFetchedArtifacts,
  artifactPagesUrls,
  setArtifactPagesUrls,
}: {
  executionId: string;
  workflow: any;
  slug: string;
  getModelName: (modelId: string) => string;
  expandedPreviews: Set<string>;
  togglePreviewExpansion: (previewId: string) => void;
  viewMode: 'preview' | 'code';
  setViewMode: (mode: 'preview' | 'code') => void;
  fetchedArtifacts: Record<string, string>;
  setFetchedArtifacts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  artifactPagesUrls: Record<string, string | null>;
  setArtifactPagesUrls: React.Dispatch<React.SetStateAction<Record<string, string | null>>>;
}) {
  const { data: statusData } = useGetWorkflowStatus(executionId);
  const track = useTrackClientEvent();
  const [renderJobs, setRenderJobs] = useState<Record<string, RenderJobInfo>>({});
  const renderJobsRef = useRef<Record<string, RenderJobInfo>>({});
  const renderToMp4Mutation = trpc.video.renderToMp4.useMutation();
  const utils = trpc.useUtils();
  const [githubPushArtifactId, setGithubPushArtifactId] = useState<string | null>(null);
  const { data: githubProviders } = useGetAvailableGitHubProviders();
  const pushWorkflowArtifactToGithub = usePushWorkflowArtifactToGithub();

  useEffect(() => {
    renderJobsRef.current = renderJobs;
  }, [renderJobs]);

  useEffect(() => {
    const interval = setInterval(async () => {
      const activeEntries = Object.entries(renderJobsRef.current).filter(
        ([, info]) => info.status === 'queued' || info.status === 'processing',
      );
      if (activeEntries.length === 0) {
        return;
      }
      for (const [previewId, info] of activeEntries) {
        if (!info.jobId) {
          continue;
        }
        try {
          const result = await utils.video.getRenderStatus.fetch({ jobId: info.jobId });
          setRenderJobs((prev) => ({
            ...prev,
            [previewId]: {
              jobId: info.jobId,
              status: result.status,
              progress: result.progress,
              downloadUrl: result.downloadUrl,
              error: result.error,
            },
          }));
        } catch {
          // silently ignore transient poll errors
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [utils.video.getRenderStatus]);

  const handlePushToGithubInDetails = async (providerId: string) => {
    if (!githubPushArtifactId) { return; }
    const artifactId = githubPushArtifactId;
    setGithubPushArtifactId(null);

    try {
      const result = await pushWorkflowArtifactToGithub.mutateAsync({
        artifactId,
        githubProviderId: providerId,
      });
      if (result.pagesUrl) {
        setArtifactPagesUrls((prev) => ({ ...prev, [artifactId]: result.pagesUrl }));
      }
      notifications.show({
        title: 'Artifact pushed to GitHub',
        message: (
          <div>
            Artifact {result.action} successfully on GitHub
            <br />
            <a
              href={result.url}
              target='_blank'
              rel='noopener noreferrer'
              style={{ color: '#4dabf7', textDecoration: 'underline' }}
            >
              View on GitHub
            </a>
            {result.pagesUrl && (
              <>
                <br />
                <a
                  href={result.pagesUrl}
                  target='_blank'
                  rel='noopener noreferrer'
                  style={{ color: '#4dabf7', textDecoration: 'underline' }}
                >
                  View on GitHub Pages
                </a>
              </>
            )}
          </div>
        ),
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

  if (!statusData?.execution) {
    return (
      <Paper p='md' mt='sm' withBorder bg='dark.6'>
        <Text size='sm' color='dimmed'>Loading execution details...</Text>
      </Paper>
    );
  }

  const liveTrace = statusData?.progress?.trace;
  const finalTrace = statusData?.execution?.trace;
  const activeTrace = (liveTrace?.length ? liveTrace : finalTrace) ?? [];

  const primitives: any[] = workflow.definition?.primitives ?? [];
  const treeOrder = buildPrimitiveTreeOrder(primitives);
  const depthMap = buildPrimitiveDepthMap(primitives);
  
  // Sort trace maintaining proper hierarchical relationships
  const sortedTrace = [...activeTrace].sort((a: any, b: any) => {
    const ai = treeOrder.indexOf(a.primitiveId);
    const bi = treeOrder.indexOf(b.primitiveId);
    if (ai === -1 && bi === -1) { return 0; }
    if (ai === -1) { return 1; }
    if (bi === -1) { return -1; }
    return ai - bi;
  });

  const calculateTotalTimelineItems = () => sortedTrace.length;

  const totalTimelineItems = calculateTotalTimelineItems();

  return (
    <Paper p='md' mt='sm' withBorder bg='dark.6'>
      <PushToGithubModal
        modalOpened={!!githubPushArtifactId}
        closeModalHandler={() => setGithubPushArtifactId(null)}
        onConfirm={handlePushToGithubInDetails}
        providers={githubProviders?.availableGitHubProviders ?? []}
        isLoading={pushWorkflowArtifactToGithub.isPending}
      />
      <Stack spacing='md'>
        <Group position='apart'>
          <Text size='xssm' color='gray.6'>
            {statusData.execution.status === WorkflowStatus.COMPLETED
              ? `Succeeded ${formatTimeAgo(statusData.execution.completedAt || statusData.execution.startedAt)}${formatDuration(statusData.execution.startedAt, statusData.execution.completedAt) ? ` in ${formatDuration(statusData.execution.startedAt, statusData.execution.completedAt)}` : ''}`
              : statusData.execution.status === WorkflowStatus.FAILED
                ? `Failed ${formatTimeAgo(statusData.execution.completedAt || statusData.execution.startedAt)}`
                : statusData.execution.status === WorkflowStatus.CANCELLED
                  ? `Cancelled ${formatTimeAgo(statusData.execution.completedAt || statusData.execution.startedAt)}`
                  : statusData.execution.status === WorkflowStatus.RUNNING
                    ? 'Running...'
                    : 'Execution Details'
            }
          </Text>
          <Badge color={getStatusColor(statusData.execution.status)}>
            {WorkflowStatusLabels[statusData.execution.status as WorkflowStatus]}
          </Badge>
        </Group>

        {activeTrace.length > 0 ? (
          <Timeline active={totalTimelineItems} bulletSize={30} lineWidth={2}>
            {sortedTrace.map((trace: any) => {
              // For finished executions, only use the historical config from execution trace
              // Don't fall back to current definition as that would be misleading
              const config = trace.config || {};
              
              const detail = (() => {
                switch (trace.primitiveType) {
                  case PrimitiveType.DOCUMENT: {
                    const docs: any[] = trace.output?.documents || [];
                    if (docs.length === 0) { return null; }
                    return (
                      <Text size='xs' color='gray.6'>
                        {docs.map((d: any) => d.filename).join(', ')}
                      </Text>
                    );
                  }
                  case PrimitiveType.PROMPT: {
                    const model = trace.metadata?.model || config.model;
                    const prompt = trace.metadata?.prompt || config.prompt;
                    const response = trace.output?.response;
                    const citations = trace.output?.citations || [];

                    return (
                      <Stack spacing={4}>
                        {model && (
                          <Box>
                            <Text size='sm' weight={500} color='blue.6'>Model:</Text>
                            <Text size='xs' color='gray.6'>{getModelName(model)}</Text>
                          </Box>
                        )}
                        {prompt && (
                          <Box>
                            <Text size='sm' weight={500} color='blue.6'>Prompt:</Text>
                            <Spoiler maxHeight={48} showLabel='Show more' hideLabel='Show less'>
                              <Text size='xs' color='gray.6'>{prompt}</Text>
                            </Spoiler>
                          </Box>
                        )}
                        {response && (
                          <Box>
                            <Text size='sm' weight={500} color='green.6'>Output:</Text>
                            <Spoiler maxHeight={72} showLabel='Show more' hideLabel='Show less'>
                              <Text size='xs' color='gray.6'>{response}</Text>
                            </Spoiler>

                            {/* Citations (RAG sources) */}
                            {citations.length > 0 && (
                              <Box mt={6}>
                                <WorkflowCitations citations={citations} />
                              </Box>
                            )}
                          </Box>
                        )}
                      </Stack>
                    );
                  }
                  case PrimitiveType.ARTIFACT: {
                    // Backward compatibility: support both old and new output structures
                    const artifactId = trace.output?.artifactId;
                    const label = trace.output?.label || trace.output?.filename; // New || Old
                    const fileExtension = trace.output?.fileExtension || trace.output?.format || config.format; // New || Old || Config
                    const legacyContent = trace.output?.report; // Old structure had content inline
                    const contentType = trace.output?.contentType;

                    const displayFilename = label && label.includes('.') ? label : label ? `${label}${fileExtension}` : `report${fileExtension}`;
                    const previewId = `${trace.primitiveId}-preview-${executionId}`;
                    const isPreviewExpanded = expandedPreviews.has(previewId);

                    // Get content: fetched from DB, or legacy inline content
                    const artifactContent = artifactId ? fetchedArtifacts[artifactId] : legacyContent;

                    return (
                      <Stack spacing={6}>
                        {label && (artifactId || legacyContent) && (
                          <Box>
                            <Stack spacing={8}>
                              <Group pt='xs' spacing={8}>
                                <Button
                                  leftIcon={<IconEye size={12} />}
                                  size='xs'
                                  variant='outline'
                                  color='blue'
                                  onClick={async (e: React.MouseEvent) => {
                                    e.stopPropagation();
                                    // Fetch artifact content if not already cached
                                    if (artifactId && !fetchedArtifacts[artifactId] && !isPreviewExpanded) {
                                      try {
                                        const artifact = await utils.client.workflows.getWorkflowArtifact.query({ artifactId });
                                        setFetchedArtifacts(prev => ({ ...prev, [artifactId]: artifact.content }));
                                      } catch (error) {
                                        console.error('Failed to fetch artifact for preview:', error);
                                      }
                                    }
                                    togglePreviewExpansion(previewId);
                                  }}
                                >
                                  {isPreviewExpanded ? 'Hide' : 'Preview'}
                                </Button>
                                {fileExtension !== '.mp4' && (
                                  <Button
                                    leftIcon={<IconUpload size={12} />}
                                    size='xs'
                                    color='green'
                                    variant='light'
                                    onClick={async (e: React.MouseEvent) => {
                                      e.stopPropagation();

                                      // Fetch content: new structure uses artifactId, old structure has content inline
                                      let actualContent: string;
                                      if (artifactId) {
                                        try {
                                          const artifact = await utils.client.workflows.getWorkflowArtifact.query({ artifactId });
                                          actualContent = artifact.content;
                                        } catch (error) {
                                          console.error('Failed to fetch artifact:', error);
                                          return;
                                        }
                                      } else {
                                        // Backward compatibility: use inline content
                                        actualContent = legacyContent || '';
                                      }

                                      let blob: Blob;

                                      if (fileExtension === '.xlsx') {
                                        try {
                                          blob = await convertMarkdownToExcel(actualContent);
                                        } catch {
                                          blob = new Blob([actualContent], { type: 'text/plain' });
                                        }
                                      } else if (fileExtension === '.docx') {
                                        try {
                                          blob = await convertMarkdownToDocx(actualContent);
                                        } catch {
                                          blob = new Blob([actualContent], { type: 'text/plain' });
                                        }
                                      } else if (fileExtension === '.pptx') {
                                        try {
                                          const { convertMarkdownToPptx } = await import('@/features/chat/utils/artifacts/convertMarkdownToPptx');
                                          blob = await convertMarkdownToPptx(actualContent);
                                        } catch (error) {
                                          console.error('Failed to convert markdown to pptx:', error);
                                          blob = new Blob([actualContent], { type: 'text/plain' });
                                        }
                                      } else {
                                        // Determine content type from fileExtension
                                        const contentTypeMap: Record<string, string> = {
                                          '.json': 'application/json',
                                          '.html': 'text/html',
                                          '.csv': 'text/csv',
                                          '.txt': 'text/plain',
                                          '.mmd': 'text/vnd.mermaid',
                                          '.md': 'text/markdown',
                                        };
                                        const contentType = contentTypeMap[fileExtension] || 'application/octet-stream';
                                        blob = new Blob([actualContent], { type: contentType });
                                      }

                                      const url = URL.createObjectURL(blob);
                                      const a = document.createElement('a');
                                      a.href = url;
                                      a.download = displayFilename;
                                      a.click();
                                      URL.revokeObjectURL(url);
                                      track.download.workflowArtifact({
                                        artifactId,
                                        filename: displayFilename,
                                        workflowId: workflow?.id ?? null,
                                        workflowExecutionId: executionId,
                                        primitiveId: trace.primitiveId,
                                      });
                                    }}
                                  >
                                    Download
                                  </Button>
                                )}
                                {fileExtension === '.html' && (
                                  <Button
                                    leftIcon={<IconExternalLink size={12} />}
                                    size='xs'
                                    onClick={(e: React.MouseEvent) => {
                                      e.stopPropagation();
                                      const url = `/workflows/${slug}/view/${executionId}/${trace.primitiveId}`;
                                      track.navigate(displayFilename, url);
                                      window.open(url, '_blank');
                                    }}
                                  >
                                    Open
                                  </Button>
                                )}
                                {fileExtension === '.html' && artifactId && (artifactPagesUrls[artifactId] !== undefined || (githubProviders?.availableGitHubProviders?.length ?? 0) > 0) && (
                                  artifactPagesUrls[artifactId] ? (
                                    <Button
                                      leftIcon={<IconExternalLink size={12} />}
                                      size='xs'
                                      color='gray'
                                      variant='light'
                                      component='a'
                                      href={artifactPagesUrls[artifactId]!}
                                      target='_blank'
                                      rel='noopener noreferrer'
                                      onClick={(e: React.MouseEvent) => e.stopPropagation()}
                                    >
                                      View
                                    </Button>
                                  ) : (
                                    <Button
                                      leftIcon={<IconBrandGithub size={12} />}
                                      size='xs'
                                      color='gray'
                                      variant='light'
                                      loading={pushWorkflowArtifactToGithub.isPending && githubPushArtifactId === artifactId}
                                      onClick={(e: React.MouseEvent) => {
                                        e.stopPropagation();
                                        setGithubPushArtifactId(artifactId);
                                      }}
                                    >
                                      Publish
                                    </Button>
                                  )
                                )}
                                {fileExtension === '.mp4' && !renderJobs[previewId] && (
                                  <Button
                                    leftIcon={<IconVideo size={12} />}
                                    size='xs'
                                    color='violet'
                                    variant='light'
                                    onClick={async (e: React.MouseEvent) => {
                                      e.stopPropagation();
                                      let slidesJson: string;
                                      if (artifactId) {
                                        try {
                                          const artifact = await utils.client.workflows.getWorkflowArtifact.query({ artifactId });
                                          slidesJson = artifact.content;
                                        } catch (error) {
                                          console.error('Failed to fetch artifact:', error);
                                          return;
                                        }
                                      } else {
                                        slidesJson = legacyContent || '';
                                      }
                                      setRenderJobs((prev) => ({
                                        ...prev,
                                        [previewId]: { status: 'starting' },
                                      }));
                                      renderToMp4Mutation.mutate(
                                        { slidesJson },
                                        {
                                          onSuccess: ({ jobId }) => {
                                            setRenderJobs((prev) => ({
                                              ...prev,
                                              [previewId]: { jobId, status: 'queued' },
                                            }));
                                          },
                                          onError: (err) => {
                                            setRenderJobs((prev) => ({
                                              ...prev,
                                              [previewId]: { status: 'error', error: err.message },
                                            }));
                                          },
                                        },
                                      );
                                    }}
                                  >
                                    Export MP4
                                  </Button>
                                )}
                                {fileExtension === '.mp4' && renderJobs[previewId] && (renderJobs[previewId].status === 'starting' || renderJobs[previewId].status === 'queued' || renderJobs[previewId].status === 'processing') && (
                                  <Stack spacing={4} style={{ minWidth: 120 }}>
                                    <Text size='xs' color='dimmed'>
                                      {renderJobs[previewId].status === 'starting'
                                        ? 'Starting...'
                                        : renderJobs[previewId].status === 'queued'
                                        ? 'Queued...'
                                        : renderJobs[previewId].progress ?? 'Rendering...'}
                                    </Text>
                                    {renderJobs[previewId].status === 'processing' && (
                                      <Progress
                                        value={parseInt((renderJobs[previewId].progress ?? '0%').match(/(\d+)/)?.[1] ?? '0')}
                                        size='xs'
                                        color='violet'
                                      />
                                    )}
                                  </Stack>
                                )}
                                {fileExtension === '.mp4' && renderJobs[previewId]?.status === 'done' && renderJobs[previewId].downloadUrl && (
                                  <Button
                                    component='a'
                                    href={renderJobs[previewId].downloadUrl}
                                    leftIcon={<IconDownload size={12} />}
                                    size='xs'
                                    color='green'
                                    variant='filled'
                                  >
                                    Download MP4
                                  </Button>
                                )}
                                {fileExtension === '.mp4' && renderJobs[previewId]?.status === 'error' && (
                                  <Text size='xs' color='red.6'>
                                    {renderJobs[previewId].error ?? 'Render failed'}
                                  </Text>
                                )}
                              </Group>

                              <Collapse in={isPreviewExpanded}>
                                  <Box
                                    style={{
                                      border: '1px solid var(--mantine-color-dark-4)',
                                      borderRadius: '8px',
                                      backgroundColor: 'var(--mantine-color-dark-7)',
                                      maxHeight: '500px',
                                      display: 'flex',
                                      flexDirection: 'column',
                                    }}
                                  >
                                  {/* Artifact Header */}
                                  <Group
                                    px='md'
                                    py='sm'
                                    position='apart'
                                    bg='dark.4'
                                    style={{ borderBottom: '1px solid var(--mantine-color-dark-4)' }}
                                  >
                                    {PREVIEW_AS_RENDERED_FILE_TYPES.includes(fileExtension) ? (
                                      <Box bg='dark.8' style={{ borderRadius: '8px' }}>
                                        <UnstyledButton
                                          variant='toggle_artifact_view'
                                          className={viewMode === 'preview' ? 'active' : ''}
                                          onClick={() => setViewMode('preview')}
                                          aria-label='Preview'
                                        >
                                          <ThemeIcon size='md'>
                                            <IconEye stroke={1.5} size='sm' />
                                          </ThemeIcon>
                                        </UnstyledButton>
                                        <UnstyledButton
                                          variant='toggle_artifact_view'
                                          className={viewMode === 'preview' ? '' : 'active'}
                                          onClick={() => setViewMode('code')}
                                          aria-label='Code'
                                        >
                                          <ThemeIcon size='md'>
                                            <IconCode stroke={1.5} size='sm' />
                                          </ThemeIcon>
                                        </UnstyledButton>
                                      </Box>
                                    ) : (
                                      <Box />
                                    )}

                                    <Group spacing='sm'>
                                      <CopyButton value={artifactContent || ''} timeout={2000}>
                                        {({ copied, copy }) => (
                                          <Tooltip label={copied ? 'Copied' : 'Copy'} position='left'>
                                            <ActionIcon
                                              size='sm'
                                              color={copied ? 'teal' : 'gray'}
                                              onClick={() => {
                                                copy();
                                                track.copy.workflowArtifact({
                                                  artifactId,
                                                  filename: displayFilename,
                                                  workflowId: workflow?.id ?? null,
                                                  workflowExecutionId: executionId,
                                                  primitiveId: trace.primitiveId,
                                                });
                                              }}
                                            >
                                              {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                                            </ActionIcon>
                                          </Tooltip>
                                        )}
                                      </CopyButton>
                                    </Group>
                                  </Group>

                                  {/* Artifact Content */}
                                  <Box
                                    style={{
                                      minHeight: fileExtension === '.mp4' ? '400px' : '200px',
                                      ...(fileExtension === '.html' && viewMode === 'preview' ? { height: '80vh' } : {}),
                                      overflow: 'auto',
                                      backgroundColor: (fileExtension === '.md' || fileExtension === '.html') && viewMode === 'preview' ? 'var(--mantine-color-dark-6)' : 'var(--mantine-color-dark-9)',
                                    }}
                                  >
                                    <Stack h='100%' bg='dark.4'>
                                      {fileExtension === '.mp4' ? (
                                        <VideoPlayer content={artifactContent || ''} artifactId={artifactId || ''} />
                                      ) : fileExtension === '.html' && viewMode === 'preview' ? (
                                        <Markdown
                                          value={artifactContent || ''}
                                          fileExtension={fileExtension}
                                          isPreview
                                        />
                                      ) : (
                                        <ScrollArea h='100%'>
                                          <Markdown
                                            value={artifactContent || ''}
                                            fileExtension={fileExtension}
                                            isPreview={viewMode === 'preview'}
                                          />
                                        </ScrollArea>
                                      )}
                                    </Stack>
                                  </Box>
                                  </Box>
                              </Collapse>
                            </Stack>
                          </Box>
                        )}
                        {!label && (
                          <Box>
                            <Text size='xs' weight={500} color='orange.6'>Status:</Text>
                            <Text size='xs' color='dimmed' mt={2}>
                              Generating {fileExtension} report...
                            </Text>
                          </Box>
                        )}
                      </Stack>
                    );
                  }
                  default:
                    return null;
                }
              })();

              const isRunning = trace.status === 'running';
              const depth = depthMap.get(trace.primitiveId) ?? 0;
              const IconComponent = getNodeDef(trace.primitiveType as PrimitiveType).icon;

              const timelineItems = [
                <Timeline.Item
                  key={trace.primitiveId}
                  bullet={isRunning ? <Loader size={18} color='white' /> : <IconComponent size={18} />}
                  lineVariant={depth > 0 ? 'dotted' : 'solid'}
                  title={
                    <Group spacing={6}>
                      <Text size='md' weight={700} color='gray.6'>{trace.primitiveName}</Text>
                      {isRunning && <Badge size='xs' color='blue' variant='light'>Running</Badge>}
                      {formatDuration(trace.startedAt, trace.completedAt, isRunning) && (
                        <Badge size='xs' color='gray' variant='light' style={{ textTransform: 'lowercase' }}>
                          {formatDuration(trace.startedAt, trace.completedAt, isRunning)}
                        </Badge>
                      )}
                    </Group>
                  }
                  style={{
                    ...(depth > 0 && {
                      marginLeft: depth * 24,
                      borderLeft: '2px solid var(--mantine-color-violet-6)',
                    }),
                  }}
                >
                  <Stack spacing={2}>
                    {detail}
                    {trace.error && (
                      <Alert icon={<IconX size={14} />} color='red' mt={4} title='Error'>
                        {trace.error}
                      </Alert>
                    )}
                  </Stack>
                </Timeline.Item>,
              ];

              return timelineItems;
            })}
          </Timeline>
        ) : (
          <Text size='sm' color='dimmed'>No execution details available.</Text>
        )}

        {/* Paused Alert */}
        {statusData.execution.status === WorkflowStatus.PAUSED && (
          <Alert icon={<IconAlertCircle size={16} />} color='yellow' title='Paused'>
            Workflow was paused.
          </Alert>
        )}

        {/* Cancelled Alert */}
        {statusData.execution.status === WorkflowStatus.CANCELLED && (
          <Alert icon={<IconX size={16} />} color='orange' title='Cancelled'>
            Workflow execution was cancelled by the user.
          </Alert>
        )}

        {/* Execution Failed Alert */}
        {statusData.execution.error && statusData.execution.status !== WorkflowStatus.CANCELLED && (
          <Alert icon={<IconX size={16} />} color='red' title='Execution Failed'>
            {statusData.execution.error}
          </Alert>
        )}
      </Stack>
    </Paper>
  );
}

export default function WorkflowPage() {
  const router = useRouter();
  
  const {
    data: userWorkflowsAccess,
    isPending: userWorkflowsAccessPending,
  } = useGetUserWorkflowsAccess();

  if (userWorkflowsAccessPending) {
    return <CenteredLoader />;
  }

  if (!userWorkflowsAccess?.hasAccess) {
    router.push('/');
    return null;
  }

  return (
    <WorkflowBuilderProvider>
      <WorkflowPageContent />
    </WorkflowBuilderProvider>
  );
}
