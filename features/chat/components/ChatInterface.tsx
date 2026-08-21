import { Stack, Box, Group, Text, SegmentedControl, ActionIcon, Tooltip } from '@mantine/core';
import { IconLayoutSidebarLeftCollapse } from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import ChatContent from './ChatContent';
import ChatInput from './ChatInput';
import { ChatEmptySuggestions, ChatGreeting } from './EmptyChatSuggestions';
import ChatLayout from '@/components/layouts/ChatLayout/ChatLayout';
import { ChatProvider, useChat } from '@/features/chat/providers/ChatProvider';
import ArtifactContent from './ArtifactContent';
import ArtifactsContainer from './ArtifactsContainer';
import SourcesSidebar from './content/sources/SourcesSidebar';
import GraphVisualization from '@/features/settings/components/graph-databases/components/GraphVisualization';
import { GraphErrorBoundary } from '@/features/settings/components/graph-databases/components/GraphErrorBoundary';
import GraphSnapshotHistory, { SnapshotGraphPane } from '@/features/chat/components/GraphSnapshotHistory';
import EvidenceHistory from '@/features/chat/components/EvidenceHistory';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import useGetUserKnowledgeBases from '@/features/shared/api/get-user-knowledge-bases';
import { useGetBedrockModelAccess } from '@/features/shared/api/get-bedrock-model-access';
import useGetAvailableModels from '@/features/shared/api/get-available-models';
import useGetMessages from '@/features/chat/api/get-messages';
import { GraphSearchResultData } from '@/features/chat/types/message';
import { extractGraphCitationsFromMessage } from '@/features/chat/utils/graphCitationHelpers';
import { UiPreference } from '@/types/ui-preferences';
import CenteredLoader from '@/features/shared/components/CenteredLoader';

type ChatInterfaceProps = Readonly<{
  chatId?: string | null;
  promptId?: string | null;
  modelId?: string | null;
}>;

function ChatInterfaceContent() {
  const {
    chatId, selectedArtifact, showKnowledgeGraph, setShowKnowledgeGraph, selectedDocumentIds, documentNameMap,
    enumerationTabs, setEnumerationTabs, activeEnumerationTabId, setActiveEnumerationTabId,
    removeTab, graphEntityIds, setGraphEntityIds, addToGraph,
    graphCitationPin, restoreEvidence,
    setSelectedArtifact, useGraph,
    setGraphCanvasSelectedEntityIds,
    setGraphDisplayedEntityIds,
    graphHistoryPanelOpen,
    selectedGraphSnapshotId,
    openGraphHistory,
    closeGraphHistory,
    activeEvidenceMessageId,
    setActiveEvidenceMessageId,
    showArtifactsContainer,
  } = useChat();

  // Persisted so closed tabs aren't re-created from message history across navigation/refresh.
  const closedTabsStorageKey = chatId ? `closed-tabs:${chatId}` : null;

  function loadClosedTabs(): Set<string> {
    if (!closedTabsStorageKey) {
      return new Set();
    }
    try {
      const saved = localStorage.getItem(closedTabsStorageKey);
      if (saved) {
        return new Set(JSON.parse(saved) as string[]);
      }
    } catch { /* ignore */ }
    return new Set();
  }

  const closedTabIdsRef = useRef(loadClosedTabs());

  function loadSidePaneWidth(): number {
    try {
      const saved = localStorage.getItem(UiPreference.CHAT_SIDE_PANE_WIDTH);
      if (saved) {
        const n = Number(saved);
        if (!Number.isNaN(n) && n >= 25 && n <= 75) {
          return n;
        }
      }
    } catch { /* ignore */ }
    return 50;
  }

  const [sidePaneWidth, setSidePaneWidth] = useState<number>(loadSidePaneWidth);
  const sidePaneWidthRef = useRef(sidePaneWidth);
  useEffect(() => { sidePaneWidthRef.current = sidePaneWidth; }, [sidePaneWidth]);

  // While the guide is expanded, hide the suggestions so it can grow into that space.
  const [startHereExpanded, setStartHereExpanded] = useState(false);

  const splitContainerRef = useRef<HTMLDivElement>(null);

  const handleSidePanePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    const onMove = (ev: PointerEvent) => {
      const el = splitContainerRef.current;
      if (!el) { return; }
      const rect = el.getBoundingClientRect();
      const pct = ((rect.right - ev.clientX) / rect.width) * 100;
      const clamped = Math.max(25, Math.min(75, pct));
      setSidePaneWidth(clamped);
    };
    const onUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      try {
        localStorage.setItem(UiPreference.CHAT_SIDE_PANE_WIDTH, String(sidePaneWidthRef.current));
      } catch { /* ignore */ }
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
  }, []);

  const handleRemoveTab = useCallback((tabId: string) => {
    closedTabIdsRef.current.add(tabId);
    if (closedTabsStorageKey) {
      localStorage.setItem(closedTabsStorageKey, JSON.stringify([...closedTabIdsRef.current]));
    }
    removeTab(tabId);
  }, [removeTab, closedTabsStorageKey]);

  const { isPending: modelsIsPending } = useGetAvailableModels();

  const { data: systemConfig } = useGetSystemConfig();
  const { data: userKnowledgeBases } = useGetUserKnowledgeBases();
  const { data: bedrockModelAccess } = useGetBedrockModelAccess();
  const messagesQuery = useGetMessages(chatId);

  const documentUploadProviderId = systemConfig?.documentLibraryDocumentUploadProviderId || '';
  const hasKnowledgeBases = (userKnowledgeBases?.userKnowledgeBases?.length ?? 0) > 0;
  const awsBedrockAccess = bedrockModelAccess?.hasAccess || false;
  const displaySourcesElements = hasKnowledgeBases || (documentUploadProviderId && awsBedrockAccess);

  const activeTab = useMemo(
    () => enumerationTabs.find(t => t.id === activeEnumerationTabId) ?? null,
    [enumerationTabs, activeEnumerationTabId]
  );

  const activeEnumerationData = activeTab?.data ?? null;

  const pickEvidence = (msg: { role: string; graphSearchResult?: unknown }): GraphSearchResultData | null =>
    msg.role === 'assistant' && msg.graphSearchResult
      ? (msg.graphSearchResult as GraphSearchResultData[]).find((d) => d.kind === 'evidence') ?? null
      : null;

  // Restored answer if the user picked one from history, otherwise the latest answer.
  const evidenceData = useMemo<GraphSearchResultData | null>(() => {
    const msgs = messagesQuery.data?.messages;
    if (!msgs) {return null;}
    if (activeEvidenceMessageId) {
      const restored = msgs.find((m) => m.id === activeEvidenceMessageId);
      const ev = restored ? pickEvidence(restored) : null;
      if (ev) {return ev;}
    }
    for (let i = msgs.length - 1; i >= 0; i--) {
      const ev = pickEvidence(msgs[i]);
      if (ev) {return ev;}
    }
    return null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messagesQuery.data?.messages, activeEvidenceMessageId]);

  // A new answer with evidence drops any restore override so the live graph follows the latest.
  const latestEvidenceMessageId = useMemo(() => {
    const msgs = messagesQuery.data?.messages;
    if (!msgs) {return null;}
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (pickEvidence(msgs[i])) {return msgs[i].id;}
    }
    return null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messagesQuery.data?.messages]);
  const prevLatestEvidenceMessageIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevLatestEvidenceMessageIdRef.current !== null && latestEvidenceMessageId !== prevLatestEvidenceMessageIdRef.current) {
      setActiveEvidenceMessageId(null);
    }
    prevLatestEvidenceMessageIdRef.current = latestEvidenceMessageId;
  }, [latestEvidenceMessageId, setActiveEvidenceMessageId]);

  // Seed the canvas with only the directly-cited nodes; fall back to the full induced subgraph
  // when there are no resolvable inline citations. Keyed on the id-set so deselects don't snap back.
  const evidenceEntityIds = useMemo(() => {
    if (!evidenceData) {return [];}
    const allEvidenceIds = [...new Set(evidenceData.nodeMapping.flatMap((m) => m.entityIds))];
    if (evidenceData.citedText && evidenceData.handleMap) {
      const cited = new Set(
        extractGraphCitationsFromMessage(evidenceData.citedText, evidenceData.handleMap).citedNodeIds,
      );
      const citedOnGraph = allEvidenceIds.filter((id) => cited.has(id));
      if (citedOnGraph.length > 0) {return citedOnGraph;}
    }
    return allEvidenceIds;
  }, [evidenceData]);
  const evidenceSelectionKey = evidenceEntityIds.join(',');
  const prevEvidenceSelectionKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!evidenceData) {
      prevEvidenceSelectionKeyRef.current = null;
      return;
    }
    if (prevEvidenceSelectionKeyRef.current === evidenceSelectionKey) {return;}
    prevEvidenceSelectionKeyRef.current = evidenceSelectionKey;
    setGraphEntityIds(evidenceEntityIds);
  }, [evidenceData, evidenceSelectionKey, evidenceEntityIds, setGraphEntityIds]);

  // A right-clicked citation may point at a node/edge not currently on the canvas; reveal the graph
  // panel, then jump to the citation's turn or re-add the cited node(s). Guarded on the request
  // object's identity so it runs once per right-click, not on every re-render.
  const lastOrchestratedCitationPinRef = useRef<typeof graphCitationPin>(null);
  useEffect(() => {
    if (!graphCitationPin || graphCitationPin === lastOrchestratedCitationPinRef.current) {return;}
    lastOrchestratedCitationPinRef.current = graphCitationPin;

    setShowKnowledgeGraph(true);
    setSelectedArtifact(null);

    const displayedEvidenceMessageId = activeEvidenceMessageId ?? latestEvidenceMessageId;
    const { target, sourceMessageId } = graphCitationPin;

    if (sourceMessageId !== displayedEvidenceMessageId) {
      restoreEvidence(sourceMessageId);
      return;
    }
    // Same turn: an edge citation implies both of its endpoints.
    const citedUuids = target.nodeUuid
      ? [target.nodeUuid]
      : target.edge
        ? [target.edge.src, target.edge.tgt]
        : [];
    if (citedUuids.length > 0) {
      addToGraph(citedUuids);
    }
  }, [graphCitationPin, activeEvidenceMessageId, latestEvidenceMessageId, restoreEvidence, addToGraph, setShowKnowledgeGraph, setSelectedArtifact]);

  const mergedEnumerationGraphData = useMemo(() => {
    if (graphEntityIds.length === 0) {return undefined;}
    const selectedSet = new Set(graphEntityIds);
    const nodeMap = new Map<number, any>();
    const edgeSet = new Set<string>();
    const edges: any[] = [];

    for (const tab of enumerationTabs) {
      if (!tab.data.graphData) {continue;}
      for (const node of tab.data.graphData.nodes) {
        if (!nodeMap.has(node.id) && selectedSet.has(node.properties?.id)) {
          nodeMap.set(node.id, node);
        }
      }
    }

    if (nodeMap.size === 0) {return undefined;}

    for (const tab of enumerationTabs) {
      if (!tab.data.graphData) {continue;}
      for (const edge of tab.data.graphData.edges) {
        if (nodeMap.has(edge.from) && nodeMap.has(edge.to)) {
          const key = `${edge.from}-${edge.to}-${edge.type}`;
          if (!edgeSet.has(key)) {
            edgeSet.add(key);
            edges.push(edge);
          }
        }
      }
    }

    return { nodes: Array.from(nodeMap.values()), edges };
  }, [enumerationTabs, graphEntityIds]);

  // In evidence mode the evidence entry is the primary graph, taking precedence over merged data.
  const enumerationDataForGraph = useMemo(() => {
    if (evidenceData) {return evidenceData;}
    if (!activeEnumerationData) {return null;}
    return {
      ...activeEnumerationData,
      graphData: mergedEnumerationGraphData,
    };
  }, [evidenceData, activeEnumerationData, mergedEnumerationGraphData]);

  const handleCloseKnowledgeGraph = () => {
    setShowKnowledgeGraph(false);
  };

  const allArtifacts = useMemo(() => {
    if (!messagesQuery.data?.messages) {
      return [];
    }
    const artifacts: any[] = [];
    for (const msg of messagesQuery.data.messages) {
      if (msg.role === 'assistant' && msg.artifacts && msg.artifacts.length > 0) {
        artifacts.push(...msg.artifacts);
      }
    }
    return artifacts;
  }, [messagesQuery.data?.messages]);

  // Mutual exclusion between artifacts and knowledge graph.
  useEffect(() => {
    if (selectedArtifact && showKnowledgeGraph) {
      setShowKnowledgeGraph(false);
    }
  }, [selectedArtifact, showKnowledgeGraph, setShowKnowledgeGraph]);

  // Turn each graph search result into a tab keyed by a stable `${messageId}:${index}` id.
  useEffect(() => {
    if (!messagesQuery.data?.messages) {return;}
    const msgs = messagesQuery.data.messages;

    const allGraphSearchResults: { id: string; data: GraphSearchResultData; messageId: string }[] = [];
    for (const msg of msgs) {
      if (msg.role !== 'assistant' || !msg.graphSearchResult) {continue;}
      (msg.graphSearchResult as GraphSearchResultData[]).forEach((data, index) => {
        // Evidence entries render as the primary graph, not as exploration tabs.
        if (data.kind === 'evidence') {return;}
        allGraphSearchResults.push({ id: `${msg.id}:${index}`, data, messageId: msg.id });
      });
    }

    if (allGraphSearchResults.length === 0) {
      setEnumerationTabs([]);
      setActiveEnumerationTabId(null);
      return;
    }

    let newestNewTabId: string | null = null;

    setEnumerationTabs(prev => {
      const existingIds = new Set(prev.map(t => t.id));
      const newResultIds = new Set(allGraphSearchResults.map(r => r.id));

      const updated = prev.filter(t => newResultIds.has(t.id));

      for (const { id, data, messageId } of allGraphSearchResults) {
        if (!existingIds.has(id) && !closedTabIdsRef.current.has(id)) {
          updated.push({ id, label: data.query, data, messageId });
          newestNewTabId = id;
        }
      }

      const orderMap = new Map(allGraphSearchResults.map((r, i) => [r.id, i]));
      updated.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));

      return updated;
    });

    // Activate a newly completed tab, otherwise keep the user's current selection.
    if (newestNewTabId) {
      setActiveEnumerationTabId(newestNewTabId);
    } else if (!activeEnumerationTabId || !allGraphSearchResults.some(r => r.id === activeEnumerationTabId)) {
      const latestId = allGraphSearchResults[allGraphSearchResults.length - 1].id;
      setActiveEnumerationTabId(latestId);
    }
    setSelectedArtifact(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messagesQuery.data?.messages]);

  const handleEntitySelectionChange = useCallback((ids: string[]) => {
    setGraphEntityIds(ids);
  }, [setGraphEntityIds]);

  const handleGraphCanvasSelectionChange = useCallback((entityIds: string[]) => {
    setGraphCanvasSelectedEntityIds(entityIds);
  }, [setGraphCanvasSelectedEntityIds]);

  const handleGraphDisplayedNodesChange = useCallback((entityIds: string[]) => {
    setGraphDisplayedEntityIds(entityIds);
  }, [setGraphDisplayedEntityIds]);

  if (!chatId && modelsIsPending) {
    return <CenteredLoader />;
  }

  return (
    <>
      <Stack
        h='100%'
        spacing={0}
        bg='dark.7'
      >
        <Box
          style={{
            flex: 1,
            minHeight: 0,
            position: 'relative',
          }}
        >
          <Group align='stretch' spacing={0} h='100%' noWrap ref={splitContainerRef}>
            {displaySourcesElements && (
              <SourcesSidebar />
            )}

            <Stack
              spacing={0}
              mt='md'
              bg='dark.7'
              sx={{
                flex: 1,
                minWidth: 0,
                containerType: 'inline-size',
                containerName: 'chat',
                // Top-anchored so the greeting + input stay fixed as the guide grows downward.
                justifyContent: 'flex-start',
                paddingTop: chatId ? undefined : 'clamp(24px, 16vh, 200px)',
              }}
            >
              {chatId ? (
                // Input renders inside the scroll container so the scroll area spans the whole pane.
                <Box sx={{ flex: 1, minHeight: 0 }}>
                  <ChatContent input={<ChatInput />} />
                </Box>
              ) : (
                <>
                  <Box><ChatContent /></Box>
                  <ChatGreeting />
                  <ChatInput onStartHereExpandedChange={setStartHereExpanded} />
                  {!startHereExpanded && <ChatEmptySuggestions />}
                </>
              )}
            </Stack>

            {(selectedArtifact || showKnowledgeGraph || showArtifactsContainer) && (
              <Box
                onPointerDown={handleSidePanePointerDown}
                sx={(theme) => ({
                  width: 4,
                  cursor: 'col-resize',
                  backgroundColor: theme.colors.dark[5],
                  flexShrink: 0,
                  transition: 'background-color 120ms',
                  '&:hover': { backgroundColor: theme.colors.cyan[7] },
                })}
              />
            )}

            {showArtifactsContainer && (
              <Stack
                spacing={0}
                w={`${sidePaneWidth / 2}%`}
                h='100%'
              >
                <ArtifactsContainer artifacts={allArtifacts} />
              </Stack>
            )}

            {selectedArtifact && !showArtifactsContainer && (
              <Stack
                spacing={0}
                w={`${sidePaneWidth}%`}
                h='100%'
              >
                <ArtifactContent artifact={selectedArtifact} />
              </Stack>
            )}

            {showKnowledgeGraph && (
              <Stack w={`${sidePaneWidth}%`} h='100%' spacing={0} sx={{ minWidth: 0 }}>
                <Group
                  px='md'
                  py='xs'
                  position='apart'
                  bg='dark.4'
                  sx={{ flexShrink: 0 }}
                >
                  <Text size='sm' color='gray.2' fw={500}>Knowledge Graph</Text>
                  <Group spacing='xs'>
                    <SegmentedControl
                      size='xs'
                      value={graphHistoryPanelOpen ? 'history' : 'graph'}
                      onChange={(v) => (v === 'history' ? openGraphHistory() : closeGraphHistory())}
                      data={[
                        { label: 'Graph', value: 'graph' },
                        { label: 'History', value: 'history' },
                      ]}
                    />
                    <Tooltip label='Close knowledge graph' position='left'>
                      <ActionIcon size='sm' onClick={handleCloseKnowledgeGraph}>
                        <IconLayoutSidebarLeftCollapse stroke={1} aria-label='Close knowledge graph' />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Group>

                <Box sx={{ flex: 1, position: 'relative', minHeight: 0 }}>
                  <GraphErrorBoundary onReset={handleCloseKnowledgeGraph}>
                    {/* Always mounted so graph state survives history/snapshot views; hidden via CSS. */}
                    <Box
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        display: (graphHistoryPanelOpen || selectedGraphSnapshotId) ? 'none' : 'block',
                        '& > .mantine-Stack-root': { width: '100% !important' },
                      }}
                    >
                      <GraphVisualization
                        documentIds={selectedDocumentIds}
                        documentNameMap={documentNameMap}
                        isInChatContext={true}
                        enumerationData={enumerationDataForGraph}
                        selectedEntityIds={graphEntityIds}
                        tableSelectedEntityIds={graphEntityIds}
                        onEntitySelectionChange={handleEntitySelectionChange}
                        enumerationTabs={enumerationTabs}
                        activeTabId={activeEnumerationTabId}
                        onTabChange={setActiveEnumerationTabId}
                        onTabClose={handleRemoveTab}
                        onGraphCanvasSelectionChange={handleGraphCanvasSelectionChange}
                        onGraphDisplayedNodesChange={handleGraphDisplayedNodesChange}
                        onResetGraph={() => setGraphEntityIds(evidenceEntityIds)}
                        key={selectedDocumentIds.join(',')}
                      />
                    </Box>

                    {graphHistoryPanelOpen && !selectedGraphSnapshotId && (
                      <Box sx={{ position: 'absolute', inset: 0 }}>
                        <EvidenceHistory />
                      </Box>
                    )}

                    {selectedGraphSnapshotId && (
                      <Box
                        sx={(theme) => ({
                          position: 'absolute',
                          inset: 0,
                          display: 'flex',
                          flexDirection: 'column',
                          backgroundColor: theme.colors.dark[4],
                        })}
                      >
                        <GraphSnapshotHistory />
                        <Box sx={{ flex: 1, minHeight: 0 }}>
                          <SnapshotGraphPane />
                        </Box>
                      </Box>
                    )}
                  </GraphErrorBoundary>
                </Box>
              </Stack>
            )}
          </Group>

        </Box>
      </Stack>

    </>
  );
}

export default function ChatInterface({
  chatId,
  promptId,
  modelId,
}: ChatInterfaceProps) {
  return (
    <ChatLayout>
      <ChatProvider chatId={chatId} promptId={promptId} modelId={modelId}>
        <ChatInterfaceContent />
      </ChatProvider>
    </ChatLayout>
  );
}
