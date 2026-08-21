import { createContext, useContext, useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';

import { Artifact, GraphSearchTab, QueryScope } from '@/features/chat/types/message';
import type { GraphCitationTarget } from '@/features/chat/utils/graphCitationHelpers';
import { Document } from '@/features/shared/types/document';
import useGetDocuments from '@/features/shared/api/document-upload/get-documents';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';

interface ChatContextData {
  chatId: string | null;
  setChatId: (chatId: string) => void;
  promptId: string | null;
  setPromptId: (promptId: string | null) => void;
  modelId: string | null;
  setModelId: (modelId: string) => void;
  pendingMessage: string | null;
  setPendingMessage: (message: string | null) => void;
  isLastMessageRetry: boolean;
  setIsLastMessageRetry: (isLastMessageRetry: boolean) => void;
  regeneratingResponse: boolean;
  setRegeneratingResponse: (isRegenerating: boolean) => void;
  systemMessage: string | null;
  setSystemMessage: (content: string) => void;
  selectedText: string | null;
  setSelectedText: (text: string | null) => void;
  entryBeingEdited: string | null;
  setEntryBeingEdited: (id: string | null) => void;
  selectedArtifact: Artifact | null;
  setSelectedArtifact: (artifact: Artifact | null) => void;
  hasUserSubmittedMessageInSession: boolean;
  setHasUserSubmittedMessageInSession: (hasSubmitted: boolean) => void;
  // Deep Research
  deepResearchEnabled: boolean;
  setDeepResearchEnabled: (enabled: boolean) => void;
  // RAG-related
  knowledgeBaseIds: string[];
  setKnowledgeBaseIds: (ids: string[]) => void;
  documentIds: string[];
  setDocumentIds: (ids: string[]) => void;
  uploadingDocuments: Document[];
  setUploadingDocuments: (docs: Document[] | ((prev: Document[]) => Document[])) => void;
  useGraph: boolean;
  setUseGraph: (useGraph: boolean) => void;
  sourcesSidebarExpanded: boolean;
  setSourcesSidebarExpanded: (expanded: boolean) => void;
  allSourcesSelected: boolean;
  setAllSourcesSelected: (selected: boolean) => void;
  isGeneratingGraph: boolean;
  setIsGeneratingGraph: (generating: boolean) => void;
  showGraphTooltip: boolean;
  setShowGraphTooltip: (show: boolean) => void;
  graphedSourceIds: string[];
  setGraphedSourceIds: (ids: string[]) => void;
  graphingSourceIds: string[];
  setGraphingSourceIds: (ids: string[]) => void;
  removingGraphedSourceIds: string[];
  setRemovingGraphedSourceIds: (ids: string[]) => void;
  // Per-document extraction-schema overrides for the next graph build, keyed by
  // document id. Set from the source rows; read by the build trigger.
  perDocSchemaOverrides: Record<string, string>;
  setPerDocSchemaOverrides: (overrides: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void;
  graphSelectedIds: string[];
  setGraphSelectedIds: (ids: string[] | ((prev: string[]) => string[])) => void;
  // graphIds the user explicitly cancelled this session. Consumed (and removed)
  // by the graphStatus->Completed handler so a cancel-triggered settle never
  // shows the same "success" tooltip as a genuine completion.
  cancelledGraphIds: string[];
  setCancelledGraphIds: (ids: string[] | ((prev: string[]) => string[])) => void;
  highlightedCitation: { documentId: string; embeddingId?: string; citation: string; startPosition?: number; endPosition?: number } | null;
  setHighlightedCitation: (citation: { documentId: string; embeddingId?: string; citation: string; startPosition?: number; endPosition?: number } | null) => void;
  // Citation → graph remote control. Right-clicking an inline answer citation pins the cited node/edge
  // on the graph canvas IDENTICALLY to right-clicking that element on the canvas (same pinnedElement →
  // same gray halo + detail card). The request carries the answer's `sourceMessageId` so the canvas can
  // land the pin even when the cited element isn't currently shown: if the citation belongs to a
  // different turn, ChatInterface jumps the canvas to that turn's evidence graph; if it's the displayed
  // turn but the node was removed, ChatInterface re-adds it. Each request is a fresh object so the canvas
  // toggles the pin once per right-click (identity, not value, signals "new request").
  graphCitationPin: { target: GraphCitationTarget; sourceMessageId: string } | null;
  requestGraphCitationPin: (target: GraphCitationTarget, sourceMessageId: string) => void;
  showKnowledgeGraph: boolean;
  setShowKnowledgeGraph: (show: boolean) => void;
  selectedDocumentIds: string[];
  documentNameMap: Record<string, string>;
  enumerationTabs: GraphSearchTab[];
  setEnumerationTabs: (tabs: GraphSearchTab[] | ((prev: GraphSearchTab[]) => GraphSearchTab[])) => void;
  activeEnumerationTabId: string | null;
  setActiveEnumerationTabId: (id: string | null) => void;
  removeTab: (tabId: string) => void;
  graphEntityIds: string[];
  setGraphEntityIds: (ids: string[]) => void;
  addToGraph: (ids: string[]) => void;
  removeFromGraph: (ids: string[]) => void;
  queryScope: QueryScope;
  setQueryScope: (mode: QueryScope) => void;
  graphCanvasSelectedEntityIds: string[];
  setGraphCanvasSelectedEntityIds: (ids: string[]) => void;
  graphDisplayedEntityIds: string[];
  setGraphDisplayedEntityIds: (ids: string[]) => void;
  graphHistoryPanelOpen: boolean;
  setGraphHistoryPanelOpen: (open: boolean) => void;
  selectedGraphSnapshotId: string | null;
  setSelectedGraphSnapshotId: (id: string | null) => void;
  openGraphSnapshot: (snapshotId: string) => void;
  openGraphHistory: () => void;
  closeGraphHistory: () => void;
  // Restore-as-active: which past answer's evidence subgraph is the active one (null = follow latest).
  activeEvidenceMessageId: string | null;
  setActiveEvidenceMessageId: (id: string | null) => void;
  restoreEvidence: (messageId: string) => void;
  // Request the chat pane to scroll to a message (history → chat jump). Cleared after the scroll.
  scrollToMessageId: string | null;
  setScrollToMessageId: (id: string | null) => void;
  prefilledMessage: string | null;
  setPrefilledMessage: (message: string | null) => void;
  autoSubmitMessage: string | null;
  setAutoSubmitMessage: (message: string | null) => void;
  triggerAddSource: boolean;
  setTriggerAddSource: (trigger: boolean) => void;
  triggerEditSystemPrompt: boolean;
  setTriggerEditSystemPrompt: (trigger: boolean) => void;
  showSystemEntry: boolean;
  setShowSystemEntry: (show: boolean) => void;
  hasUserInteracted: boolean;
  setHasUserInteracted: (interacted: boolean) => void;
  messageInputHasText: boolean;
  setMessageInputHasText: (hasText: boolean) => void;
  showArtifactsContainer: boolean;
  setShowArtifactsContainer: (show: boolean) => void;
  showAgentOnboarding: boolean;
  setShowAgentOnboarding: (show: boolean) => void;
  openAccordionItems: string[];
  setOpenAccordionItems: (items: string[]) => void;
}

const ChatContext = createContext<ChatContextData>({
  chatId: null,
  setChatId: () => { },
  promptId: null,
  setPromptId: () => { },
  pendingMessage: null,
  setPendingMessage: () => { },
  modelId: null,
  setModelId: () => { },
  isLastMessageRetry: false,
  setIsLastMessageRetry: () => { },
  regeneratingResponse: false,
  setRegeneratingResponse: () => { },
  knowledgeBaseIds: [],
  setKnowledgeBaseIds: () => { },
  documentIds: [],
  setDocumentIds: () => {},
  deepResearchEnabled: false,
  setDeepResearchEnabled: () => {},
  useGraph: false,
  setUseGraph: () => {},
  selectedArtifact: null,
  setSelectedArtifact: () => {},
  hasUserSubmittedMessageInSession: false,
  setHasUserSubmittedMessageInSession: () => {},
  systemMessage: null,
  setSystemMessage: () => { },
  selectedText: null,
  setSelectedText: () => {},
  entryBeingEdited: null,
  setEntryBeingEdited: () => { },
  sourcesSidebarExpanded: false,
  setSourcesSidebarExpanded: () => {},
  allSourcesSelected: false,
  setAllSourcesSelected: () => {},
  isGeneratingGraph: false,
  setIsGeneratingGraph: () => {},
  showGraphTooltip: false,
  setShowGraphTooltip: () => {},
  graphedSourceIds: [],
  setGraphedSourceIds: () => {},
  graphingSourceIds: [],
  setGraphingSourceIds: () => {},
  removingGraphedSourceIds: [],
  setRemovingGraphedSourceIds: () => {},
  perDocSchemaOverrides: {},
  setPerDocSchemaOverrides: () => {},
  graphSelectedIds: [],
  setGraphSelectedIds: () => {},
  cancelledGraphIds: [],
  setCancelledGraphIds: () => {},
  uploadingDocuments: [],
  setUploadingDocuments: () => {},
  highlightedCitation: null,
  setHighlightedCitation: () => {},
  graphCitationPin: null,
  requestGraphCitationPin: () => {},
  showKnowledgeGraph: false,
  setShowKnowledgeGraph: () => {},
  selectedDocumentIds: [],
  documentNameMap: {},
  enumerationTabs: [],
  setEnumerationTabs: () => {},
  activeEnumerationTabId: null,
  setActiveEnumerationTabId: () => {},
  removeTab: () => {},
  graphEntityIds: [],
  setGraphEntityIds: () => {},
  addToGraph: () => {},
  removeFromGraph: () => {},
  queryScope: QueryScope.DOCUMENT,
  setQueryScope: () => {},
  graphCanvasSelectedEntityIds: [],
  setGraphCanvasSelectedEntityIds: () => {},
  graphDisplayedEntityIds: [],
  setGraphDisplayedEntityIds: () => {},
  graphHistoryPanelOpen: false,
  setGraphHistoryPanelOpen: () => {},
  selectedGraphSnapshotId: null,
  setSelectedGraphSnapshotId: () => {},
  openGraphSnapshot: () => {},
  openGraphHistory: () => {},
  closeGraphHistory: () => {},
  activeEvidenceMessageId: null,
  setActiveEvidenceMessageId: () => {},
  restoreEvidence: () => {},
  scrollToMessageId: null,
  setScrollToMessageId: () => {},
  prefilledMessage: null,
  setPrefilledMessage: () => {},
  autoSubmitMessage: null,
  setAutoSubmitMessage: () => {},
  triggerAddSource: false,
  setTriggerAddSource: () => {},
  triggerEditSystemPrompt: false,
  setTriggerEditSystemPrompt: () => {},
  showSystemEntry: false,
  setShowSystemEntry: () => {},
  hasUserInteracted: false,
  setHasUserInteracted: () => {},
  messageInputHasText: false,
  setMessageInputHasText: () => {},
  showArtifactsContainer: false,
  setShowArtifactsContainer: () => {},
  showAgentOnboarding: false,
  setShowAgentOnboarding: () => {},
  openAccordionItems: [],
  setOpenAccordionItems: () => {},
});

type ChatProviderProps = {
  children: React.ReactNode;
  chatId?: string | null;
  promptId?: string | null;
  modelId?: string | null;
  initialKnowledgeBaseIds?: string[];
};

export const ChatProvider = ({
  children,
  chatId: cid,
  promptId: pid,
  modelId: mid,
  initialKnowledgeBaseIds = [],
}: ChatProviderProps) => {
  const router = useRouter();
  const hasInitializedFromQuery = useRef(false);
  const { data: systemConfig } = useGetSystemConfig();
  
  const documentUploadProviderId = systemConfig?.documentLibraryDocumentUploadProviderId || '';
  const { data: userDocuments } = useGetDocuments({
    documentUploadProviderId,
  });
  
  const [chatId, setChatId] = useState(cid ?? null);
  const [promptId, setPromptId] = useState(pid ?? null);
  const [modelId, setModelId] = useState(mid ?? null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [isLastMessageRetry, setIsLastMessageRetry] = useState(false);
  const [regeneratingResponse, setRegeneratingResponse] = useState(false);
  const [knowledgeBaseIds, setKnowledgeBaseIds] = useState<string[]>(
    initialKnowledgeBaseIds
  );
  const [documentIds, setDocumentIds] = useState<string[]>([]);
  const [deepResearchEnabled, setDeepResearchEnabled] = useState(false);
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
  const [hasUserSubmittedMessageInSession, setHasUserSubmittedMessageInSession] = useState(false);
  const [systemMessage, setSystemMessage] = useState<string | null>(null);
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [entryBeingEdited, setEntryBeingEdited] = useState<string | null>(null);
  const [sourcesSidebarExpanded, setSourcesSidebarExpanded] = useState(false);
  const [allSourcesSelected, setAllSourcesSelected] = useState(false);
  const [useGraph, setUseGraph] = useState<boolean>(false);
  const [isGeneratingGraph, setIsGeneratingGraph] = useState(false);
  const [showGraphTooltip, setShowGraphTooltip] = useState(false);
  const [graphedSourceIds, setGraphedSourceIds] = useState<string[]>([]);
  const [graphingSourceIds, setGraphingSourceIds] = useState<string[]>([]);
  const [removingGraphedSourceIds, setRemovingGraphedSourceIds] = useState<string[]>([]);
  const [perDocSchemaOverrides, setPerDocSchemaOverrides] = useState<Record<string, string>>({});
  const [graphSelectedIds, setGraphSelectedIds] = useState<string[]>([]);
  const [cancelledGraphIds, setCancelledGraphIds] = useState<string[]>([]);
  const [uploadingDocuments, setUploadingDocuments] = useState<Document[]>([]);
  const [highlightedCitation, setHighlightedCitation] = useState<{ documentId: string; embeddingId?: string; citation: string; startPosition?: number; endPosition?: number } | null>(null);
  const [graphCitationPin, setGraphCitationPin] = useState<{ target: GraphCitationTarget; sourceMessageId: string } | null>(null);
  // Each click is a NEW request object so the canvas treats repeated clicks on the same citation as
  // distinct pin toggles (it guards on object identity, not value).
  const requestGraphCitationPin = useCallback((target: GraphCitationTarget, sourceMessageId: string) => {
    setGraphCitationPin({ target, sourceMessageId });
  }, []);
  const [showKnowledgeGraph, setShowKnowledgeGraph] = useState(false);
  const [enumerationTabs, setEnumerationTabs] = useState<GraphSearchTab[]>([]);
  const [activeEnumerationTabId, setActiveEnumerationTabId] = useState<string | null>(null);
  const [queryScope, setQueryScope] = useState<QueryScope>(QueryScope.DOCUMENT);
  const [graphCanvasSelectedEntityIds, setGraphCanvasSelectedEntityIds] = useState<string[]>([]);
  const [graphDisplayedEntityIds, setGraphDisplayedEntityIds] = useState<string[]>([]);
  const [prefilledMessage, setPrefilledMessage] = useState<string | null>(null);
  const [autoSubmitMessage, setAutoSubmitMessage] = useState<string | null>(null);
  const [triggerAddSource, setTriggerAddSource] = useState<boolean>(false);
  const [triggerEditSystemPrompt, setTriggerEditSystemPrompt] = useState<boolean>(false);
  const [showSystemEntry, setShowSystemEntry] = useState<boolean>(false);
  const [hasUserInteracted, setHasUserInteracted] = useState<boolean>(false);
  const [messageInputHasText, setMessageInputHasText] = useState<boolean>(false);
  const [showArtifactsContainer, setShowArtifactsContainer] = useState<boolean>(false);
  const [showAgentOnboarding, setShowAgentOnboarding] = useState<boolean>(false);
  const [openAccordionItems, setOpenAccordionItems] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem('palm-sources-accordion-state');
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
    return [];
  });
  const enumerationTabsRef = useRef(enumerationTabs);
  useEffect(() => { enumerationTabsRef.current = enumerationTabs; }, [enumerationTabs]);

  // Save accordion state to sessionStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('palm-sources-accordion-state', JSON.stringify(openAccordionItems));
      } catch {
        // Ignore sessionStorage errors
      }
    }
  }, [openAccordionItems]);

  const [graphEntityIds, setGraphEntityIds] = useState<string[]>([]);
  const [graphHistoryPanelOpen, setGraphHistoryPanelOpen] = useState(false);
  const [selectedGraphSnapshotId, setSelectedGraphSnapshotId] = useState<string | null>(null);

  const openGraphSnapshot = useCallback((snapshotId: string) => {
    setSelectedGraphSnapshotId(snapshotId);
    setGraphHistoryPanelOpen(true);
    setShowKnowledgeGraph(true);
  }, []);

  const openGraphHistory = useCallback(() => {
    setSelectedGraphSnapshotId(null);
    setGraphHistoryPanelOpen(true);
  }, []);

  const closeGraphHistory = useCallback(() => {
    setGraphHistoryPanelOpen(false);
    setSelectedGraphSnapshotId(null);
  }, []);

  // Restore-as-active: make a past answer's evidence subgraph the live graph, then return to the
  // Graph view so the user can filter/select/explore it. Cleared back to "latest" when a new answer
  // arrives (handled in ChatInterface).
  const [activeEvidenceMessageId, setActiveEvidenceMessageId] = useState<string | null>(null);
  const restoreEvidence = useCallback((messageId: string) => {
    setActiveEvidenceMessageId(messageId);
    setGraphHistoryPanelOpen(false);
    setShowKnowledgeGraph(true);
  }, []);

  const [scrollToMessageId, setScrollToMessageId] = useState<string | null>(null);

  const addToGraph = useCallback((ids: string[]) => {
    setGraphEntityIds(prev => {
      const set = new Set(prev);
      let changed = false;
      for (const id of ids) {
        if (!set.has(id)) { set.add(id); changed = true; }
      }
      return changed ? Array.from(set) : prev;
    });
  }, []);

  const removeFromGraph = useCallback((ids: string[]) => {
    setGraphEntityIds(prev => {
      const removeSet = new Set(ids);
      const next = prev.filter(id => !removeSet.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, []);

  const removeTab = useCallback((tabId: string) => {
    // Remove entities unique to the closed tab from the graph
    const tabs = enumerationTabsRef.current;
    const removedTab = tabs.find(t => t.id === tabId);
    if (removedTab) {
      const removedEntityIds = new Set(removedTab.data.nodeMapping.flatMap(m => m.entityIds));
      const otherEntityIds = new Set(
        tabs.filter(t => t.id !== tabId).flatMap(t => t.data.nodeMapping.flatMap(m => m.entityIds))
      );
      const uniqueToTab = [...removedEntityIds].filter(id => !otherEntityIds.has(id));
      if (uniqueToTab.length > 0) {
        removeFromGraph(uniqueToTab);
      }
    }

    setEnumerationTabs(prev => prev.filter(t => t.id !== tabId));
    setActiveEnumerationTabId(prev => {
      if (prev !== tabId) {return prev;}
      const tabs = enumerationTabsRef.current;
      const idx = tabs.findIndex(t => t.id === tabId);
      if (idx > 0) {return tabs[idx - 1].id;}
      if (idx < tabs.length - 1) {return tabs[idx + 1].id;}
      return null;
    });
  }, [removeFromGraph]);

  useEffect(() => {
    setChatId(cid !== undefined ? cid : null);
    setPromptId(pid !== undefined ? pid : null);
    // Only set modelId if mid is explicitly provided, otherwise leave it as is
    if (mid !== undefined) {
      setModelId(mid);
    } else if (cid === null) {
      // Only clear modelId when explicitly starting a new chat (cid is null, not undefined)
      setModelId(null);
    }
  }, [cid, pid, mid]);

  // Initialize from query string parameters on page load
  useEffect(() => {
    if (router.isReady && !hasInitializedFromQuery.current) {
      const knowledgeBaseIdsParam = router.query.knowledge_base_ids as string;
      const documentIdsParam = router.query.document_ids as string;
      const sourcesSidebarExpandedParam = router.query.sources_sidebar_expanded as string;
      
      if (knowledgeBaseIdsParam) {
        const queryKnowledgeBaseIds = knowledgeBaseIdsParam.split(',').filter(id => id.trim());
        if (queryKnowledgeBaseIds.length > 0) {
          setKnowledgeBaseIds(queryKnowledgeBaseIds);
        }
      }
      
      if (documentIdsParam) {
        const queryDocumentIds = documentIdsParam.split(',').filter(id => id.trim());
        if (queryDocumentIds.length > 0) {
          setDocumentIds(queryDocumentIds);
        }
      }
      
      // Set sidebar state from query parameter
      if (sourcesSidebarExpandedParam === 'true' || sourcesSidebarExpandedParam === 'false') {
        setSourcesSidebarExpanded(sourcesSidebarExpandedParam === 'true');
      }
      
      hasInitializedFromQuery.current = true;
    }
  }, [router.isReady, router.query.knowledge_base_ids, router.query.document_ids, router.query.sources_sidebar_expanded]);

  const useGraphAccess = useGraph;

  // Compute selected document IDs (only documents that are checked/selected)
  const selectedDocumentIds = useMemo(() => {
    if (!userDocuments?.documents) {
      return [];
    }
    const filtered = userDocuments.documents
      .filter(doc => documentIds.includes(doc.id))
      .map(doc => doc.id);
    return filtered;
  }, [userDocuments, documentIds]);

  // Build documentId → filename map for graph visualization
  const documentNameMap = useMemo(() => {
    if (!userDocuments?.documents) {return {};}
    const map: Record<string, string> = {};
    for (const doc of userDocuments.documents) {
      map[doc.id] = doc.filename.split('/').pop()?.replace(/\.[^/.]+$/, '') || doc.filename;
    }
    return map;
  }, [userDocuments]);

  const values = useMemo(
    () => ({
      chatId,
      setChatId,
      promptId,
      setPromptId,
      pendingMessage,
      setPendingMessage,
      isLastMessageRetry,
      setIsLastMessageRetry,
      regeneratingResponse,
      setRegeneratingResponse,
      modelId,
      setModelId,
      knowledgeBaseIds,
      setKnowledgeBaseIds,
      documentIds,
      setDocumentIds,
      deepResearchEnabled,
      setDeepResearchEnabled,
      useGraph: useGraphAccess,
      setUseGraph,
      selectedArtifact,
      setSelectedArtifact,
      hasUserSubmittedMessageInSession,
      setHasUserSubmittedMessageInSession,
      systemMessage,
      setSystemMessage,
      selectedText,
      setSelectedText,
      entryBeingEdited,
      setEntryBeingEdited,
      sourcesSidebarExpanded,
      setSourcesSidebarExpanded,
      allSourcesSelected,
      setAllSourcesSelected,
      isGeneratingGraph,
      setIsGeneratingGraph,
      showGraphTooltip,
      setShowGraphTooltip,
      graphedSourceIds,
      setGraphedSourceIds,
      graphingSourceIds,
      setGraphingSourceIds,
      removingGraphedSourceIds,
      setRemovingGraphedSourceIds,
      perDocSchemaOverrides,
      setPerDocSchemaOverrides,
      graphSelectedIds,
      setGraphSelectedIds,
      cancelledGraphIds,
      setCancelledGraphIds,
      uploadingDocuments,
      setUploadingDocuments,
      highlightedCitation,
      setHighlightedCitation,
      graphCitationPin,
      requestGraphCitationPin,
      showKnowledgeGraph,
      setShowKnowledgeGraph,
      selectedDocumentIds,
      documentNameMap,
      enumerationTabs,
      setEnumerationTabs,
      activeEnumerationTabId,
      setActiveEnumerationTabId,
      removeTab,
      graphEntityIds,
      setGraphEntityIds,
      addToGraph,
      removeFromGraph,
      queryScope,
      setQueryScope,
      graphCanvasSelectedEntityIds,
      setGraphCanvasSelectedEntityIds,
      graphDisplayedEntityIds,
      setGraphDisplayedEntityIds,
      graphHistoryPanelOpen,
      setGraphHistoryPanelOpen,
      selectedGraphSnapshotId,
      setSelectedGraphSnapshotId,
      openGraphSnapshot,
      openGraphHistory,
      closeGraphHistory,
      activeEvidenceMessageId,
      setActiveEvidenceMessageId,
      restoreEvidence,
      scrollToMessageId,
      setScrollToMessageId,
      prefilledMessage,
      setPrefilledMessage,
      autoSubmitMessage,
      setAutoSubmitMessage,
      triggerAddSource,
      setTriggerAddSource,
      triggerEditSystemPrompt,
      setTriggerEditSystemPrompt,
      showSystemEntry,
      setShowSystemEntry,
      hasUserInteracted,
      setHasUserInteracted,
      messageInputHasText,
      setMessageInputHasText,
      showArtifactsContainer,
      setShowArtifactsContainer,
      showAgentOnboarding,
      setShowAgentOnboarding,
      openAccordionItems,
      setOpenAccordionItems,
    }),
    [
      chatId,
      setChatId,
      promptId,
      setPromptId,
      pendingMessage,
      setPendingMessage,
      isLastMessageRetry,
      setIsLastMessageRetry,
      regeneratingResponse,
      setRegeneratingResponse,
      modelId,
      setModelId,
      knowledgeBaseIds,
      setKnowledgeBaseIds,
      documentIds,
      setDocumentIds,
      deepResearchEnabled,
      setDeepResearchEnabled,
      useGraphAccess,
      setUseGraph,
      selectedArtifact,
      setSelectedArtifact,
      hasUserSubmittedMessageInSession,
      setHasUserSubmittedMessageInSession,
      systemMessage,
      setSystemMessage,
      selectedText,
      setSelectedText,
      entryBeingEdited,
      setEntryBeingEdited,
      sourcesSidebarExpanded,
      setSourcesSidebarExpanded,
      allSourcesSelected,
      setAllSourcesSelected,
      isGeneratingGraph,
      setIsGeneratingGraph,
      showGraphTooltip,
      setShowGraphTooltip,
      graphedSourceIds,
      setGraphedSourceIds,
      graphingSourceIds,
      setGraphingSourceIds,
      removingGraphedSourceIds,
      setRemovingGraphedSourceIds,
      perDocSchemaOverrides,
      setPerDocSchemaOverrides,
      graphSelectedIds,
      setGraphSelectedIds,
      cancelledGraphIds,
      setCancelledGraphIds,
      uploadingDocuments,
      setUploadingDocuments,
      highlightedCitation,
      setHighlightedCitation,
      graphCitationPin,
      requestGraphCitationPin,
      showKnowledgeGraph,
      setShowKnowledgeGraph,
      selectedDocumentIds,
      documentNameMap,
      enumerationTabs,
      activeEnumerationTabId,
      removeTab,
      graphEntityIds,
      addToGraph,
      removeFromGraph,
      queryScope,
      graphCanvasSelectedEntityIds,
      graphDisplayedEntityIds,
      graphHistoryPanelOpen,
      selectedGraphSnapshotId,
      openGraphSnapshot,
      openGraphHistory,
      closeGraphHistory,
      activeEvidenceMessageId,
      restoreEvidence,
      scrollToMessageId,
      prefilledMessage,
      autoSubmitMessage,
      triggerAddSource,
      triggerEditSystemPrompt,
      showSystemEntry,
      hasUserInteracted,
      messageInputHasText,
      showArtifactsContainer,
      showAgentOnboarding,
      openAccordionItems,
    ]
  );

  return <ChatContext.Provider value={values}>{children}</ChatContext.Provider>;
};

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('An unexpected error occurred. Please try again later.');
  }

  return context;
}
