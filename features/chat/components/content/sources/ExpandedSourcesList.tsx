import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Checkbox, Stack, Text, Group, ThemeIcon, Badge, Tooltip, Loader, ActionIcon, Center, Avatar, HoverCard, Accordion, Select, MantineTheme } from '@mantine/core';
import { useRouter } from 'next/router';
import { IconX, IconCheck, IconUsers, IconCircleOff, IconNetwork, IconFolder, IconChevronRight, IconSparkles } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

import { getSourceConfig } from '@/features/chat/utils/chatHelperFunctions';
import { useChat } from '@/features/chat/providers/ChatProvider';
import { DocumentUploadStatus, IncomingSharedDocument } from '@/features/shared/types/document';
import { getTimeUntilExpiration } from '@/features/shared/utils/dateUtils';
import useGetUserKnowledgeBases from '@/features/shared/api/get-user-knowledge-bases';
import useGetUserPreselectedKnowledgeBases from '@/features/shared/api/get-user-preselected-knowledge-bases';
import useGetDocuments from '@/features/shared/api/document-upload/get-documents';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import { useGetGraphedDocuments } from '@/features/graph-database/api/get-graphed-documents';
import { useGetUserProvidedGraphDocuments } from '@/features/graph-database/api/get-user-provided-graph-documents';
import { schemaDisplayName } from '@/features/graph-database/config/schemas/registry';
import { suggestSchemaKey } from '@/features/graph-database/config/schemas/suggestSchemaKey';
import { useGetUserGraphDatabaseAccess } from '@/features/shared/api/get-user-graph-database-access';
import { useGetActiveGraphBuilds } from '@/features/graph-database/api/get-active-graph-builds';
import { useGetDocumentLibraryDataSharingEnabled } from '@/features/shared/api/document-upload/get-document-library-data-sharing-enabled';
import { GRAPH_SCHEMAS } from '@/features/graph-database/config/schemas/registry';
import useDeleteDocument from '@/features/shared/api/document-upload/delete-document';

const SCHEMA_SELECT_DATA = GRAPH_SCHEMAS.map((s) => ({ value: s.key, label: s.name }));
import useGetSharedDocuments from '@/features/shared/api/document-upload/get-shared-documents';
import { DocumentActionsMenu } from './DocumentActionsMenu';
import ShareAssetModal from '@/features/shared/components/modals/ShareAssetModal';
import DeleteSourceModal from '@/features/chat/components/modals/DeleteSourceModal';
import GraphingStatusPopover from './GraphingStatusPopover';
import { useShareDocument } from '@/features/shared/api/document-upload/share-document';
import { useUpdateDocumentShares } from '@/features/shared/api/document-upload/update-document-shares';
import useAcceptSharedDocument from '@/features/shared/api/document-upload/accept-shared-document';
import { useRejectSharedDocument } from '@/features/shared/api/document-upload/reject-shared-document';
import { useGetGraphCopyStatus } from '@/features/shared/api/document-upload/get-graph-copy-status';
import { trpc } from '@/libs';
import { ActiveGraphBuildClient } from '@/features/graph-database/dal/getActiveGraphBuilds';
import ManageDocumentCollectionsModal from '@/features/shared/components/document-library/modals/ManageDocumentCollectionsModal';
import useGetCollections from '@/features/shared/api/document-collections/use-get-collections';

// Prefix for the synthetic accordion item values of user-group folders, which are
// keyed by user group id rather than by DocumentCollection id.
const GROUP_FOLDER_PREFIX = 'admin-group-';
// Bucket for admin documents assigned to no user group (pushed to the user
// directly), so they still get foldered instead of falling back to the flat list.
const UNGROUPED_ADMIN_FOLDER_ID = 'admin-unassigned';
const ROW_RIGHT_INSET = 8;

// Shared by the user-group folder accordion and the collection folder accordion so
// the two sections read as one tree.
const FOLDER_ACCORDION_STYLES = (theme: MantineTheme) => ({
  control: {
    padding: `6px ${ROW_RIGHT_INSET}px 6px 4px`,
    minHeight: 'auto',
    borderRadius: theme.radius.sm,
    '&:hover': {
      backgroundColor: theme.colors.dark[7],
    },
  },
  chevron: {
    color: theme.colors.dark[3],
    marginRight: 8,
    '&[data-rotate]': {
      transform: 'rotate(90deg)',
    },
  },
  item: {
    borderBottom: 'none',
    marginBottom: 2,
    backgroundColor: 'transparent',
  },
  content: {
    padding: 0,
    paddingTop: 6,
  },
  label: {
    padding: 0,
    width: '100%',
  },
});

interface ExpandedSourcesListProps {
  onSourceClick?: (sourceId: string, sourceType: 'knowledge-base' | 'document') => void;
  graphingSourceIds?: string[];
  removingGraphedSourceIds?: string[];
}

export default function ExpandedSourcesList({ onSourceClick, graphingSourceIds = [], removingGraphedSourceIds = [] }: ExpandedSourcesListProps = {}) {
  const {
    knowledgeBaseIds,
    setKnowledgeBaseIds,
    documentIds,
    setDocumentIds,
    allSourcesSelected,
    setAllSourcesSelected,
    uploadingDocuments,
    setUploadingDocuments,
    openAccordionItems,
    setOpenAccordionItems,
    perDocSchemaOverrides,
    setPerDocSchemaOverrides,
    graphSelectedIds,
    setGraphSelectedIds,
  } = useChat();

  const router = useRouter();
  const utils = trpc.useUtils();
  const hasInitializedFromQuery = useRef(false);
  const previousDocumentStatusesRef = useRef<Map<string, DocumentUploadStatus>>(new Map());

  const [hoveredSourceId, setHoveredSourceId] = useState<string | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareDocumentData, setShareDocumentData] = useState<{
    id: string;
    label: string;
    isReshare: boolean;
    currentSharedGroupIds?: string[];
  } | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteDocumentData, setDeleteDocumentData] = useState<{id: string, label: string} | null>(null);
  const [manageCollectionsModalOpen, setManageCollectionsModalOpen] = useState(false);
  const [manageCollectionsDocumentData, setManageCollectionsDocumentData] = useState<{
    id: string;
    filename: string;
    collectionIds: string[];
  } | null>(null);

  // Track graph copy jobs for polling
  const [graphCopyJobId, setGraphCopyJobId] = useState<string | null>(null);
  const graphCopyJobCompletedRef = useRef(false);

  // Track documents being imported optimistically (to avoid UI flash)
  const [optimisticImportingDocs, setOptimisticImportingDocs] = useState<Set<string>>(new Set());

  const {
    data: userKnowledgeBases,
    isPending: userKnowledgeBasesIsPending,
  } = useGetUserKnowledgeBases();

  const {
    data: preselectedKnowledgeBases,
    isPending: preselectedKnowledgeBasesIsPending,
  } = useGetUserPreselectedKnowledgeBases();

  const {
    data: systemConfig,
    isPending: systemConfigIsLoading,
  } = useGetSystemConfig();

  const { data: userGraphDatabaseAccess } = useGetUserGraphDatabaseAccess();
  const { data: documentLibraryDataSharingEnabled } = useGetDocumentLibraryDataSharingEnabled();
  const { data: collectionsData } = useGetCollections();

  const {
    mutateAsync: deleteDocument,
    isPending: deleteDocumentIsPending,
    error: deleteDocumentError,
  } = useDeleteDocument();

  const shareDocumentMutation = useShareDocument();
  const updateDocumentSharesMutation = useUpdateDocumentShares();

  const {
    mutateAsync: acceptSharedDocument,
    isPending: acceptSharedDocumentIsPending,
  } = useAcceptSharedDocument();

  const {
    mutateAsync: rejectSharedDocument,
    isPending: rejectSharedDocumentIsPending,
  } = useRejectSharedDocument();

  // Poll for graph copy job status if we have a jobId
  const { data: graphCopyStatus } = useGetGraphCopyStatus(graphCopyJobId);

  const documentUploadProviderId = systemConfig?.documentLibraryDocumentUploadProviderId || '';

  const {
    data: userDocuments,
    isPending: userDocumentsIsPending,
  } = useGetDocuments({
    documentUploadProviderId,
  });

  // Get shared documents data
  const {
    data: sharedDocuments,
    isPending: sharedDocumentsIsPending,
  } = useGetSharedDocuments();

  // Get documents that have been graphed from the database
  const { data: graphedDocumentsData, isLoading: graphedDocumentsLoading } = useGetGraphedDocuments();

  // Get active graph builds
  const { data: activeGraphBuilds } = useGetActiveGraphBuilds();

  // Documents that will be ingested as user-provided graphs (no extraction schema)
  const { data: userProvidedData } = useGetUserProvidedGraphDocuments();
  const userProvidedIds = useMemo(
    () => new Set(userProvidedData?.userProvidedDocumentIds ?? []),
    [userProvidedData],
  );

  const graphStagedSet = useMemo(() => new Set(graphSelectedIds), [graphSelectedIds]);

  // Stage / unstage a document for graphing (independent of the chat checkbox).
  const toggleGraphStaged = (id: string) => {
    setGraphSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Stage / unstage every eligible document in a folder at once.
  const setFolderStaged = (ids: string[], staged: boolean) => {
    setGraphSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (staged ? next.add(id) : next.delete(id)));
      return Array.from(next);
    });
  };

  // Apply schema override for a single document. If the new schema matches the
  // AI suggestion, clear the override (revert to sparkle).
  const applyDocumentSchema = (documentId: string, schemaKey: string, suggestionKey: string) => {
    setPerDocSchemaOverrides((prev) => {
      const next = { ...prev };
      if (schemaKey === suggestionKey) {
        delete next[documentId];
      } else {
        next[documentId] = schemaKey;
      }
      return next;
    });
  };

  // Handle graph copy job completion
  useEffect(() => {
    if (!graphCopyStatus || graphCopyJobCompletedRef.current) {
      return;
    }

    if (graphCopyStatus.status === 'completed') {
      graphCopyJobCompletedRef.current = true;
      setGraphCopyJobId(null);

      // Clear optimistic importing state
      if (graphCopyStatus.results?.targetDocumentId) {
        setOptimisticImportingDocs(prev => {
          const next = new Set(prev);
          next.delete(graphCopyStatus.results!.targetDocumentId);
          return next;
        });
      }

      // Show success notification
      if (graphCopyStatus.results?.graphCopied) {
        notifications.show({
          title: 'Graph Data Copied',
          message: `Knowledge graph data for "${graphCopyStatus.results.filename}" has been successfully copied.`,
          icon: <IconCheck />,
          variant: 'successful_operation',
          autoClose: true,
        });

        // Invalidate graphed documents query to update the UI
        utils.graph.getGraphedDocuments.invalidate();
      }
    } else if (graphCopyStatus.status === 'error') {
      graphCopyJobCompletedRef.current = true;
      setGraphCopyJobId(null);

      // Clear optimistic importing state
      if (graphCopyStatus.results?.targetDocumentId) {
        setOptimisticImportingDocs(prev => {
          const next = new Set(prev);
          next.delete(graphCopyStatus.results!.targetDocumentId);
          return next;
        });
      }

      // Show error notification
      notifications.show({
        title: 'Graph Copy Failed',
        message: graphCopyStatus.error || 'Failed to copy graph data',
        icon: <IconX />,
        variant: 'failed_operation',
        autoClose: false,
      });
    }
  }, [graphCopyStatus, utils]);

  // Create helper functions to check document sharing status
  const isDocumentShared = useMemo(() => {
    if (!sharedDocuments) {
      return () => false;
    }
    
    const sharedDocumentIds = new Set(
      sharedDocuments.outgoing.map(doc => doc.documentId)
    );
    
    return (documentId: string) => sharedDocumentIds.has(documentId);
  }, [sharedDocuments]);

  const isDocumentSharedWithMe = useMemo(() => {
    if (!sharedDocuments) {
      return () => false;
    }
    
    const incomingSharedDocumentIds = new Set(
      sharedDocuments.incoming.map(doc => doc.sourceDocumentId)
    );
    
    return (documentId: string) => incomingSharedDocumentIds.has(documentId);
  }, [sharedDocuments]);

  const getOutgoingSharedDocument = useMemo(() => {
    if (!sharedDocuments) {
      return () => null;
    }
    
    const outgoingDocsMap = new Map(
      sharedDocuments.outgoing.map(doc => [doc.documentId, doc])
    );
    
    return (documentId: string) => outgoingDocsMap.get(documentId) || null;
  }, [sharedDocuments]);

  const knowledgeBaseSources = useMemo(() => {
    if (!userKnowledgeBases?.userKnowledgeBases) {
      return [];
    }

    return userKnowledgeBases.userKnowledgeBases.map((kb) => ({
      id: kb.id,
      label: kb.label,
      type: 'knowledge-base' as const,
      group: kb.kbProviderLabel,
    }));
  }, [userKnowledgeBases]);

  const documentSources = useMemo(() => {
    if (!systemConfig?.documentLibraryDocumentUploadProviderId) {
      return [];
    }

    // Map documents from API, checking their upload status
    const apiDocs = (userDocuments?.documents || []).map((doc) => ({
      id: doc.id,
      label: doc.filename,
      type: 'document' as const,
      isPending: doc.uploadStatus !== DocumentUploadStatus.Completed,
      uploadStatus: doc.uploadStatus,
      isShared: isDocumentShared(doc.id),
      isSharedWithMe: isDocumentSharedWithMe(doc.id),
      adminCreated: doc.adminCreated,
      assignedGroupIds: doc.assignedGroupIds,
      assignedGroupLabels: doc.assignedGroupLabels,
      collections: doc.collections || [],
      documentType: doc.dataProfile?.type,
    }));

    // Add incoming shared documents that aren't in user's personal library
    const incomingSharedDocs = (sharedDocuments?.incoming || [])
      .filter(incomingDoc => !apiDocs.some(doc => doc.id === incomingDoc.sourceDocumentId))
      .map((incomingDoc) => ({
        id: incomingDoc.sourceDocumentId,
        label: incomingDoc.sourceFilename,
        type: 'document' as const,
        isPending: false,
        uploadStatus: DocumentUploadStatus.Completed,
        isShared: false,
        isSharedWithMe: true,
        adminCreated: false,
        assignedGroupIds: undefined,
        assignedGroupLabels: undefined,
        incomingShareData: incomingDoc,
      }));

    // Create a map of all document filenames (including incoming shared)
    const allDocFilenames = new Set([
      ...apiDocs.map(doc => doc.label),
      ...incomingSharedDocs.map(doc => doc.label),
    ]);

    // Add uploading documents that aren't already included
    const localOnlyDocs = uploadingDocuments
      .filter(doc => !allDocFilenames.has(doc.filename))
      .map((doc) => ({
        id: doc.id,
        label: doc.filename,
        type: 'document' as const,
        isPending: true,
        uploadStatus: doc.uploadStatus,
        isShared: false,
        isSharedWithMe: false,
        adminCreated: false,
        assignedGroupIds: undefined,
        assignedGroupLabels: undefined,
      }));

    return [...apiDocs, ...incomingSharedDocs, ...localOnlyDocs];
  }, [userDocuments, systemConfig, uploadingDocuments, isDocumentShared, isDocumentSharedWithMe, sharedDocuments]);

  const allSources = useMemo(() => {
    return [...knowledgeBaseSources, ...documentSources];
  }, [knowledgeBaseSources, documentSources]);

  // Admin-pushed documents are pulled out of the user's own collection folders and
  // the flat list entirely, so a group's shared library can't bury the handful of
  // documents the user actually uploaded.
  const adminDocumentSources = useMemo(
    () => documentSources.filter((doc) => 'adminCreated' in doc && doc.adminCreated),
    [documentSources],
  );

  const adminDocumentIdSet = useMemo(
    () => new Set(adminDocumentSources.map((doc) => doc.id)),
    [adminDocumentSources],
  );

  // Documents eligible for the user's own collection folders / flat list: everything
  // except the admin documents now rendered under user-group folders.
  const ownedDocumentSources = useMemo(
    () => documentSources.filter((doc) => !adminDocumentIdSet.has(doc.id)),
    [documentSources, adminDocumentIdSet],
  );

  // One folder per user group that has admin documents assigned. A document assigned
  // to several of the user's groups appears under each of them, mirroring how a
  // document in multiple collections already renders once per folder. Admin documents
  // with no group assignment collect in a single fallback folder.
  const adminDocumentsByGroup = useMemo(() => {
    if (adminDocumentSources.length === 0) {
      return [];
    }

    const groups = new Map<string, { groupId: string; groupName: string; documents: typeof documentSources }>();

    adminDocumentSources.forEach((doc) => {
      const groupIds = ('assignedGroupIds' in doc && doc.assignedGroupIds) || [];
      const groupLabels = ('assignedGroupLabels' in doc && doc.assignedGroupLabels) || [];

      if (groupIds.length === 0) {
        const fallback = groups.get(UNGROUPED_ADMIN_FOLDER_ID) ?? {
          groupId: UNGROUPED_ADMIN_FOLDER_ID,
          groupName: 'Shared with you',
          documents: [],
        };
        fallback.documents.push(doc);
        groups.set(UNGROUPED_ADMIN_FOLDER_ID, fallback);
        return;
      }

      groupIds.forEach((groupId, index) => {
        const existing = groups.get(groupId) ?? {
          groupId,
          // Labels are positionally paired with ids by the DAL; fall back to the id
          // so a missing label can never collapse two groups into one folder.
          groupName: groupLabels[index] ?? groupId,
          documents: [],
        };
        existing.documents.push(doc);
        groups.set(groupId, existing);
      });
    });

    // Named groups alphabetically, with the unassigned fallback pinned last.
    return Array.from(groups.values()).sort((a, b) => {
      if (a.groupId === UNGROUPED_ADMIN_FOLDER_ID) {
        return 1;
      }
      if (b.groupId === UNGROUPED_ADMIN_FOLDER_ID) {
        return -1;
      }
      return a.groupName.localeCompare(b.groupName);
    });
  }, [adminDocumentSources]);

  // Group documents by collection for folder structure
  const documentsByCollection = useMemo(() => {
    const collections = collectionsData?.collections || [];
    const grouped: {
      collectionId: string;
      collectionName: string;
      collectionColor: string | null;
      documents: typeof documentSources;
    }[] = [];

    // Add each collection as a group
    collections.forEach((collection) => {
      const docsInCollection = ownedDocumentSources.filter((doc) => {
        if (!('collections' in doc)) {
          return false;
        }
        return doc.collections?.some((c) => c.id === collection.id);
      });

      if (docsInCollection.length > 0) {
        grouped.push({
          collectionId: collection.id,
          collectionName: collection.name,
          collectionColor: collection.color,
          documents: docsInCollection,
        });
      }
    });

    return grouped;
  }, [ownedDocumentSources, collectionsData]);

  const documentsNotInCollections = useMemo(() => {
    return ownedDocumentSources.filter((doc) => {
      if (!('collections' in doc)) {
        return true;
      }
      return !doc.collections || doc.collections.length === 0;
    });
  }, [ownedDocumentSources]);

  // Cleanup: Remove documents from uploadingDocuments once they are completed
  useEffect(() => {
    if (!userDocuments?.documents || uploadingDocuments.length === 0) {
      return;
    }

    // Create a set of completed document filenames
    const completedFilenames = new Set(
      userDocuments.documents.map((doc) => doc.filename)
    );

    // Filter out uploading documents that are now completed
    const stillUploading = uploadingDocuments.filter(
      (uploadingDoc) => !completedFilenames.has(uploadingDoc.filename)
    );

    if (stillUploading.length !== uploadingDocuments.length) {
      setUploadingDocuments(stillUploading);
    }
  }, [userDocuments, uploadingDocuments, setUploadingDocuments]);

  // Auto-select documents when they complete uploading
  useEffect(() => {
    if (!userDocuments?.documents) {
      return;
    }

    const newlyCompletedDocIds: string[] = [];

    // Check each document for status changes
    userDocuments.documents.forEach((doc) => {
      const previousStatus = previousDocumentStatusesRef.current.get(doc.id);

      // If document was previously pending and is now completed, auto-select it
      if (
        previousStatus === DocumentUploadStatus.Pending &&
        doc.uploadStatus === DocumentUploadStatus.Completed
      ) {
        newlyCompletedDocIds.push(doc.id);
      }

      // Update the status map
      previousDocumentStatusesRef.current.set(doc.id, doc.uploadStatus);
    });

    // Auto-select newly completed documents
    if (newlyCompletedDocIds.length > 0) {
      // Only add documents that aren't already selected
      const uniqueNewIds = newlyCompletedDocIds.filter((id) => !documentIds.includes(id));
      if (uniqueNewIds.length > 0) {
        const updatedDocumentIds = [...documentIds, ...uniqueNewIds];
        setDocumentIds(updatedDocumentIds);

        // Update allSourcesSelected if needed
        const allSourceIds = allSources.map(source => source.id);
        const updatedSelectedIds = [...knowledgeBaseIds, ...updatedDocumentIds];
        const allSelected = allSourceIds.length > 0 && allSourceIds.every(id => updatedSelectedIds.includes(id));
        if (allSelected !== allSourcesSelected) {
          setAllSourcesSelected(allSelected);
        }
      }
    }
  }, [userDocuments, documentIds, knowledgeBaseIds, allSources, allSourcesSelected, setDocumentIds, setAllSourcesSelected]);

  const allSelectedIds = useMemo(() => {
    return [...knowledgeBaseIds, ...documentIds];
  }, [knowledgeBaseIds, documentIds]);

  // Use the explicit allSourcesSelected state instead of computing it
  const selectAllChecked = allSourcesSelected;

  // Validate and refine selections from ChatProvider state, and handle preselection fallbacks
  useEffect(() => {
    if (router.isReady && !hasInitializedFromQuery.current && (knowledgeBaseSources.length > 0 || documentSources.length > 0)) {
      let finalKnowledgeBaseIds = knowledgeBaseIds;
      let finalDocumentIds = documentIds;
      
      // Check if we have existing selections from ChatProvider (possibly from query string)
      const hasExistingSelections = knowledgeBaseIds.length > 0 || documentIds.length > 0;
      
      if (hasExistingSelections) {
        // Validate the existing selections against available sources and filter out invalid ones
        const validKnowledgeBaseIds = knowledgeBaseIds.filter(id => 
          knowledgeBaseSources.some(kb => kb.id === id)
        );
        const validDocumentIds = documentIds.filter(id => 
          documentSources.some(doc => doc.id === id)
        );
        
        // Update the ChatProvider state with only valid IDs
        if (validKnowledgeBaseIds.length !== knowledgeBaseIds.length) {
          setKnowledgeBaseIds(validKnowledgeBaseIds);
          finalKnowledgeBaseIds = validKnowledgeBaseIds;
        }
        if (validDocumentIds.length !== documentIds.length) {
          setDocumentIds(validDocumentIds);
          finalDocumentIds = validDocumentIds;
        }
      } else if (preselectedKnowledgeBases?.userPreselectedKnowledgeBases) {
        // Only use preselected knowledge bases if no existing selections
        const preselectedIds = preselectedKnowledgeBases.userPreselectedKnowledgeBases.map(kb => kb.id);
        setKnowledgeBaseIds(preselectedIds);
        finalKnowledgeBaseIds = preselectedIds;
      }
      
      // Set the allSourcesSelected state based on current selections
      const allSourceIds = [...knowledgeBaseSources.map(kb => kb.id), ...documentSources.map(doc => doc.id)];
      const finalSelectedIds = [...finalKnowledgeBaseIds, ...finalDocumentIds];
      const shouldMarkAllSelected = allSourceIds.length > 0 && allSourceIds.every(id => finalSelectedIds.includes(id));
      setAllSourcesSelected(shouldMarkAllSelected);
      
      hasInitializedFromQuery.current = true;
    }
  }, [router.isReady, knowledgeBaseSources, documentSources, preselectedKnowledgeBases, knowledgeBaseIds, documentIds, setKnowledgeBaseIds, setDocumentIds, setAllSourcesSelected]);

  const handleSelectAll = (checked: boolean) => {
    setAllSourcesSelected(checked);

    if (checked) {
      // Select all sources
      const allKnowledgeBaseIds = knowledgeBaseSources.map(kb => kb.id);
      const allDocumentIds = documentSources.map(doc => doc.id);

      setKnowledgeBaseIds(allKnowledgeBaseIds);
      setDocumentIds(allDocumentIds);
    } else {
      // Deselect all sources
      setKnowledgeBaseIds([]);
      setDocumentIds([]);
    }
  };

  // Select / deselect an arbitrary set of documents as one unit (a collection folder
  // or a user-group folder), then reconcile the all-sources checkbox.
  const handleSelectDocumentGroup = (groupDocIds: string[], checked: boolean) => {
    const newDocumentIds = checked
      ? Array.from(new Set([...documentIds, ...groupDocIds]))
      : documentIds.filter((id) => !groupDocIds.includes(id));

    setDocumentIds(newDocumentIds);

    const allSourceIds = allSources.map((source) => source.id);
    const newAllSelectedIds = [...knowledgeBaseIds, ...newDocumentIds];
    const allSelected = allSourceIds.length > 0 && allSourceIds.every((id) => newAllSelectedIds.includes(id));
    setAllSourcesSelected(allSelected);
  };

  const handleSelectCollection = (collectionId: string, checked: boolean) => {
    // Find all documents in this collection
    const collectionGroup = documentsByCollection.find((g) => g.collectionId === collectionId);
    if (!collectionGroup) {
      return;
    }

    handleSelectDocumentGroup(collectionGroup.documents.map((doc) => doc.id), checked);
  };

  const handleSourceToggle = (sourceId: string, sourceType: 'knowledge-base' | 'document') => {
    let newKnowledgeBaseIds = knowledgeBaseIds;
    let newDocumentIds = documentIds;
    
    if (sourceType === 'knowledge-base') {
      newKnowledgeBaseIds = knowledgeBaseIds.includes(sourceId)
        ? knowledgeBaseIds.filter(id => id !== sourceId)
        : [...knowledgeBaseIds, sourceId];
      setKnowledgeBaseIds(newKnowledgeBaseIds);
    } else {
      newDocumentIds = documentIds.includes(sourceId)
        ? documentIds.filter(id => id !== sourceId)
        : [...documentIds, sourceId];
      setDocumentIds(newDocumentIds);
    }
    
    // Update allSourcesSelected based on whether all sources are now selected
    const allSourceIds = allSources.map(source => source.id);
    const newAllSelectedIds = [...newKnowledgeBaseIds, ...newDocumentIds];
    const allSelected = allSourceIds.length > 0 && allSourceIds.every(id => newAllSelectedIds.includes(id));
    setAllSourcesSelected(allSelected);
  };

  const handleDeleteFailedDocument = async (documentId: string) => {
    // If it's a temp ID, just remove from local state
    if (documentId.startsWith('temporary-')) {
      setUploadingDocuments((prev) => prev.filter((doc) => doc.id !== documentId));
      return;
    }

    // Only call API for real document IDs
    try {
      await deleteDocument({ documentId });
      // Remove from local state
      setUploadingDocuments((prev) => prev.filter((doc) => doc.id !== documentId));
    } catch (error) {
      notifications.show({
        title: 'Failed to Delete Document',
        message: deleteDocumentError?.message ?? 'There was a problem deleting the document',
        icon: <IconX />,
        autoClose: false,
        variant: 'failed_operation',
      });
    }
  };

  const handleShareClick = (sourceId: string, sourceLabel: string, event?: React.MouseEvent) => {
    event?.stopPropagation();
    const existingShare = sharedDocuments?.outgoing?.find((s) => s.documentId === sourceId);
    setShareDocumentData({
      id: sourceId,
      label: sourceLabel,
      isReshare: !!existingShare,
      currentSharedGroupIds: existingShare?.sharedWithUserGroupIds || [],
    });
    setShareModalOpen(true);
    setHoveredSourceId(null);
  };

  const handleDeleteClick = (sourceId: string, sourceLabel: string) => {
    setHoveredSourceId(null);
    setDeleteDocumentData({ id: sourceId, label: sourceLabel });
    setDeleteModalOpen(true);
  };

  const handleManageCollectionsClick = (sourceId: string, sourceLabel: string, collections: Array<{id: string, name: string, color: string | null}>) => {
    setHoveredSourceId(null);
    setManageCollectionsDocumentData({
      id: sourceId,
      filename: sourceLabel,
      collectionIds: collections.map((c) => c.id),
    });
    setManageCollectionsModalOpen(true);
  };

  const handleDeleteSuccess = () => {
    if (!deleteDocumentData) {
      return;
    }

    // Remove from selected documents if it was selected
    if (documentIds.includes(deleteDocumentData.id)) {
      const updatedDocumentIds = documentIds.filter(id => id !== deleteDocumentData.id);
      setDocumentIds(updatedDocumentIds);
      
      // Update allSourcesSelected if needed
      const allSourceIds = allSources.map(source => source.id);
      const updatedSelectedIds = [...knowledgeBaseIds, ...updatedDocumentIds];
      const allSelected = allSourceIds.length > 0 && allSourceIds.every(id => updatedSelectedIds.includes(id));
      setAllSourcesSelected(allSelected);
    }
  };

  const handleConfirmShare = (selectedGroupIds: string[]) => {
    if (!shareDocumentData) {
      return;
    }

    const mutation = shareDocumentData.isReshare
      ? updateDocumentSharesMutation
      : shareDocumentMutation;

    mutation.mutate(
      { documentId: shareDocumentData.id, userGroupIds: selectedGroupIds },
      {
        onSuccess: () => {
          notifications.show({
            title: shareDocumentData.isReshare ? 'Document shares updated' : 'Document shared',
            message: `"${shareDocumentData.label}" has been ${shareDocumentData.isReshare ? 'updated' : 'shared'} with selected user group(s)`,
            icon: <IconCheck />,
            autoClose: true,
            variant: 'successful_operation',
          });
        },
        onError: (error) => {
          notifications.show({
            title: 'Failed to share document',
            message: error.message,
            icon: <IconX />,
            autoClose: true,
            variant: 'failed_operation',
          });
        },
      },
    );
  };

  const handleAcceptSharedDocument = async (sharedDocumentId: string) => {
    try {
      const result = await acceptSharedDocument({ sharedDocumentId });

      // If there's a graph copy job, start polling for it
      if (result.graphCopyJobId && result.action.copiedDocumentId) {
        graphCopyJobCompletedRef.current = false;
        setGraphCopyJobId(result.graphCopyJobId);

        // Optimistically mark document as importing FIRST to avoid UI flash
        setOptimisticImportingDocs(prev => new Set([...prev, result.action.copiedDocumentId!]));

        // Then invalidate queries so document appears with orange background already set
        utils.shared.getDocuments.invalidate();
        utils.graph.getGraphedDocuments.invalidate();
        utils.graph.getActiveGraphBuilds.invalidate();
      }
    } catch (error) {
      notifications.show({
        title: 'Failed to Import Document',
        message: (error as Error)?.message ?? 'There was a problem importing the shared document',
        icon: <IconX />,
        autoClose: false,
        variant: 'failed_operation',
      });
    }
  };

  const handleRejectSharedDocument = async (sharedDocumentId: string) => {
    try {
      await rejectSharedDocument({ sharedDocumentId });
    } catch (error) {
      notifications.show({
        title: 'Failed to Reject Document',
        message: (error as Error)?.message ?? 'There was a problem rejecting the shared document',
        icon: <IconX />,
        autoClose: true,
        variant: 'failed_operation',
      });
    }
  };

  // Helper to get graph build info for a document
  const getGraphBuildInfo = (documentId: string): ActiveGraphBuildClient | null | undefined => {
    if (!activeGraphBuilds) {
      return null;
    }
    // Check if document is being actively processed. Use newDocumentIds (the
    // job's processing subset) so previously-graphed docs in an incremental
    // build's union don't show the graphing spinner; fall back to the full
    // documentIds union when newDocumentIds is absent (degrade-safe).
    return activeGraphBuilds.find(build => {
      return (build.newDocumentIds ?? build.documentIds).includes(documentId);
    });
  };

  // Don't treat documents as pending if there's no upload provider configured
  const documentsActuallyPending = documentUploadProviderId ? userDocumentsIsPending : false;

  // Document IDs in a group that can be staged/built (not graphed, graphing,
  // ungraphable, pending, or shared-with-me). Drives the folder graph badge.
  const getStageableIds = (sources: typeof allSources): string[] =>
    sources
      .filter((s) =>
        s.type === 'document' &&
        (userGraphDatabaseAccess?.hasAccess ?? false) &&
        !(graphedDocumentsData?.documentIds?.includes(s.id) ?? false) &&
        !(graphedDocumentsData?.ungraphableDocumentIds?.includes(s.id) ?? false) &&
        !graphingSourceIds.includes(s.id) &&
        !getGraphBuildInfo(s.id) &&
        !('isPending' in s && s.isPending) &&
        !('isSharedWithMe' in s && s.isSharedWithMe))
      .map((s) => s.id);

  // Documents in a group currently being built into the graph.
  const getGraphingIds = (sources: typeof allSources): string[] =>
    sources
      .filter((s) =>
        s.type === 'document' &&
        (userGraphDatabaseAccess?.hasAccess ?? false) &&
        (graphingSourceIds.includes(s.id) || !!getGraphBuildInfo(s.id)))
      .map((s) => s.id);

  // Documents in a group that are already in the graph.
  const getGraphedIds = (sources: typeof allSources): string[] =>
    sources
      .filter((s) =>
        s.type === 'document' &&
        (userGraphDatabaseAccess?.hasAccess ?? false) &&
        (graphedDocumentsData?.documentIds?.includes(s.id) ?? false) &&
        !(graphedDocumentsData?.ungraphableDocumentIds?.includes(s.id) ?? false))
      .map((s) => s.id);

  // Group-level graph badge (folder + all-sources). Mirrors the per-row badge's
  // lifecycle so a folder reflects what's happening inside it:
  //   graphing (any doc building) → staging ring (docs left to stage) → graphed
  //   (everything eligible is in the graph). Renders nothing when the group has
  //   no graph-relevant documents.
  const renderGroupGraphBadge = (sources: typeof allSources, testId: string) => {
    const stageableIds = getStageableIds(sources);
    const graphingCount = getGraphingIds(sources).length;
    const graphedIds = getGraphedIds(sources);

    if (graphingCount === 0 && stageableIds.length === 0 && graphedIds.length === 0) {
      return null;
    }

    let badge: React.ReactNode;

    // Graphing badge only when the ENTIRE group is building — nothing already
    // graphed and nothing left to stage. An aggregate like "All sources" must
    // not read as "graphing" just because one doc inside it is.
    if (graphingCount > 0 && stageableIds.length === 0 && graphedIds.length === 0) {
      const isCancellingGroup = activeGraphBuilds?.some((b) => b.status === 'Cancelling') ?? false;
      badge = (
        <HoverCard shadow='md' withArrow position='top' withinPortal>
          <HoverCard.Target>
            <Avatar
              color={isCancellingGroup ? 'red.9' : 'orange.9'}
              bg={isCancellingGroup ? 'red.1' : 'orange.1'}
              radius='xl'
              size={24}
              style={{ cursor: 'default' }}
              data-testid={`${testId}-graphing`}
            >
              <Loader size={12} color={isCancellingGroup ? 'red' : 'orange'} />
            </Avatar>
          </HoverCard.Target>
          <HoverCard.Dropdown>
            <Text size='sm'>{isCancellingGroup ? 'Cancelling — undoing this graph update...' : 'Graphing...'}</Text>
          </HoverCard.Dropdown>
        </HoverCard>
      );
    } else if (stageableIds.length > 0) {
      const allStaged = stageableIds.every((id) => graphStagedSet.has(id));
      badge = (
        <HoverCard shadow='md' withArrow position='top' withinPortal>
          <HoverCard.Target>
            <Avatar
              color={allStaged ? 'yellow.9' : 'gray.5'}
              bg={allStaged ? 'yellow.2' : 'transparent'}
              radius='xl'
              size={24}
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                setFolderStaged(stageableIds, !allStaged);
              }}
              sx={(theme) => ({
                cursor: 'pointer',
                // Filled only when ALL eligible docs are staged; otherwise an empty ring.
                border: allStaged ? undefined : `1px dashed ${theme.colors.gray[6]}`,
              })}
              data-testid={testId}
            >
              <IconNetwork size={12} />
            </Avatar>
          </HoverCard.Target>
          <HoverCard.Dropdown>
            <Text size='sm'>{allStaged ? 'Unstage from graph' : 'Stage to graph'}</Text>
          </HoverCard.Dropdown>
        </HoverCard>
      );
    } else {
      // Everything eligible is graphed. Summarize the graphed docs' schemas the
      // same way the build-settings table does: a single shared schema shows its
      // name; differing schemas show "Mixed".
      const schemaNames = new Set(
        graphedIds.map((id) => {
          if (userProvidedIds.has(id)) {
            return 'User-provided';
          }
          const key = graphedDocumentsData?.documentSchemas?.[id];
          return key ? schemaDisplayName(key) : '—';
        }),
      );
      const schemaLabel = schemaNames.size === 1 ? Array.from(schemaNames)[0] : 'Mixed';
      badge = (
        <HoverCard shadow='md' withArrow position='top' withinPortal>
          <HoverCard.Target>
            <Avatar
              color='blue.9'
              bg='blue.1'
              radius='xl'
              size={24}
              style={{ cursor: 'default' }}
              data-testid={`${testId}-graphed`}
            >
              <IconNetwork size={12} />
            </Avatar>
          </HoverCard.Target>
          <HoverCard.Dropdown>
            <Text size='sm'>Graphed</Text>
            <Text size='xs' color='dimmed'>Schema: {schemaLabel}</Text>
          </HoverCard.Dropdown>
        </HoverCard>
      );
    }

    // Wrap in Avatar.Group so the group badge gets the same inset border/sizing
    // as the per-row badges (which live inside an Avatar.Group).
    return <Avatar.Group spacing='xs'>{badge}</Avatar.Group>;
  };

  // Helper function to render a single source item (to avoid duplication)
  const renderSourceItem = (source: typeof allSources[0]) => {
    // Check if this is a pending/uploading source
    const isPending = 'isPending' in source && source.isPending;
    const isFailed = isPending && source.uploadStatus === DocumentUploadStatus.Failed;

    // Calculate source states
    const isSelected = allSelectedIds.includes(source.id);
    const hasGraphAccess = userGraphDatabaseAccess?.hasAccess ?? false;
    const graphDataReady = !graphedDocumentsLoading && graphedDocumentsData;
    // Check if document is part of an active build (either being processed or already in the graph being updated)
    // Priority: activeGraphBuilds (database) > graphingSourceIds (context state)
    // When activeGraphBuilds is loading, graphingSourceIds acts as temporary state to prevent badge flash
    const buildInfo = getGraphBuildInfo(source.id);
    const isCancellingBuild = buildInfo?.status === 'Cancelling';
    const isGraphing = hasGraphAccess && (
      !!buildInfo || graphingSourceIds.includes(source.id)
    );
    const isImporting = hasGraphAccess && optimisticImportingDocs.has(source.id);
    const isRemoving = hasGraphAccess && removingGraphedSourceIds.includes(source.id);
    // Only consider ungraphable if not currently being graphed
    const isUngraphable = !isGraphing && hasGraphAccess && graphDataReady &&
      (graphedDocumentsData?.ungraphableDocumentIds?.includes(source.id) ?? false);
    const isGraphed = hasGraphAccess && graphDataReady && !isUngraphable &&
      (graphedDocumentsData?.documentIds?.includes(source.id) ?? false);
    // User-provided graphs (native palm-graph JSON) carry no extraction schema;
    // label them as such. Otherwise show the recorded extraction schema name.
    const isUserProvided = userProvidedIds.has(source.id);
    const graphedSchemaKey = graphedDocumentsData?.documentSchemas?.[source.id];
    const graphedSchemaName = isUserProvided
      ? 'User-provided'
      : (graphedSchemaKey ? schemaDisplayName(graphedSchemaKey) : undefined);

    // Check if this document is shared with me (incoming shared document)
    const isIncomingSharedDoc = 'isSharedWithMe' in source && source.isSharedWithMe;
    const isMySharedDoc = 'isShared' in source && source.isShared && !isIncomingSharedDoc;
    // Graph staging (independent of the chat checkbox): the circle badge toggles this.
    const isStaged = graphStagedSet.has(source.id);
    const docType = ('documentType' in source ? source.documentType : null) as string | null | undefined;
    // A document that can be staged/built (not graphed, graphing, ungraphable, or pending).
    const isGraphEligible = source.type === 'document' && hasGraphAccess && !!graphDataReady
      && !isGraphed && !isGraphing && !isUngraphable && !isPending && !isIncomingSharedDoc
      && !isRemoving && !isImporting;
    const truncatedLabel = source.label.length > 55
      ? `${source.label.slice(0, 53)}...`
      : source.label;

    // Determine badge display for pending sources
    const pendingBadgeColor = isFailed ? 'red' : 'yellow';
    const pendingBadgeText = isFailed ? 'Failed' : 'Pending';

    const groupElement = (
      <Group
        key={source.id}
        position='apart'
        py={6}
        pl={8}
        pr={ROW_RIGHT_INSET}
        onMouseEnter={() => {
          // Don't show hover menu for incoming shared documents that need approval, failed uploads, pending uploads, or importing documents
          if (!isIncomingSharedDoc && !isFailed && !isPending && !isGraphing) {
            setHoveredSourceId(source.id);
          }
        }}
        onMouseLeave={() => setHoveredSourceId(null)}
        sx={(theme) => ({
          borderRadius: theme.radius.sm,
          cursor: isIncomingSharedDoc || isFailed || isPending || isGraphing || isImporting ? 'default' : 'pointer',
          backgroundColor: isImporting
            ? 'rgba(255, 165, 0, 0.15)' // orange background for importing documents
            : isIncomingSharedDoc
            ? theme.colors.gray[9] // incoming shared documents awaiting approval
            : 'transparent',
          borderLeft: isPending
            ? `3px solid ${isFailed ? theme.colors.red[6] : theme.colors.yellow[6]}`
            : isFailed
            ? `1px solid ${theme.colors.red[7]}`
            : 'none',
          border: isFailed ? `1px solid ${theme.colors.red[6]}` : 'none',
          position: 'relative',
          '&:hover': {
            backgroundColor: isFailed
              ? 'transparent'
              : isPending
              ? 'transparent'
              : isImporting
              ? 'rgba(255, 165, 0, 0.25)' // darker orange on hover for importing documents
              : isIncomingSharedDoc
              ? theme.colors.gray[8] // hover for incoming shared docs
              : theme.colors.dark[6],
            border: isFailed
              ? `1px solid ${theme.colors.red[6]}`
              : undefined,
          },
        })}
        onClick={() => {
          // Don't allow clicking on incoming shared documents that need approval, failed uploads, or documents being processed
          if (isIncomingSharedDoc || isFailed || isGraphing || isImporting) {
            return;
          }
          if (!isPending) {
            onSourceClick?.(source.id, source.type);
          }
        }}
      >
        {(() => {
          const { color, icon: Icon } = getSourceConfig(source);
          const displayColor = isPending || isIncomingSharedDoc ? 'gray' : color;

          return (
            <>
              <Group spacing={8} style={{
                flex: 1,
                minWidth: 0,
              }}>
                <div style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {hoveredSourceId === source.id ? (
                    <DocumentActionsMenu
                      sourceId={source.id}
                      sourceLabel={source.label}
                      onShareClick={(event) => {
                        handleShareClick(source.id, source.label, event);
                      }}
                      onReshareClick={(event) => {
                        handleShareClick(source.id, source.label, event);
                      }}
                      onDeleteClick={(event) => {
                        event?.stopPropagation();
                        handleDeleteClick(source.id, source.label);
                      }}
                      onManageCollectionsClick={
                        source.type === 'document' && 'collections' in source
                          ? (event) => {
                              event?.stopPropagation();
                              handleManageCollectionsClick(source.id, source.label, source.collections || []);
                            }
                          : undefined
                      }
                      isShared={isMySharedDoc}
                      isGraphing={isGraphing || isImporting}
                      documentSharingEnabled={documentLibraryDataSharingEnabled?.enabled === true}
                      isAdminDocument={source.type === 'document' && source.adminCreated === true}
                    />
                  ) : (
                    <ThemeIcon size='sm' c={displayColor} style={{ pointerEvents: 'none' }}>
                      <Icon stroke={2} />
                    </ThemeIcon>
                  )}
                </div>
                <Box style={{ minWidth: 0, flex: 1 }}>
                  <Stack spacing={4}>
                    <Group spacing='xs' style={{ flexWrap: 'nowrap', alignItems: 'center' }}>
                      <Text
                        size='sm'
                        color='gray.2'
                        fw='bold'
                        style={{
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {truncatedLabel}
                      </Text>
                    {isPending && (
                      <Badge
                        size='xs'
                        color={pendingBadgeColor}
                        variant='light'
                        style={{ flexShrink: 0 }}
                      >
                        {pendingBadgeText}
                      </Badge>
                    )}
                    {!isPending && isRemoving && (
                      <Badge
                        size='xs'
                        color='yellow'
                        variant='light'
                        style={{ flexShrink: 0 }}
                      >
                        Removing source...
                      </Badge>
                    )}
                    {!isPending && !isRemoving && isImporting && (
                      <Badge
                        size='xs'
                        color='orange'
                        variant='light'
                        style={{ flexShrink: 0 }}
                      >
                        Importing...
                      </Badge>
                    )}
                    </Group>
                    {source.type === 'knowledge-base' && source.group && (
                      <Text size='xs' color='gray.2'>
                        {source.group}
                      </Text>
                    )}
                  </Stack>
                </Box>
              </Group>

              <Group spacing='xs' style={{ flexShrink: 0 }}>
                {!isPending && !isRemoving && !isImporting && (
                  <Avatar.Group spacing='xs'>
                    {/* Admin/shared badges render first so they sit to the LEFT of
                        (and behind) the graph-status badge, keeping the graph icon
                        in a fixed column next to the checkbox across every row. */}
                    {source.type === 'document' && source.adminCreated === true && (
                      <HoverCard shadow='md' withArrow position='top' withinPortal>
                        <HoverCard.Target>
                          <Avatar
                            color='violet.9'
                            bg='violet.1'
                            radius='xl'
                            size={24}
                            style={{ cursor: 'pointer' }}
                          >
                            <IconUsers size={12} />
                          </Avatar>
                        </HoverCard.Target>
                        <HoverCard.Dropdown>
                          <Text size='sm'>
                            {source.assignedGroupLabels && source.assignedGroupLabels.length > 0
                              ? `This resource has been shared with group(s) you belong to: ${source.assignedGroupLabels.join(', ')}`
                              : 'This resource has been shared with group(s) you belong to'}
                          </Text>
                        </HoverCard.Dropdown>
                      </HoverCard>
                    )}
                    {!isPending && isMySharedDoc && (() => {
                      const outgoingDoc = getOutgoingSharedDocument(source.id);
                      if (!outgoingDoc) {
                        return (
                          <HoverCard key='shared' shadow='md' withArrow position='top' withinPortal>
                            <HoverCard.Target>
                              <Avatar
                                color='green.9'
                                bg='green.1'
                                radius='xl'
                                size={24}
                                style={{ cursor: 'pointer' }}
                                data-testid={`shared-document-badge-${source.id}`}
                              >
                                <IconUsers size={12} />
                              </Avatar>
                            </HoverCard.Target>
                            <HoverCard.Dropdown>
                              <Text size='sm'>Shared</Text>
                            </HoverCard.Dropdown>
                          </HoverCard>
                        );
                      }

                      const { timeRemainingText, isExpired } = getTimeUntilExpiration(new Date(outgoingDoc.createdAt));
                      const tooltipText = isExpired
                        ? 'This shared document invitation has expired'
                        : `This document share expires in ${timeRemainingText}`;

                      return (
                        <HoverCard key='shared' shadow='md' withArrow position='top' withinPortal>
                          <HoverCard.Target>
                            <Avatar
                              color={isExpired ? 'red.9' : 'dark.6'}
                              bg={isExpired ? 'red.1' : 'green.3'}
                              radius='xl'
                              size={24}
                              style={{ cursor: 'pointer' }}
                              data-testid={`shared-document-badge-${source.id}`}
                            >
                              <IconUsers size={12} />
                            </Avatar>
                          </HoverCard.Target>
                          <HoverCard.Dropdown>
                            <Text size='sm'>{tooltipText}</Text>
                          </HoverCard.Dropdown>
                        </HoverCard>
                      );
                    })()}
                    {isGraphing && (
                      <HoverCard shadow='md' withArrow position='top' withinPortal>
                        <HoverCard.Target>
                          <Avatar
                            color={isCancellingBuild ? 'red.9' : 'orange.9'}
                            bg={isCancellingBuild ? 'red.1' : 'orange.1'}
                            radius='xl'
                            size={24}
                            style={{ cursor: 'pointer' }}
                            data-testid={isCancellingBuild ? `cancelling-badge-${source.id}` : `graphing-badge-${source.id}`}
                          >
                            <Loader size={12} color={isCancellingBuild ? 'red' : 'orange'} />
                          </Avatar>
                        </HoverCard.Target>
                        <HoverCard.Dropdown>
                          <Text size='sm'>{isCancellingBuild ? 'Cancelling — undoing this graph update...' : 'Graphing...'}</Text>
                        </HoverCard.Dropdown>
                      </HoverCard>
                    )}
                    {!isGraphing && !isIncomingSharedDoc && (isGraphed || isGraphEligible) && (
                      <HoverCard shadow='md' withArrow position='top' withinPortal>
                        <HoverCard.Target>
                          <Avatar
                            color={isGraphed ? 'blue.9' : isStaged ? 'yellow.9' : 'gray.5'}
                            // Opaque panel-colored fill (not transparent) so the empty ring
                            // still reads as empty against the sidebar but occludes the
                            // admin/share badge behind it — keeping it behind in every state.
                            bg={isGraphed ? 'blue.1' : isStaged ? 'yellow.2' : 'dark.5'}
                            radius='xl'
                            size={24}
                            onClick={isGraphed ? undefined : (e: React.MouseEvent) => {
                              e.stopPropagation();
                              toggleGraphStaged(source.id);
                            }}
                            sx={(theme) => ({
                              cursor: isGraphed ? 'default' : 'pointer',
                              border: !isGraphed && !isStaged ? `1px dashed ${theme.colors.gray[6]}` : undefined,
                            })}
                            data-testid={isGraphed ? `graphed-badge-${source.id}` : `graph-stage-${source.id}`}
                          >
                            <IconNetwork size={12} />
                          </Avatar>
                        </HoverCard.Target>
                        <HoverCard.Dropdown>
                          <Box sx={{ maxWidth: 320 }}>
                            {isGraphed ? (
                              <>
                                <Text size='sm' fw={600} mb='xs' color='gray.0'>
                                  Graphed
                                </Text>
                                {!isUserProvided && (
                                  <>
                                    <Text size='xs' color='gray.3' mb='xs'>
                                      Schema: {graphedSchemaName && graphedSchemaName !== '—' ? graphedSchemaName : 'Unset (re-upload to assign schema)'}
                                    </Text>
                                    <Text size='xs' color='gray.4'>
                                      Schema is locked after graphing
                                    </Text>
                                  </>
                                )}
                                {isUserProvided && (
                                  <Text size='xs' color='gray.3'>
                                    User-provided graph — schema not used
                                  </Text>
                                )}
                              </>
                            ) : isStaged ? (
                              <>
                                <Text size='sm' fw={600} mb='xs' color='gray.0'>
                                  {!isUserProvided ? 'Staged — select schema' : 'Staged to graph'}
                                </Text>
                                <Text size='xs' color='gray.3' mb='sm'>
                                  {!isUserProvided
                                    ? 'Choose extraction vocabulary for this document. Click badge to unstage.'
                                    : 'Click badge to remove from staging.'}
                                </Text>
                                {!isUserProvided && (
                                  <>
                                    <Select
                                      data={SCHEMA_SELECT_DATA}
                                      value={perDocSchemaOverrides[source.id] ?? suggestSchemaKey(docType)}
                                      onChange={(value) => {
                                        if (value) {
                                          applyDocumentSchema(source.id, value, suggestSchemaKey(docType));
                                        }
                                      }}
                                      size='sm'
                                      label='Schema'
                                      withinPortal
                                      icon={perDocSchemaOverrides[source.id]
                                        ? undefined
                                        : (
                                          <Tooltip label='AI suggestion based on document type' withinPortal>
                                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                              <IconSparkles size={14} color='#FFC107' />
                                            </Box>
                                          </Tooltip>
                                        )}
                                      styles={(theme) => ({
                                        input: perDocSchemaOverrides[source.id]
                                          ? { borderColor: theme.colors.blue[6], backgroundColor: theme.fn.rgba(theme.colors.blue[9], 0.18) }
                                          : {},
                                      })}
                                      onClick={(e) => e.stopPropagation()}
                                      data-testid={`schema-select-${source.id}`}
                                    />
                                    {(() => {
                                      const selectedSchemaKey = perDocSchemaOverrides[source.id] ?? suggestSchemaKey(docType);
                                      const selectedSchema = GRAPH_SCHEMAS.find((s) => s.key === selectedSchemaKey);
                                      const isAiSuggestion = !perDocSchemaOverrides[source.id];

                                      return (
                                        <>
                                          {isAiSuggestion ? (
                                            <Text size='xs' color='yellow.4' mt={6}>
                                              AI-recommended schema based on your document type.
                                            </Text>
                                          ) : (
                                            <Text size='xs' color='blue.4' mt={6}>
                                              Manually selected schema, overriding the AI suggestion.
                                            </Text>
                                          )}
                                          {selectedSchema?.description && (
                                            <Text size='xs' color='gray.4' mt={4}>
                                              {selectedSchema.description}
                                            </Text>
                                          )}
                                        </>
                                      );
                                    })()}
                                  </>
                                )}
                              </>
                            ) : (
                              <>
                                <Text size='sm' fw={600} mb='xs' color='gray.0'>
                                  Click to graph
                                </Text>
                                {!isUserProvided && (
                                  <Text size='xs' color='gray.3'>
                                    Stage first to select schema
                                  </Text>
                                )}
                              </>
                            )}
                          </Box>
                        </HoverCard.Dropdown>
                      </HoverCard>
                    )}
                    {!isGraphing && isUngraphable && !isIncomingSharedDoc && (
                      <HoverCard shadow='md' withArrow position='top' withinPortal>
                        <HoverCard.Target>
                          <Avatar
                            color='gray.8'
                            bg='gray.2'
                            radius='xl'
                            size={24}
                            style={{ cursor: 'pointer' }}
                            data-testid={`ungraphable-badge-${source.id}`}
                          >
                            <IconCircleOff size={12} />
                          </Avatar>
                        </HoverCard.Target>
                        <HoverCard.Dropdown>
                          <Text size='sm'>Ungraphable</Text>
                        </HoverCard.Dropdown>
                      </HoverCard>
                    )}
                  </Avatar.Group>
                )}

                {isPending ? (
                  isFailed ? (
                    <ActionIcon
                      size='sm'
                      variant='outline'
                      color='red'
                      loading={deleteDocumentIsPending}
                      data-testid='delete-failed-document-button'
                      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                        e.stopPropagation();
                        handleDeleteFailedDocument(source.id);
                      }}
                      sx={(theme) => ({
                        '&:hover': {
                          backgroundColor: theme.colors.red[9],
                        },
                      })}
                    >
                      <IconX size={16} stroke={2} />
                    </ActionIcon>
                  ) : (
                    <Loader size='sm' color='yellow' />
                  )
                ) : (
                  // Check if this is an incoming shared document - show accept/reject icons instead of checkbox
                  isIncomingSharedDoc ? (
                    <Group spacing='sm'>
                      <HoverCard shadow='md' withArrow position='bottom' withinPortal>
                        <HoverCard.Target>
                          <ActionIcon
                            size='sm'
                            variant='filled'
                            color='green'
                            loading={acceptSharedDocumentIsPending}
                            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                              e.stopPropagation();
                              if ('incomingShareData' in source && source.incomingShareData) {
                                const incomingData = source.incomingShareData as IncomingSharedDocument;
                                handleAcceptSharedDocument(incomingData.id);
                              }
                            }}
                            sx={(theme) => ({
                              cursor: 'pointer',
                              '&:hover': {
                                backgroundColor: theme.colors.green[9],
                              },
                            })}
                          >
                            <IconCheck size={16} stroke={2} />
                          </ActionIcon>
                        </HoverCard.Target>
                        <HoverCard.Dropdown>
                          <Box sx={{ maxWidth: 280 }}>
                            <Text size='sm'>This document was shared with you by a member of a user group you belong to.</Text>
                            <Text size='sm' mt='xs'>Click accept to add it to your document library.</Text>
                          </Box>
                        </HoverCard.Dropdown>
                      </HoverCard>
                      <HoverCard shadow='md' withArrow position='bottom' withinPortal>
                        <HoverCard.Target>
                          <ActionIcon
                            size='sm'
                            variant='filled'
                            color='red'
                            loading={rejectSharedDocumentIsPending}
                            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                              e.stopPropagation();
                              if ('incomingShareData' in source && source.incomingShareData) {
                                const incomingData = source.incomingShareData as IncomingSharedDocument;
                                handleRejectSharedDocument(incomingData.id);
                              }
                            }}
                            sx={(theme) => ({
                              cursor: 'pointer',
                              '&:hover': {
                                backgroundColor: theme.colors.red[9],
                              },
                            })}
                          >
                            <IconX size={16} stroke={2} />
                          </ActionIcon>
                        </HoverCard.Target>
                        <HoverCard.Dropdown>
                          <Box sx={{ maxWidth: 280 }}>
                            <Text size='sm'>This document was shared with you by a member of a user group you belong to.</Text>
                            <Text size='sm' mt='xs'>Click to dismiss.</Text>
                          </Box>
                        </HoverCard.Dropdown>
                      </HoverCard>
                    </Group>
                  ) : (
                    <Checkbox
                      checked={isSelected}
                      disabled={isGraphing || isImporting}
                      onChange={() => {}} // Handled by checkbox onClick
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent Group onClick
                        if (!isGraphing) {
                          handleSourceToggle(source.id, source.type);
                        }
                      }}
                      size='sm'
                      sx={{
                        '& input:hover': {
                          cursor: isGraphing ? 'not-allowed !important' : 'pointer !important',
                        },
                      }}
                    />
                  )
                )}
              </Group>
            </>
          );
        })()}
      </Group>
    );

    // Use popover for graphing state, tooltip for others
    if (isGraphing) {
      return (
        <GraphingStatusPopover
          key={source.id}
          buildInfo={buildInfo}
          entityResolutionEnabled={systemConfig?.knowledgeGraphEntityResolutionEnabled ?? false}
        >
          {groupElement}
        </GraphingStatusPopover>
      );
    }

    const tooltipLabel = isFailed
      ? 'Upload failed'
      : isPending
      ? 'Upload in progress'
      : isUngraphable
      ? 'This source cannot be added to the knowledge graph.'
      : undefined;
    return tooltipLabel ? (
      <Tooltip key={source.id} label={tooltipLabel} position='right' multiline withinPortal>
        {groupElement}
      </Tooltip>
    ) : (
      groupElement
    );
  };

  if (userKnowledgeBasesIsPending || preselectedKnowledgeBasesIsPending || systemConfigIsLoading || documentsActuallyPending || sharedDocumentsIsPending) {
    return <Center mt='md'><Loader size='sm' data-testid='loading' /></Center>;
  }

  if (allSources.length === 0) {
    return (
      <Box py='xl' px='md'>
        <Stack spacing='xs' align='center'>
          <Text size='md' color='gray.6' fw={600} ta='center'>
            No sources yet
          </Text>
          <Text size='sm' color='gray.7' ta='center'>
            Add sources to get started
          </Text>
        </Stack>
      </Box>
    );
  }

  return (
    <Stack
      spacing={8}
      mt='md'
      mb='sm'
      pr={4}
      style={{ overflowY: 'auto' }}
      sx={(theme) => ({
        scrollbarGutter: 'stable',
        '&::-webkit-scrollbar': {
          width: '8px',
        },
        '&::-webkit-scrollbar-track': {
          background: 'transparent',
        },
        '&::-webkit-scrollbar-thumb': {
          backgroundColor: theme.colors.dark[3],
          borderRadius: theme.radius.sm,
        },
        '&::-webkit-scrollbar-thumb:hover': {
          backgroundColor: theme.colors.dark[2],
        },
        '@supports (-moz-appearance: none)': {
          scrollbarWidth: 'thin',
          scrollbarColor: `${theme.colors.dark[3]} transparent`,
        },
      })}
    >
      {/* Select All Checkbox */}
      <Group position='apart' pr={ROW_RIGHT_INSET}>
        <Text size='sm' color='gray.6' fw='bold'>
          All sources
        </Text>
        <Group spacing='xs' noWrap>
          {renderGroupGraphBadge(documentSources, 'all-sources-graph-stage')}
          <Checkbox
            checked={selectAllChecked}
            onChange={(event) => handleSelectAll(event.currentTarget.checked)}
            size='sm'
            sx={{
              '&:hover': {
                cursor: 'pointer !important',
              },
              '& input:hover': {
                cursor: 'pointer !important',
              },
              '& .mantine-Checkbox-input:hover': {
                cursor: 'pointer !important',
              },
            }}
          />
        </Group>
      </Group>

      {/* Knowledge Bases - Always shown at top */}
      {knowledgeBaseSources.length > 0 && (
        <Stack spacing={4}>
          <Text size='xs' color='gray.5' fw={600} mb={4}>
            Knowledge Bases
          </Text>
          {knowledgeBaseSources.map((source) => renderSourceItem(source))}
        </Stack>
      )}

      {/* Admin-pushed sources, one collapsed folder per user group. Sits above the
          user's own folders so group libraries stay visually separate from — and
          never crowd out — the documents the user uploaded themselves. */}
      {adminDocumentsByGroup.length > 0 && (
        <Stack spacing={4} data-testid='admin-group-folders'>
          <Text size='xs' color='gray.5' fw='bold' my='xxs' data-testid='admin-sources-header'>
            Shared with you
          </Text>
          <Accordion
            multiple
            chevronPosition='left'
            value={openAccordionItems}
            onChange={setOpenAccordionItems}
            chevron={<IconChevronRight size={14} />}
            styles={FOLDER_ACCORDION_STYLES}
          >
            {adminDocumentsByGroup.map((group) => {
              const groupDocIds = group.documents.map((doc) => doc.id);
              const allGroupDocsSelected = groupDocIds.every((id) => documentIds.includes(id));
              const someGroupDocsSelected = groupDocIds.some((id) => documentIds.includes(id));

              return (
                <Accordion.Item
                  key={group.groupId}
                  value={`${GROUP_FOLDER_PREFIX}${group.groupId}`}
                  data-testid={`admin-group-folder-${group.groupId}`}
                >
                  <Accordion.Control>
                    <Group position='apart' spacing={8} style={{ width: '100%' }}>
                      <Group spacing={10} style={{ flex: 1 }}>
                        <ThemeIcon
                          size={18}
                          c='blue.4'
                          style={{ pointerEvents: 'none' }}
                          variant='transparent'
                        >
                          <IconFolder stroke={1.5} size={16} />
                        </ThemeIcon>
                        <Text size='sm' fw={500} color='gray.1' style={{ flex: 1 }}>
                          {group.groupName} <Text span color='gray.5' fw={400}>({group.documents.length})</Text>
                        </Text>
                      </Group>
                      <Group spacing='xs' noWrap>
                        {renderGroupGraphBadge(group.documents, `group-folder-graph-stage-${group.groupId}`)}
                        <Checkbox
                          checked={allGroupDocsSelected}
                          indeterminate={someGroupDocsSelected && !allGroupDocsSelected}
                          onChange={(event) => {
                            event.stopPropagation();
                            handleSelectDocumentGroup(groupDocIds, event.currentTarget.checked);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          size='sm'
                          data-testid={`admin-group-folder-checkbox-${group.groupId}`}
                          sx={{
                            '& input:hover': {
                              cursor: 'pointer !important',
                            },
                          }}
                        />
                      </Group>
                    </Group>
                  </Accordion.Control>
                  <Accordion.Panel>
                    <Box
                      sx={(theme) => ({
                        marginLeft: 12,
                        borderLeft: `1px solid ${theme.colors.dark[5]}`,
                        paddingLeft: 4,
                      })}
                    >
                      <Stack spacing={2}>
                        {group.documents.map((source) => renderSourceItem(source))}
                      </Stack>
                    </Box>
                  </Accordion.Panel>
                </Accordion.Item>
              );
            })}
          </Accordion>
        </Stack>
      )}

      {/* The user's own sources. Labelled only when group folders are present above,
          so the default (no admin sources) view keeps its unlabelled flat list. */}
      {adminDocumentsByGroup.length > 0 && (documentsByCollection.length > 0 || documentsNotInCollections.length > 0) && (
        <Text size='xs' color='gray.5' fw='bold' my='xxs' data-testid='own-sources-header'>
          Your uploads
        </Text>
      )}

      {/* Documents grouped by collection in accordion */}
      {documentsByCollection.length > 0 && (
        <Accordion
          multiple
          chevronPosition='left'
          value={openAccordionItems}
          onChange={setOpenAccordionItems}
          chevron={<IconChevronRight size={14} />}
          styles={FOLDER_ACCORDION_STYLES}
        >
          {documentsByCollection.map((collection) => {
            // Check if all documents in this collection are selected
            const collectionDocIds = collection.documents.map((doc) => doc.id);
            const allCollectionDocsSelected = collectionDocIds.every((id) => documentIds.includes(id));
            const someCollectionDocsSelected = collectionDocIds.some((id) => documentIds.includes(id));

            return (
              <Accordion.Item key={collection.collectionId} value={collection.collectionId}>
                <Accordion.Control>
                  <Group position='apart' spacing={8} style={{ width: '100%' }}>
                    <Group spacing={10} style={{ flex: 1 }}>
                      <ThemeIcon
                        size={18}
                        c={collection.collectionColor || 'gray'}
                        style={{ pointerEvents: 'none' }}
                        variant='transparent'
                      >
                        <IconFolder stroke={1.5} size={16} />
                      </ThemeIcon>
                      <Text size='sm' fw={500} color='gray.1' style={{ flex: 1 }}>
                        {collection.collectionName} <Text span color='gray.5' fw={400}>({collection.documents.length})</Text>
                      </Text>
                    </Group>
                    <Group spacing='xs' noWrap>
                      {renderGroupGraphBadge(collection.documents, `folder-graph-stage-${collection.collectionId}`)}
                      <Checkbox
                        checked={allCollectionDocsSelected}
                        indeterminate={someCollectionDocsSelected && !allCollectionDocsSelected}
                        onChange={(event) => {
                          event.stopPropagation();
                          handleSelectCollection(collection.collectionId, event.currentTarget.checked);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        size='sm'
                        sx={{
                          '& input:hover': {
                            cursor: 'pointer !important',
                          },
                        }}
                      />
                    </Group>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <Box
                    sx={(theme) => ({
                      marginLeft: 12,
                      borderLeft: `1px solid ${theme.colors.dark[5]}`,
                      paddingLeft: 4,
                    })}
                  >
                    <Stack spacing={2}>
                      {collection.documents.map((source) => renderSourceItem(source))}
                    </Stack>
                  </Box>
                </Accordion.Panel>
              </Accordion.Item>
            );
          })}
        </Accordion>
      )}

      {documentsNotInCollections.length > 0 && (
        <Stack spacing={2}>
          {documentsNotInCollections.map((source) => renderSourceItem(source))}
        </Stack>
      )}

      {/* Modals */}
      <ShareAssetModal
        modalOpened={shareModalOpen}
        closeModalHandler={() => {
          setShareModalOpen(false);
          setShareDocumentData(null);
        }}
        assetName={shareDocumentData?.label || ''}
        assetType='document'
        onConfirm={handleConfirmShare}
        isReshare={shareDocumentData?.isReshare || false}
        currentSharedGroupIds={shareDocumentData?.currentSharedGroupIds || []}
      />
      
      {/* Delete Source Modal */}
      <DeleteSourceModal
        modalOpened={deleteModalOpen}
        closeModalHandler={() => {
          setDeleteModalOpen(false);
          setDeleteDocumentData(null);
        }}
        sourceId={deleteDocumentData?.id || ''}
        sourceLabel={deleteDocumentData?.label || ''}
        onDeleteSuccess={handleDeleteSuccess}
      />

      {/* Manage Document Collections Modal */}
      {manageCollectionsDocumentData && (
        <ManageDocumentCollectionsModal
          modalOpened={manageCollectionsModalOpen}
          closeModalHandler={() => {
            setManageCollectionsModalOpen(false);
            setManageCollectionsDocumentData(null);
          }}
          documentId={manageCollectionsDocumentData.id}
          documentFilename={manageCollectionsDocumentData.filename}
          currentCollectionIds={manageCollectionsDocumentData.collectionIds}
        />
      )}
    </Stack>
  );
}
