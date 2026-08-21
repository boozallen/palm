import { useMemo, useState, useEffect, memo } from 'react';
import { Box, Stack, Text, ActionIcon, Group, ThemeIcon, Button, SimpleGrid, Tooltip, Popover } from '@mantine/core';
import { IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand, IconArrowsDiagonalMinimize2, IconPlus, IconNetwork, IconSitemap, IconFolder } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

import ExpandedSourcesList from '@/features/chat/components/content/sources/ExpandedSourcesList';
import CollapsedSourcesList from '@/features/chat/components/content/sources/CollapsedSourcesList';
import AddSourcesModal from '@/features/shared/components/modals/AddSourcesModal';
import ManageCollectionsModal from '@/features/shared/components/document-library/modals/ManageCollectionsModal';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import { useChat } from '@/features/chat/providers/ChatProvider';
import useGetUserKnowledgeBases from '@/features/shared/api/get-user-knowledge-bases';
import useGetDocuments from '@/features/shared/api/document-upload/get-documents';
import useGetDocumentContent from '@/features/shared/api/document-upload/get-document-content';
import useGetDocumentUploadRequirements from '@/features/shared/api/document-upload/get-document-upload-requirements';
import { trpc } from '@/libs';
import { useGetUserGraphDatabaseAccess } from '@/features/shared/api/get-user-graph-database-access';
import useBuildGraph from '@/features/graph-database/api/build-graph';
import { useGetGraphStatus } from '@/features/graph-database/api/get-graph-status';
import { useGetGraphedDocuments } from '@/features/graph-database/api/get-graphed-documents';
import { useGetActiveGraphBuilds } from '@/features/graph-database/api/get-active-graph-builds';
import { GraphBuildStatus } from '@/features/graph-database/types';
import useHighlightSelectedCitation, { type HighlightedCitation } from '@/features/chat/hooks/useHighlightSelectedCitation';
import { tryParsePalmGraph } from '@/features/graph-database/services/jsonIngest/detectPalmGraph';
import { GRAPH_SCHEMAS } from '@/features/graph-database/config/schemas/registry';
import { computeEffectiveSchemas } from '@/features/chat/utils/graphBuildSchema';
import Markdown from '@/components/content/Markdown';
import { TABULAR_FILE_EXTENSIONS } from '@/features/shared/types/document';
import { useTrackClientEvent } from '@/features/shared/hooks/useTrackClientEvent';

interface MemoizedDocumentTextProps {
  text: string;
  documentId: string;
  highlightedCitation: HighlightedCitation | null;
  renderHighlightedText: (text: string) => React.ReactNode;
}

const MemoizedDocumentText = memo(function MemoizedDocumentText({
  text,
  documentId,
  highlightedCitation,
  renderHighlightedText,
}: MemoizedDocumentTextProps) {
  const renderedContent = useMemo(() => {
    return renderHighlightedText(text);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, documentId, highlightedCitation?.startPosition, highlightedCitation?.endPosition, highlightedCitation?.documentId, renderHighlightedText]);

  return <>{renderedContent}</>;
});

interface SourcesSidebarProps {
  isVisible?: boolean;
}

export default function SourcesSidebar({ isVisible = true }: SourcesSidebarProps) {
  const { knowledgeBaseIds, documentIds, setDocumentIds, sourcesSidebarExpanded, setSourcesSidebarExpanded, isGeneratingGraph, setIsGeneratingGraph, setShowGraphTooltip, setUseGraph, useGraph, graphingSourceIds, setGraphingSourceIds, removingGraphedSourceIds, highlightedCitation, setHighlightedCitation, showKnowledgeGraph, setShowKnowledgeGraph, setSelectedArtifact, triggerAddSource, setTriggerAddSource, setHasUserInteracted, setUploadingDocuments, graphedSourceIds, perDocSchemaOverrides, graphSelectedIds, setGraphSelectedIds, cancelledGraphIds, setCancelledGraphIds } = useChat();
  const track = useTrackClientEvent();
  const [isAddSourcesModalOpen, setIsAddSourcesModalOpen] = useState(false);
  const [isManageCollectionsModalOpen, setIsManageCollectionsModalOpen] = useState(false);
  const [graphId, setGraphId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importPopoverOpened, setImportPopoverOpened] = useState(false);
  const utils = trpc.useUtils();
  const { data: systemConfig } = useGetSystemConfig();
  const { data: userKnowledgeBases } = useGetUserKnowledgeBases();

  const { data: userGraphDatabaseAccess } = useGetUserGraphDatabaseAccess();

  // Document upload provider
  const documentUploadProviderId = systemConfig?.documentLibraryDocumentUploadProviderId || '';
  const { data: userDocuments } = useGetDocuments({
    documentUploadProviderId,
  });

  // Uploading a source embeds it, so an embedding model is a precondition here just
  // as it is in the Document Library. Treated as unavailable until the query
  // resolves so the button can't be clicked during the gap.
  const {
    data: documentUploadRequirements,
    isPending: documentUploadRequirementsLoading,
  } = useGetDocumentUploadRequirements();
  const canAddSources = documentUploadRequirements?.configured ?? false;
  const addSourcesDisabledLabel = documentUploadRequirementsLoading
    ? 'Checking document upload configuration...'
    : 'Document upload requires an embedding model. Please contact your administrator.';

  // Highlighted citation hook
  const { displaySource, setDisplaySource, renderHighlightedText } = useHighlightSelectedCitation({
    highlightedCitation,
    userDocuments,
  });

  // Lazy-load text for the selected document source
  const selectedDocumentId = displaySource?.type === 'document' ? displaySource.id : undefined;
  const { data: documentContent } = useGetDocumentContent({ documentId: selectedDocumentId });
  const documentText = documentContent?.text ?? displaySource?.text ?? undefined;

  // Listen for trigger to open add sources modal. The trigger is consumed either
  // way, but the modal only opens when uploading is actually possible — otherwise
  // this path would bypass the disabled buttons above.
  useEffect(() => {
    if (triggerAddSource) {
      setHasUserInteracted(true);
      setSourcesSidebarExpanded(true);
      if (canAddSources) {
        setIsAddSourcesModalOpen(true);
      }
      setTriggerAddSource(false);
    }
  }, [triggerAddSource, setSourcesSidebarExpanded, setTriggerAddSource, setHasUserInteracted, canAddSources]);

  // Graph building hooks
  const buildGraph = useBuildGraph();
  const { data: graphStatus } = useGetGraphStatus(graphId || undefined);
  const { data: graphedDocumentsData, refetch: refetchGraphedDocuments, isLoading: graphedDocumentsLoading } = useGetGraphedDocuments();
  const { data: activeGraphBuilds, isLoading: activeGraphBuildsLoading } = useGetActiveGraphBuilds();
  // Two signals, not one: activeGraphBuilds is polled every 3s, so a build that
  // settles fast after being marked Cancelling (a mid-ER cancel can fully roll
  // back in a few seconds, vs. a mid-extraction cancel which waits out the
  // current chunk's LLM call) can come and go between polls without this ever
  // observing Cancelling — the button would never turn red. cancelledGraphIds
  // is set synchronously the instant the cancel mutation resolves (see
  // GraphingStatusPopover), so it catches the fast case the poll can miss.
  const isCancellingActiveBuild =
    (activeGraphBuilds?.some((build) => build.status === GraphBuildStatus.Cancelling) ?? false) ||
    (!!graphId && cancelledGraphIds.includes(graphId));

  // Get graphed document IDs from API (source of truth for graphed status)
  const effectiveGraphedSourceIds = useMemo(() => {
    return [
      ...new Set([
        ...graphedSourceIds,
        ...(graphedDocumentsData?.documentIds ?? []),
      ]),
    ];
  }, [graphedSourceIds, graphedDocumentsData]);

  // Auto-enable graph mode when any selected document is graphed
  const hasAnySelectedDocGraphed = documentIds.some(id => effectiveGraphedSourceIds.includes(id));

  useEffect(() => {
    if (hasAnySelectedDocGraphed && userGraphDatabaseAccess?.hasAccess) {
      setUseGraph(true);
    }
  }, [hasAnySelectedDocGraphed, userGraphDatabaseAccess?.hasAccess, setUseGraph]);

  const selectedSources = useMemo(() => {
    const sources = [];

    // Add selected knowledge bases
    if (userKnowledgeBases?.userKnowledgeBases) {
      const selectedKnowledgeBases = userKnowledgeBases.userKnowledgeBases.filter(kb =>
        knowledgeBaseIds.includes(kb.id)
      );
      sources.push(...selectedKnowledgeBases.map(kb => ({
        id: kb.id,
        label: kb.label,
        type: 'knowledge-base' as const,
      })));
    }

    // Add selected documents
    if (userDocuments?.documents) {
      const selectedDocuments = userDocuments.documents.filter(doc =>
        documentIds.includes(doc.id)
      );
      sources.push(...selectedDocuments.map(doc => ({
        id: doc.id,
        label: doc.filename,
        type: 'document' as const,
      })));
    }

    return sources;
  }, [userKnowledgeBases, userDocuments, knowledgeBaseIds, documentIds]);

  // Document category per selected doc → drives the per-document schema suggestion.
  // Sourced from the AI triage result in dataProfile.type (main's #649).
  const typeById = useMemo(() => {
    const map: Record<string, string | null | undefined> = {};
    (userDocuments?.documents ?? []).forEach((doc) => {
      map[doc.id] = doc.dataProfile?.type;
    });
    return map;
  }, [userDocuments]);

  // Derived (not stored): per-doc override wins, else the type suggestion.
  // Keyed by the staged-to-graph set; sent as schemaKeysByDocumentId on build.
  const effectiveSchemas = useMemo(
    () => computeEffectiveSchemas(graphSelectedIds, typeById, perDocSchemaOverrides),
    [graphSelectedIds, typeById, perDocSchemaOverrides],
  );

  // Check which staged documents are JSON files and validate them
  const jsonValidationResults = useMemo(() => {
    if (graphSelectedIds.length === 0) {
      return {
        hasJsonFiles: false,
        allAreJson: false,
        allJsonsAreValid: false,
        files: [] as Array<{
          id: string;
          filename: string;
          isJson: boolean;
          isValidGraph: boolean;
        }>,
      };
    }

    const selectedDocs = userDocuments?.documents?.filter(doc =>
      graphSelectedIds.includes(doc.id)
    ) || [];

    const files = selectedDocs.map(doc => {
      const isJson = doc.filename.toLowerCase().endsWith('.json');
      let isValidGraph = false;

      if (isJson && doc.text) {
        const parsedGraph = tryParsePalmGraph(doc.text);
        isValidGraph = parsedGraph !== null;
      }

      return {
        id: doc.id,
        filename: doc.filename,
        isJson,
        isValidGraph,
      };
    });

    const jsonFiles = files.filter(f => f.isJson);
    const hasJsonFiles = jsonFiles.length > 0;
    const allAreJson = files.length > 0 && files.every(f => f.isJson);
    const allJsonsAreValid = jsonFiles.length > 0 && jsonFiles.every(f => f.isValidGraph);

    return {
      hasJsonFiles,
      allAreJson,
      allJsonsAreValid,
      files,
    };
  }, [graphSelectedIds, userDocuments]);

  // For backwards compatibility
  const allSelectedDocumentsAreJson = jsonValidationResults.allAreJson;
  const allSelectedJsonsAreValidGraphs = jsonValidationResults.allJsonsAreValid;

  // Get ungraphable document IDs from API - only when data is ready
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ungraphableDocumentIds = (graphedDocumentsData?.ungraphableDocumentIds || []) as string[];

  // One-line "what will be graphed" summary for the Graph button tooltip, counting
  // only the docs that will actually be built (not already graphed or ungraphable),
  // grouped by their effective schema.
  const schemaBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    graphSelectedIds.forEach((id) => {
      if (effectiveGraphedSourceIds.includes(id) || ungraphableDocumentIds.includes(id)) {
        return;
      }
      const key = effectiveSchemas[id];
      if (key) {
        counts[key] = (counts[key] ?? 0) + 1;
      }
    });
    const parts = Object.entries(counts).map(([key, count]) => {
      const name = GRAPH_SCHEMAS.find((s) => s.key === key)?.name ?? key;
      return `${count} ${name}`;
    });
    return parts.length > 0 ? `Will graph ${parts.join(' · ')}` : null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphSelectedIds, effectiveGraphedSourceIds, ungraphableDocumentIds, effectiveSchemas]);

  // Check if any staged-for-graphing documents are tabular (CSV, XLSX, XLS)
  const { hasTabularDocs, nonTabularDocIds } = useMemo(() => {
    const selectedDocs = userDocuments?.documents?.filter(doc => graphSelectedIds.includes(doc.id)) || [];
    const tabularIds = selectedDocs
      .filter(doc => TABULAR_FILE_EXTENSIONS.some(ext => doc.filename.toLowerCase().endsWith(ext)))
      .map(doc => doc.id);
    const nonTabularIds = selectedDocs
      .filter(doc => !TABULAR_FILE_EXTENSIONS.some(ext => doc.filename.toLowerCase().endsWith(ext)))
      .map(doc => doc.id);

    return {
      hasTabularDocs: tabularIds.length > 0,
      nonTabularDocIds: nonTabularIds,
    };
  }, [graphSelectedIds, userDocuments]);

  // Determine graph build state from the staged-to-graph set
  const { hasUngraphedSelectedDocs, allSelectedDocsProcessed } = useMemo(() => {
    // If data is still loading, return conservative defaults
    if (graphedDocumentsLoading || !graphedDocumentsData) {
      return {
        hasUngraphedSelectedDocs: true, // Assume documents need processing until we know otherwise
        allSelectedDocsProcessed: false,
      };
    }

    // A doc is "processed" if it's either graphed (has entities) OR ungraphable (no entities)
    const isProcessed = (id: string) =>
      effectiveGraphedSourceIds.includes(id) || ungraphableDocumentIds.includes(id);

    // Check if there are truly ungraphed staged documents (not graphed AND not ungraphable)
    const hasUngraphed = graphSelectedIds.some((id) => !isProcessed(id));

    // Check if ALL staged documents are already processed (graphed or ungraphable)
    const allProcessed = graphSelectedIds.length > 0 && graphSelectedIds.every((id) => isProcessed(id));

    return {
      hasUngraphedSelectedDocs: hasUngraphed,
      allSelectedDocsProcessed: allProcessed,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphSelectedIds, effectiveGraphedSourceIds, ungraphableDocumentIds, graphedDocumentsLoading, graphedDocumentsData]);

  // How many staged docs will actually be built (excludes already-graphed / ungraphable).
  const graphBuildableCount = useMemo(
    () => graphSelectedIds.filter((id) =>
      !effectiveGraphedSourceIds.includes(id) && !ungraphableDocumentIds.includes(id)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [graphSelectedIds, effectiveGraphedSourceIds, ungraphableDocumentIds],
  );

  // Detect and restore active graph builds on mount
  useEffect(() => {
    if (activeGraphBuilds?.length) {
      // Use the first active build (there should typically only be one per user)
      const activeBuild = activeGraphBuilds[0];

      // Check if this is an import operation (copying graph data) vs actual graphing
      const isImportOperation = activeBuild.currentStep === 'Copying graph data...';

      if (isImportOperation) {
        // For import operations, just track importing state
        setIsImporting(true);
      } else {
        // For actual graphing operations, set full graphing state
        setIsGeneratingGraph(true);
        setGraphId(activeBuild.graphId);

        // Set graphing state for only the documents this job is processing
        // (newDocumentIds). For an incremental build the row's documentIds is
        // the full union, so using it here would re-spin already-graphed docs.
        setGraphingSourceIds(activeBuild.newDocumentIds ?? activeBuild.documentIds);
      }
    } else {
      // No active builds, clear importing state
      setIsImporting(false);
    }
  }, [activeGraphBuilds, setIsGeneratingGraph, setGraphingSourceIds]);

  // Handle graph status changes
  useEffect(() => {
    // Guards against reprocessing: this effect calls setGraphId(null) on every
    // terminal branch below, and graphId is in the dependency array (needed to
    // know WHICH build settled) — so clearing it re-fires this same effect
    // while graphStatus is still cached as the same terminal status (the query
    // is now disabled via `enabled: !!graphId`, so its data just sits stale
    // rather than resetting). Without this guard the second pass would see
    // graphId as null, wrongly treat it as "not cancelled" on a Completed
    // status, and fire the success tooltip a build's cancel already suppressed.
    if (!graphId) {
      return;
    }

    if (graphStatus?.status === GraphBuildStatus.Completed) {
      // A user-cancelled build can also settle to Completed (incremental
      // rollback preserves prior badges) — indistinguishable from a genuine
      // finish by status alone. cancelledGraphIds is the client-side signal
      // that this settle was a cancellation, so the "success" tooltip is
      // skipped; consume (remove) the marker either way.
      const wasCancelled = cancelledGraphIds.includes(graphId);
      if (wasCancelled) {
        setCancelledGraphIds((prev) => prev.filter((id) => id !== graphId));
        // Cancellation is a full undo of this run's extraction/resolution
        // regardless of which phase it landed in — graphingSourceIds is the
        // exact doc set the rollback deleted (it mirrors the worker's
        // extractDocumentIds the whole run), so restoring it here re-stages
        // precisely what was un-done. Without this, a doc dropped from staged
        // once the "graphed" badge query briefly saw it (which can happen as
        // soon as its first chunk commits, well before the run is cancelled)
        // never comes back — it ends up neither staged nor graphed.
        setGraphSelectedIds((prev) => [...new Set([...prev, ...graphingSourceIds])]);
      }

      // A failed build whose finished docs were preserved also settles to
      // Completed, with the errorMessage kept as the failure record — surface
      // it instead of celebrating.
      const settledFailure = !wasCancelled && !!graphStatus.errorMessage;

      setIsGeneratingGraph(false);
      setGraphingSourceIds([]);
      setGraphId(null);
      // Refetch to get accurate graphed/ungraphable status from API
      refetchGraphedDocuments();

      if (settledFailure) {
        notifications.show({
          title: 'Graph build failed',
          message: 'Some documents could not be graphed. Documents that finished were kept — you can retry the rest by graphing them again.',
          color: 'red',
        });
      } else if (!wasCancelled) {
        setUseGraph(true);
        setShowGraphTooltip(true);
        setTimeout(() => setShowGraphTooltip(false), 3000);
      }
    } else if (graphStatus?.status === GraphBuildStatus.Failed) {
      notifications.show({
        title: 'Graph build failed',
        message: 'The graph build could not be completed. You can try again by re-selecting the documents and clicking Graph.',
        color: 'red',
      });
      setIsGeneratingGraph(false);
      setGraphingSourceIds([]);
      setGraphId(null);
    } else if (graphStatus?.status === GraphBuildStatus.Cancelled) {
      // Terminal cancel of a first-ever build (no prior graph to fall back
      // to) — nothing was ever graphed, so there is no tooltip and nothing
      // to refetch, just stop the spinner and re-stage what was undone.
      setCancelledGraphIds((prev) => prev.filter((id) => id !== graphId));
      setGraphSelectedIds((prev) => [...new Set([...prev, ...graphingSourceIds])]);
      setIsGeneratingGraph(false);
      setGraphingSourceIds([]);
      setGraphId(null);
    }
  }, [graphStatus, graphId, cancelledGraphIds, graphingSourceIds, setCancelledGraphIds, setGraphSelectedIds, setIsGeneratingGraph, setUseGraph, setShowGraphTooltip, setGraphingSourceIds, refetchGraphedDocuments]);

  // Once a staged doc becomes graphed, drop it from the staged set (it is now aqua).
  useEffect(() => {
    setGraphSelectedIds((prev) => {
      const next = prev.filter((id) => !effectiveGraphedSourceIds.includes(id));
      return next.length === prev.length ? prev : next;
    });
  }, [effectiveGraphedSourceIds, setGraphSelectedIds]);

  const handleUploadStart = () => {
    if (!sourcesSidebarExpanded) {
      setSourcesSidebarExpanded(true);
    }
  };

  const handleDocumentsUploaded = (uploadedDocumentIds: string[]) => {
    setDocumentIds([...documentIds, ...uploadedDocumentIds]);
  };

  if (!isVisible) {
    return null;
  }

  const toggleExpanded = () => {
    setSourcesSidebarExpanded(!sourcesSidebarExpanded);
    if (sourcesSidebarExpanded) {
      setHighlightedCitation(null);
    }
    // Named by the direction the click took, so the trail reads as the action
    // the user performed rather than the resulting panel state.
    track.togglePanel(sourcesSidebarExpanded ? 'Collapse sources sidebar' : 'Expand sources sidebar');
  };

  const handleSourceClick = (sourceId: string, sourceType: 'knowledge-base' | 'document') => {
    setHasUserInteracted(true);
    // Always expand the sidebar when viewing source content
    if (!sourcesSidebarExpanded) {
      setSourcesSidebarExpanded(true);
    }

    // Find the source and its data
    if (sourceType === 'document' && userDocuments?.documents) {
      const document = userDocuments.documents.find(doc => doc.id === sourceId);
      if (document) {
        setDisplaySource({
          id: sourceId,
          type: 'document',
          label: document.filename,
          text: document.text,
        });
      }
    } else if (sourceType === 'knowledge-base' && userKnowledgeBases?.userKnowledgeBases) {
      const knowledgeBase = userKnowledgeBases.userKnowledgeBases.find(kb => kb.id === sourceId);
      if (knowledgeBase) {
        setDisplaySource({
          id: sourceId,
          type: 'knowledge-base',
          label: knowledgeBase.label,
          text: undefined, // Knowledge bases don't have text content to display
        });
      }
    }
  };

  const handleCloseSourceView = () => {
    setDisplaySource(null);
    setHighlightedCitation(null);
  };

  const handleToggleKnowledgeGraph = () => {
    const newShowKnowledgeGraph = !showKnowledgeGraph;
    setShowKnowledgeGraph(newShowKnowledgeGraph);

    if (newShowKnowledgeGraph) {
      setSelectedArtifact(null);
      setUseGraph(true);
    }
  };

  const handleGenerateGraph = async () => {
    // Build the staged-to-graph set (the chat checkbox no longer drives graphing).
    if (graphSelectedIds.length === 0) {
      return;
    }

    // Filter out tabular documents (CSV, XLSX, XLS) - they cannot be graphed
    const graphableDocIds = graphSelectedIds.filter(id =>
      !TABULAR_FILE_EXTENSIONS.some(ext =>
        userDocuments?.documents?.find(doc => doc.id === id)?.filename.toLowerCase().endsWith(ext)
      )
    );

    if (graphableDocIds.length === 0) {
      // All selected documents are tabular, cannot proceed
      return;
    }

    // Identify which docs actually need graphing (not already graphed or ungraphable)
    const newSourceIds = graphableDocIds.filter((id: string) =>
      !effectiveGraphedSourceIds.includes(id) &&
      !ungraphableDocumentIds.includes(id)
    );

    if (newSourceIds.length === 0) {
      return;
    }

    // Set graphing state BEFORE API call for immediate UI feedback
    setIsGeneratingGraph(true);
    setGraphingSourceIds(newSourceIds);

    try {
      const result = await buildGraph.mutateAsync({
        documentIds: newSourceIds,
        schemaKeysByDocumentId: effectiveSchemas,
      });

      if (result.status === GraphBuildStatus.Completed) {
        // Already completed (reusing existing graph)
        setIsGeneratingGraph(false);
        setUseGraph(true);
        setShowGraphTooltip(true);
        setGraphingSourceIds([]);
        refetchGraphedDocuments();
        setTimeout(() => setShowGraphTooltip(false), 3000);
      } else {
        // Building - start polling for status updates.
        // graphId is reused across every build attempt on this graph (one row
        // per user), so react-query's cache for getGraphStatus({graphId}) can
        // still hold a stale TERMINAL status from the previous attempt (e.g.
        // Completed from an earlier cancel's rollback settle). invalidate()
        // only flags that entry stale — it still returns synchronously on the
        // next render before the background refetch lands, which re-fires the
        // terminal-status effect on stale data and flickers the badge back to
        // "Staged" before the real Building status arrives. reset() clears the
        // cached value outright so there is nothing stale to flash.
        await utils.graph.getGraphStatus.reset({ graphId: result.graphId });
        setGraphId(result.graphId);
      }
    } catch (error) {
      setIsGeneratingGraph(false);
      setGraphingSourceIds([]);
      // Error handling - could add notification here
    }
  };

  if (!sourcesSidebarExpanded) {
    return (
      <Box 
        bg='dark.7' 
        p='md' 
        pr={0}
        h='100vh'
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: 'fit-content',
          minWidth: 'auto',
        }}
      >
        <Stack
          bg='dark.5' 
          align='center'
          spacing='xs'
          p='sm'
          pb='md'
          style={{
            borderRadius: '8px',
            flex: 1,
            maxHeight: '100%',
            overflow: 'hidden',
            width: 'fit-content',
          }}
        >
          <ActionIcon
            data-testid='expand-sources-sidebar-button'
            variant='subtle'
            onClick={toggleExpanded}
            mb='xl'
            size='sm'
            color='gray.5'
          >
            <ThemeIcon size='sm'>
              <IconLayoutSidebarLeftExpand stroke={1.5} />
            </ThemeIcon>
          </ActionIcon>

          <Tooltip
            label={canAddSources ? 'Add source' : addSourcesDisabledLabel}
            position='bottom'
            multiline={!canAddSources}
            w={canAddSources ? undefined : 240}
            events={{ hover: true, focus: true, touch: true }}
          >
            <Box>
              <ActionIcon
                data-testid='add-sources-button-collapsed'
                variant='subtle'
                onClick={() => {
                  setHasUserInteracted(true);
                  setIsAddSourcesModalOpen(true);
                }}
                disabled={!canAddSources}
                mb='md'
                size='md'
                color='blue'
              >
                <ThemeIcon size='md'>
                  <IconPlus stroke={1.5} />
                </ThemeIcon>
              </ActionIcon>
            </Box>
          </Tooltip>

          <Box
            pt='xxs'
            style={{ 
              flex: 1, 
              overflowY: 'auto',
              overflowX: 'hidden',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
            sx={{
              '&::-webkit-scrollbar': {
                display: 'none',
              },
            }}
          >
            <CollapsedSourcesList
              selectedSources={selectedSources}
              onSourceClick={handleSourceClick}
              graphedSourceIds={effectiveGraphedSourceIds}
              ungraphableSourceIds={ungraphableDocumentIds}
              graphingSourceIds={graphingSourceIds}
              useGraph={useGraph}
            />
          </Box>
        </Stack>
        <AddSourcesModal
          isModalOpen={isAddSourcesModalOpen}
          closeModalHandler={() => setIsAddSourcesModalOpen(false)}
          documentSourceCount={userDocuments?.documents?.length || 0}
          onUploadStart={handleUploadStart}
          onDocumentsUploaded={handleDocumentsUploaded}
          setUploadingDocuments={setUploadingDocuments}
        />
      </Box>
    );
  }

  return (
    <Stack
      bg='dark.7'
      h='100vh'
      spacing={0}
      w={460}
      style={{ flexShrink: 0 }}
    >
      <Box
        bg='dark.5' 
        style={{
          flex: 1,
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: 'calc(100vh - 2rem)',
          overflow: 'hidden',
        }}
        py='sm'
        px='md'
        m='md'
        mr={0}
      >
        <Group position='apart' mb='md'>
          <Text size='sm' fw='bold' color='gray.2'>
            Sources 
          </Text>
          <ActionIcon
            data-testid='collapse-sources-sidebar-button'
            size='sm'
            variant='subtle'
            onClick={displaySource ? handleCloseSourceView : toggleExpanded}
            color='gray.4'
          >
            <ThemeIcon size='sm'>
              {displaySource ? <IconArrowsDiagonalMinimize2 stroke={1.5} /> : <IconLayoutSidebarLeftCollapse stroke={1.5} />}
            </ThemeIcon>
          </ActionIcon>
        </Group>

        {!displaySource && (
          <>
            <SimpleGrid cols={2} spacing='md' my='md'>
              <Tooltip
                label={addSourcesDisabledLabel}
                disabled={canAddSources}
                multiline
                w={240}
                events={{ hover: true, focus: true, touch: true }}
              >
                <Box>
                  <Button
                    data-testid='add-sources-button-expanded'
                    leftIcon={<IconPlus size={16} />}
                    variant='filled'
                    size='sm'
                    onClick={() => {
                      setHasUserInteracted(true);
                      setIsAddSourcesModalOpen(true);
                    }}
                    disabled={!canAddSources}
                    color='blue'
                    fullWidth
                  >
                    Add Sources
                  </Button>
                </Box>
              </Tooltip>

              <Button
                data-testid='manage-collections-button'
                leftIcon={<IconFolder size={16} />}
                variant='outline'
                size='sm'
                onClick={() => {
                  setHasUserInteracted(true);
                  setIsManageCollectionsModalOpen(true);
                }}
              >
                Manage
              </Button>
            </SimpleGrid>

            {userGraphDatabaseAccess?.hasAccess && (
              <Stack spacing='sm'>
              <SimpleGrid cols={2} spacing='md'>
                <Popover
                  opened={jsonValidationResults.hasJsonFiles && importPopoverOpened}
                  onChange={setImportPopoverOpened}
                  position='bottom'
                  withArrow
                  withinPortal
                  width={360}
                >
                  <Popover.Target>
                    <div
                      onMouseEnter={() => jsonValidationResults.hasJsonFiles && setImportPopoverOpened(true)}
                      onMouseLeave={() => setImportPopoverOpened(false)}
                    >
                      <Tooltip
                        label={
                          !systemConfig?.knowledgeGraphAiProviderModelId
                            ? 'A Knowledge Graph AI Provider Model must be configured in admin settings to use this feature'
                            : graphSelectedIds.length === 0
                            ? 'Stage documents to graph by clicking the circle on each row'
                            : hasTabularDocs
                            ? 'Tabular data files (.CSV, .XLSX, .XLS) cannot be graphed. Please deselect to continue.'
                            : allSelectedDocsProcessed
                            ? 'All staged sources are already graphed'
                            : isGeneratingGraph
                            ? 'Building knowledge graph from your sources. This may take a few minutes.'
                            : hasUngraphedSelectedDocs
                            ? (schemaBreakdown ?? 'Build the staged sources into your knowledge graph')
                            : 'Create a knowledge graph from your sources'
                        }
                        position='bottom'
                        multiline
                        w={250}
                        disabled={jsonValidationResults.hasJsonFiles}
                      >
                        <span style={{ cursor: 'default', display: 'block' }}>
                          <Button
                            data-testid='generate-graph-button'
                            leftIcon={<IconNetwork size={16} />}
                            variant={isGeneratingGraph ? 'filled' : 'outline'}
                            color={isGeneratingGraph && isCancellingActiveBuild ? 'red' : undefined}
                            size='sm'
                            fullWidth
                            onClick={isGeneratingGraph ? (e: React.MouseEvent) => e.preventDefault() : handleGenerateGraph}
                            disabled={graphSelectedIds.length === 0 || hasTabularDocs || allSelectedDocsProcessed || isImporting || !systemConfig?.knowledgeGraphAiProviderModelId}
                            loading={isGeneratingGraph}
                          >
                            {isGeneratingGraph
                              ? (isCancellingActiveBuild ? 'Cancelling...' : 'Graphing...')
                              : graphBuildableCount > 0
                                ? `Graph (${graphBuildableCount})`
                                : 'Graph'}
                          </Button>
                        </span>
                      </Tooltip>
                    </div>
                  </Popover.Target>
                  <Popover.Dropdown p='md'>
                    <Stack spacing='md'>
                      <Stack spacing={6}>
                        <Text size='sm' fw={600} color='gray.2'>
                          Graphing JSON Data
                        </Text>
                        <Text size='xs' color='gray.5'>
                          JSON files matching the knowledge graph structure are imported directly.
                          Otherwise, they are imported with an AI-powered extraction process.
                        </Text>
                      </Stack>

                      {jsonValidationResults.files.filter((f) => f.isJson).length > 0 && (
                        <Stack spacing={4}>
                          {jsonValidationResults.files
                            .filter((file) => file.isJson)
                            .map((file) => (
                              <Group key={file.id} spacing='xs' position='apart' noWrap>
                                <Text
                                  size='xs'
                                  color='gray.6'
                                  style={{
                                    flex: 1,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {file.filename}
                                </Text>
                                <Group spacing={4} noWrap>
                                  <Box
                                    sx={(theme) => ({
                                      width: 6,
                                      height: 6,
                                      borderRadius: '50%',
                                      backgroundColor: file.isValidGraph ? theme.colors.green[5] : theme.colors.orange[5],
                                      flexShrink: 0,
                                    })}
                                  />
                                  <Text
                                    size='xs'
                                    color={file.isValidGraph ? 'green.4' : 'orange.4'}
                                    fw={500}
                                    style={{ whiteSpace: 'nowrap' }}
                                  >
                                    {file.isValidGraph ? 'Direct' : 'AI Extraction'}
                                  </Text>
                                </Group>
                              </Group>
                            ))}
                        </Stack>
                      )}

                      <Stack spacing={6}>
                        <Text size='xs' color='gray.6' fw={500}>
                          Knowledge graph structure:
                        </Text>
                        <Box
                          sx={(theme) => ({
                            borderRadius: theme.radius.sm,
                            overflow: 'hidden',
                            '& .markdown': {
                              fontSize: '11px',
                            },
                          })}
                        >
                          <Markdown
                            value={`{
  "entities": [
    {
      "id": "...",
      "label": "Entity" | "Concept",
      "type": "...",
      "name": "..."
    }
  ],
  "relations": [
    {
      "source": "...",
      "target": "...",
      "type": "..."
    }
  ]
}`}
                            fileExtension='.json'
                            isPreview={false}
                          />
                        </Box>
                      </Stack>
                    </Stack>
                  </Popover.Dropdown>
                </Popover>

                {
                  <Button
                    data-testid='view-graph-button'
                    leftIcon={<IconSitemap size={16} />}
                    variant={showKnowledgeGraph ? 'filled' : 'outline'}
                    size='sm'
                    onClick={handleToggleKnowledgeGraph}
                    disabled={documentIds.filter(id => effectiveGraphedSourceIds.includes(id)).length === 0}
                  >
                    View Graph
                  </Button>
                }
              </SimpleGrid>
              </Stack>
            )}
          </>
        )}
        
        {displaySource ? (
          <Box
            mt='md'  
            mb='sm'
            style={{ 
              flex: 1,
              maxHeight: '100%',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Text 
              size='sm' 
              color='gray.6' 
              fw='bold' 
              mb='md'
              style={{
                wordBreak: 'break-word',
                overflowWrap: 'break-word',
                whiteSpace: 'pre-wrap',
                maxWidth: '100%',
              }}
            >
              {displaySource.label}
            </Text>
            <Box style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
              {displaySource.type === 'document' && documentText ? (
                displaySource.label.toLowerCase().endsWith('.json') ? (
                  <Text
                    size='sm'
                    color='gray.5'
                    style={{
                      fontStyle: 'italic',
                      wordBreak: 'break-word',
                      overflowWrap: 'break-word',
                      maxWidth: '100%',
                    }}
                  >
                    Unable to preview file type
                  </Text>
                ) : (
                  <MemoizedDocumentText
                    text={documentText}
                    documentId={displaySource.id}
                    highlightedCitation={highlightedCitation}
                    renderHighlightedText={renderHighlightedText}
                  />
                )
              ) : displaySource.type === 'knowledge-base' ? (
                <Text
                  size='sm'
                  color='gray.5'
                  style={{
                    fontStyle: 'italic',
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word',
                    maxWidth: '100%',
                  }}
                >
                  Unable to preview Knowledge Base content.
                </Text>
              ) : (
                <Text
                  size='sm'
                  color='gray.5'
                  style={{
                    fontStyle: 'italic',
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word',
                    maxWidth: '100%',
                  }}
                >
                  Please reupload your file to see its content.
                </Text>
              )}
            </Box>
          </Box>
        ) : (
          <ExpandedSourcesList onSourceClick={handleSourceClick} graphingSourceIds={graphingSourceIds} removingGraphedSourceIds={removingGraphedSourceIds} />
        )}
      </Box>
      <AddSourcesModal
        isModalOpen={isAddSourcesModalOpen}
        closeModalHandler={() => setIsAddSourcesModalOpen(false)}
        documentSourceCount={userDocuments?.documents?.length || 0}
        onUploadStart={handleUploadStart}
        onDocumentsUploaded={handleDocumentsUploaded}
        setUploadingDocuments={setUploadingDocuments}
      />
      <ManageCollectionsModal
        modalOpened={isManageCollectionsModalOpen}
        closeModalHandler={() => setIsManageCollectionsModalOpen(false)}
      />
    </Stack>
  );
}
