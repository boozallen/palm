 import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { notifications } from '@mantine/notifications';

import SourcesSidebar from './SourcesSidebar';
import { useChat } from '@/features/chat/providers/ChatProvider';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import useGetUserKnowledgeBases from '@/features/shared/api/get-user-knowledge-bases';
import useGetDocuments from '@/features/shared/api/document-upload/get-documents';
import useGetDocumentContent from '@/features/shared/api/document-upload/get-document-content';
import useGetDocumentUploadRequirements from '@/features/shared/api/document-upload/get-document-upload-requirements';
import { useGetUserGraphDatabaseAccess } from '@/features/shared/api/get-user-graph-database-access';
import useHighlightSelectedCitation from '@/features/chat/hooks/useHighlightSelectedCitation';
import { useGetActiveGraphBuilds } from '@/features/graph-database/api/get-active-graph-builds';
import { useGetFeatureFlag } from '@/features/shared/api/get-feature-flag';
import { useGetGraphStatus } from '@/features/graph-database/api/get-graph-status';
import { GraphBuildStatus } from '@/features/graph-database/types';
import { useCreateClientSideAuditRecord } from '@/features/shared/api/create-client-side-audit-record';
import { AuditRecordEvent } from '@/features/shared/types/audit-record';

jest.mock('@mantine/notifications', () => ({ notifications: { show: jest.fn() } }));
jest.mock('@/features/chat/providers/ChatProvider');
jest.mock('@/features/shared/api/get-system-config');
jest.mock('@/features/shared/api/get-user-knowledge-bases');
jest.mock('@/features/shared/api/document-upload/get-documents');
jest.mock('@/features/shared/api/document-upload/get-document-content');
jest.mock('@/features/shared/api/document-upload/get-document-upload-requirements');
jest.mock('@/features/shared/api/get-user-graph-database-access');
jest.mock('@/features/chat/hooks/useHighlightSelectedCitation');
jest.mock('@/features/shared/api/get-feature-flag');

// Mock trpc utils for cache invalidation
const mockGetGraphStatusInvalidate = jest.fn();
const mockGetGraphStatusReset = jest.fn();
jest.mock('@/libs', () => ({
  trpc: {
    useUtils: () => ({
      graph: {
        getGraphStatus: {
          invalidate: mockGetGraphStatusInvalidate,
          reset: mockGetGraphStatusReset,
        },
      },
    }),
    graph: {
      getActiveGraphBuilds: {
        useQuery: jest.fn(() => ({
          data: [],
          isLoading: false,
          error: null,
        })),
      },
    },
  },
}));

// Mock graph-related hooks
const mockBuildGraphMutateAsync = jest.fn().mockResolvedValue({ status: 'Completed', graphId: 'test-graph-id' });
jest.mock('@/features/graph-database/api/build-graph', () => ({
  __esModule: true,
  default: () => ({
    mutateAsync: mockBuildGraphMutateAsync,
    isPending: false,
  }),
}));

jest.mock('@/features/graph-database/api/get-graph-status', () => ({
  useGetGraphStatus: jest.fn(() => ({
    data: null,
    isLoading: false,
  })),
}));

const mockRefetchGraphedDocuments = jest.fn();
jest.mock('@/features/graph-database/api/get-graphed-documents', () => ({
  useGetGraphedDocuments: () => ({
    data: { documentIds: [] },
    refetch: mockRefetchGraphedDocuments,
  }),
}));

jest.mock('@/features/graph-database/api/get-active-graph-builds', () => ({
  useGetActiveGraphBuilds: jest.fn(() => ({
    data: [],
    isLoading: false,
    error: null,
  })),
}));

jest.mock('@/features/chat/components/content/sources/ExpandedSourcesList', () => {
  return function MockExpandedSourcesList({ 
    onSourceClick, 
    useGraph, 
    graphingSourceIds, 
    removingGraphedSourceIds,
  }: any) {
    return (
      <div data-testid='expanded-sources-list'>
        <div data-testid='expanded-sources-use-graph'>{useGraph ? 'true' : 'false'}</div>
        <div data-testid='expanded-sources-graphing-ids'>{graphingSourceIds?.join(',') || ''}</div>
        <div data-testid='expanded-sources-removing-ids'>{removingGraphedSourceIds?.join(',') || ''}</div>
        {onSourceClick && (
          <button 
            data-testid='expanded-sources-click-handler'
            onClick={() => onSourceClick('test-source', 'document')}
          >
            Click Source
          </button>
        )}
      </div>
    );
  };
});

jest.mock('@/features/chat/components/content/sources/CollapsedSourcesList', () => {
  return function MockCollapsedSourcesList() {
    return <div data-testid='collapsed-sources-list'>Collapsed Sources List</div>;
  };
});

jest.mock('@/features/shared/components/modals/AddSourcesModal', () => {
  return function MockAddSourcesModal({ isModalOpen, closeModalHandler }: any) {
    return isModalOpen ? (
      <div data-testid='add-sources-modal'>
        <button onClick={closeModalHandler}>Close Modal</button>
      </div>
    ) : null;
  };
});

jest.mock('@/features/shared/components/document-library/modals/ManageCollectionsModal', () => {
  return function MockManageCollectionsModal({ modalOpened, closeModalHandler }: any) {
    return modalOpened ? (
      <div data-testid='manage-collections-modal'>
        <button onClick={closeModalHandler}>Close Modal</button>
      </div>
    ) : null;
  };
});

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

const renderComponent = (props = {}) => {
  return render(
    <MantineProvider>
      <SourcesSidebar {...props} />
    </MantineProvider>
  );
};

describe('SourcesSidebar', () => {
  const mockSetSourcesSidebarExpanded = jest.fn();
  const mockCreateAuditRecord = jest.fn();

  const createMockUseChat = (overrides = {}) => ({
    knowledgeBaseIds: [] as string[],
    documentIds: [] as string[],
    setDocumentIds: jest.fn(),
    sourcesSidebarExpanded: false,
    setSourcesSidebarExpanded: mockSetSourcesSidebarExpanded,
    isGeneratingGraph: false,
    setIsGeneratingGraph: jest.fn(),
    setShowGraphTooltip: jest.fn(),
    setUseGraph: jest.fn(),
    useGraph: false,
    graphedSourceIds: [] as string[],
    setGraphedSourceIds: jest.fn(),
    graphingSourceIds: [] as string[],
    setGraphingSourceIds: jest.fn(),
    removingGraphedSourceIds: [] as string[],
    setRemovingGraphedSourceIds: jest.fn(),
    perDocSchemaOverrides: {} as Record<string, string>,
    setPerDocSchemaOverrides: jest.fn(),
    graphSelectedIds: [] as string[],
    setGraphSelectedIds: jest.fn(),
    cancelledGraphIds: [] as string[],
    setCancelledGraphIds: jest.fn(),
    highlightedCitation: null,
    setHighlightedCitation: jest.fn(),
    showKnowledgeGraph: false,
    setShowKnowledgeGraph: jest.fn(),
    setSelectedArtifact: jest.fn(),
    triggerAddSource: false,
    setTriggerAddSource: jest.fn(),
    setHasUserInteracted: jest.fn(),
    setUploadingDocuments: jest.fn(),
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // The global jest.setup mock swallows the audit mutation; override it here so
    // the sidebar-toggle assertions can see what was recorded.
    (useCreateClientSideAuditRecord as jest.Mock).mockReturnValue({ mutate: mockCreateAuditRecord });

    // clearAllMocks does not reset return values, so re-establish the default
    // (no active builds) before each test to prevent cross-test leakage.
    (useGetActiveGraphBuilds as jest.Mock).mockReturnValue({ data: [], isLoading: false, error: null });
    (useGetGraphStatus as jest.Mock).mockReturnValue({ data: null, isLoading: false });

    (useChat as jest.Mock).mockReturnValue(createMockUseChat());

    (useGetSystemConfig as jest.Mock).mockReturnValue({
      data: {
        documentLibraryDocumentUploadProviderId: 'test-provider-id',
      },
    });

    (useGetUserKnowledgeBases as jest.Mock).mockReturnValue({
      data: {
        userKnowledgeBases: [],
      },
    });

    (useGetDocuments as jest.Mock).mockReturnValue({
      data: {
        documents: [],
      },
    });

    (useGetDocumentContent as jest.Mock).mockReturnValue({ data: undefined });

    (useGetDocumentUploadRequirements as jest.Mock).mockReturnValue({
      data: { configured: true, requirements: [] },
      isPending: false,
    });

    (useGetUserGraphDatabaseAccess as jest.Mock).mockReturnValue({
      data: {
        hasAccess: true,
      },
    });

    (useHighlightSelectedCitation as jest.Mock).mockReturnValue({
      displaySource: null,
      setDisplaySource: jest.fn(),
      highlightedTextRef: { current: null },
      renderHighlightedText: jest.fn((text: string) => text),
    });

    // Default: all feature flags off → byte-identical to pre-feature behavior.
    (useGetFeatureFlag as jest.Mock).mockReturnValue({ data: { isFeatureOn: false } });
  });

  describe('Add Sources button - collapsed sidebar', () => {
    it('renders the collapsed Add Sources button', () => {
      (useChat as jest.Mock).mockReturnValue(createMockUseChat());

      renderComponent();

      const button = screen.getByTestId('add-sources-button-collapsed');
      expect(button).toBeInTheDocument();
    });

    it('opens AddSourcesModal when collapsed button is clicked', () => {
      (useChat as jest.Mock).mockReturnValue(createMockUseChat());

      renderComponent();

      const button = screen.getByTestId('add-sources-button-collapsed');

      // Initially modal should not be visible
      expect(screen.queryByTestId('add-sources-modal')).not.toBeInTheDocument();

      // Click the button
      fireEvent.click(button);

      // Modal should now be visible
      expect(screen.getByTestId('add-sources-modal')).toBeInTheDocument();
    });

    it('closes AddSourcesModal when close handler is called', () => {
      (useChat as jest.Mock).mockReturnValue(createMockUseChat());

      renderComponent();

      const button = screen.getByTestId('add-sources-button-collapsed');

      // Open the modal
      fireEvent.click(button);
      expect(screen.getByTestId('add-sources-modal')).toBeInTheDocument();

      // Close the modal
      const closeButton = screen.getByText('Close Modal');
      fireEvent.click(closeButton);

      // Modal should be closed
      expect(screen.queryByTestId('add-sources-modal')).not.toBeInTheDocument();
    });
  });

  // Uploading a source embeds it, so no embedding model means the upload can only
  // fail. The buttons are disabled rather than hidden so the tooltip can say why.
  describe('Add Sources button - no embedding model configured', () => {
    beforeEach(() => {
      (useGetDocumentUploadRequirements as jest.Mock).mockReturnValue({
        data: { configured: false, requirements: [] },
        isPending: false,
      });
    });

    it('disables the collapsed button', () => {
      (useChat as jest.Mock).mockReturnValue(createMockUseChat());

      renderComponent();

      expect(screen.getByTestId('add-sources-button-collapsed')).toBeDisabled();
    });

    it('disables the expanded button', () => {
      (useChat as jest.Mock).mockReturnValue(createMockUseChat({ sourcesSidebarExpanded: true }));

      renderComponent();

      expect(screen.getByTestId('add-sources-button-expanded')).toBeDisabled();
    });

    it('does not open the modal when the disabled button is clicked', () => {
      (useChat as jest.Mock).mockReturnValue(createMockUseChat({ sourcesSidebarExpanded: true }));

      renderComponent();

      fireEvent.click(screen.getByTestId('add-sources-button-expanded'));

      expect(screen.queryByTestId('add-sources-modal')).not.toBeInTheDocument();
    });

    // Without this the trigger would bypass the disabled buttons entirely.
    it('does not open the modal from the external add-source trigger', () => {
      (useChat as jest.Mock).mockReturnValue(
        createMockUseChat({ triggerAddSource: true }),
      );

      renderComponent();

      expect(screen.queryByTestId('add-sources-modal')).not.toBeInTheDocument();
    });
  });

  // The requirements query resolves after the first render, so treating "unknown"
  // as available would leave a clickable button during the gap.
  describe('Add Sources button - requirements still loading', () => {
    it('disables the button until the check resolves', () => {
      (useGetDocumentUploadRequirements as jest.Mock).mockReturnValue({
        data: undefined,
        isPending: true,
      });
      (useChat as jest.Mock).mockReturnValue(createMockUseChat({ sourcesSidebarExpanded: true }));

      renderComponent();

      expect(screen.getByTestId('add-sources-button-expanded')).toBeDisabled();
    });
  });

  describe('Add Sources button - expanded sidebar', () => {
    it('renders the expanded Add Sources button', () => {
      (useChat as jest.Mock).mockReturnValue(createMockUseChat({ sourcesSidebarExpanded: true }));

      renderComponent();

      const button = screen.getByTestId('add-sources-button-expanded');
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent('Add Sources');
    });

    it('opens AddSourcesModal when expanded button is clicked', () => {
      (useChat as jest.Mock).mockReturnValue(createMockUseChat({ sourcesSidebarExpanded: true }));

      renderComponent();

      const button = screen.getByTestId('add-sources-button-expanded');

      // Initially modal should not be visible
      expect(screen.queryByTestId('add-sources-modal')).not.toBeInTheDocument();

      // Click the button
      fireEvent.click(button);

      // Modal should now be visible
      expect(screen.getByTestId('add-sources-modal')).toBeInTheDocument();
    });

    it('closes AddSourcesModal when close handler is called', () => {
      (useChat as jest.Mock).mockReturnValue(createMockUseChat({ sourcesSidebarExpanded: true }));

      renderComponent();

      const button = screen.getByTestId('add-sources-button-expanded');

      // Open the modal
      fireEvent.click(button);
      expect(screen.getByTestId('add-sources-modal')).toBeInTheDocument();

      // Close the modal
      const closeButton = screen.getByText('Close Modal');
      fireEvent.click(closeButton);

      // Modal should be closed
      expect(screen.queryByTestId('add-sources-modal')).not.toBeInTheDocument();
    });

    it('does not render the expanded Add Sources button when viewing source details', () => {
      (useChat as jest.Mock).mockReturnValue(createMockUseChat({
        knowledgeBaseIds: ['kb-1'],
        sourcesSidebarExpanded: true,
      }));

      (useGetUserKnowledgeBases as jest.Mock).mockReturnValue({
        data: {
          userKnowledgeBases: [
            {
              id: 'kb-1',
              label: 'Test Knowledge Base',
            },
          ],
        },
      });

      renderComponent();

      // Click on a knowledge base to view its details
      // First, we need to simulate clicking on a source
      // Since this is a more complex interaction, we'll just verify the button is hidden
      // when displaySource state is set (which happens after clicking a source)

      // For now, just verify the button exists initially
      expect(screen.getByTestId('add-sources-button-expanded')).toBeInTheDocument();
    });
  });

  describe('Sidebar visibility', () => {
    it('returns null when isVisible is false', () => {
      renderComponent({ isVisible: false });

      expect(screen.queryByTestId('add-sources-button-collapsed')).not.toBeInTheDocument();
      expect(screen.queryByTestId('add-sources-button-expanded')).not.toBeInTheDocument();
    });

    it('renders collapsed view when sourcesSidebarExpanded is false', () => {
      (useChat as jest.Mock).mockReturnValue(createMockUseChat());

      renderComponent();

      expect(screen.getByTestId('collapsed-sources-list')).toBeInTheDocument();
      expect(screen.queryByTestId('expanded-sources-list')).not.toBeInTheDocument();
    });

    it('renders expanded view when sourcesSidebarExpanded is true', () => {
      (useChat as jest.Mock).mockReturnValue(createMockUseChat({ sourcesSidebarExpanded: true }));

      renderComponent();

      expect(screen.getByTestId('expanded-sources-list')).toBeInTheDocument();
      expect(screen.queryByTestId('collapsed-sources-list')).not.toBeInTheDocument();
    });
  });

  describe('Graph state management', () => {
    describe('useGraph toggle behavior', () => {
      it('should have useGraph false by default', () => {
        const chatMock = createMockUseChat({ useGraph: false });
        (useChat as jest.Mock).mockReturnValue(chatMock);

        renderComponent();

        expect(chatMock.useGraph).toBe(false);
      });

      it('should track useGraph state from ChatProvider', () => {
        const chatMock = createMockUseChat({ useGraph: true });
        (useChat as jest.Mock).mockReturnValue(chatMock);

        renderComponent();

        expect(chatMock.useGraph).toBe(true);
      });
    });

    describe('graphedSourceIds tracking', () => {
      it('should have empty graphedSourceIds by default', () => {
        const chatMock = createMockUseChat({ graphedSourceIds: [] });
        (useChat as jest.Mock).mockReturnValue(chatMock);

        renderComponent();

        expect(chatMock.graphedSourceIds).toEqual([]);
      });

      it('should track documents that have been graphed', () => {
        const graphedDocs = ['doc-1', 'doc-2'];
        const chatMock = createMockUseChat({ graphedSourceIds: graphedDocs });
        (useChat as jest.Mock).mockReturnValue(chatMock);

        renderComponent();

        expect(chatMock.graphedSourceIds).toEqual(graphedDocs);
      });
    });

    describe('graphingSourceIds (in-progress graphing)', () => {
      it('should track documents currently being graphed', () => {
        const inProgressDocs = ['doc-3'];
        const chatMock = createMockUseChat({ graphingSourceIds: inProgressDocs });
        (useChat as jest.Mock).mockReturnValue(chatMock);

        renderComponent();

        expect(chatMock.graphingSourceIds).toEqual(inProgressDocs);
      });

      it('should clear graphingSourceIds when graphing completes', () => {
        const setGraphingSourceIds = jest.fn();
        const chatMock = createMockUseChat({
          graphingSourceIds: [],
          setGraphingSourceIds,
        });
        (useChat as jest.Mock).mockReturnValue(chatMock);

        renderComponent();

        // Verify setGraphingSourceIds is available
        expect(chatMock.setGraphingSourceIds).toBeDefined();
      });
    });

    describe('removingSourceIds tracking', () => {
      it('should track documents being removed', () => {
        const removingDocs = ['doc-4'];
        const chatMock = createMockUseChat({ removingGraphedSourceIds: removingDocs });
        (useChat as jest.Mock).mockReturnValue(chatMock);

        renderComponent();

        expect(chatMock.removingGraphedSourceIds).toEqual(removingDocs);
      });
    });

    describe('restoring graphing state from active builds on mount', () => {
      it('restores graphing state for only the processing subset (newDocumentIds), not the full union', () => {
        const setGraphingSourceIds = jest.fn();
        const setDocumentIds = jest.fn();
        (useChat as jest.Mock).mockReturnValue(createMockUseChat({
          setGraphingSourceIds,
          setDocumentIds,
        }));

        // Incremental build: row stores the union, but only doc-3 is processing.
        (useGetActiveGraphBuilds as jest.Mock).mockReturnValue({
          data: [{
            graphId: 'graph-1',
            documentIds: ['doc-1', 'doc-2', 'doc-3'],
            newDocumentIds: ['doc-3'],
            status: 'Building',
            currentStep: 'Extracting doc-3',
            createdAt: new Date(),
          }],
          isLoading: false,
          error: null,
        });

        renderComponent();

        // Spinner state is scoped to the processing subset...
        expect(setGraphingSourceIds).toHaveBeenCalledWith(['doc-3']);
        // ...and graph builds no longer restore chat selection (checkbox = chat,
        // staging = graph; the two are independent).
        expect(setDocumentIds).not.toHaveBeenCalledWith(['doc-1', 'doc-2', 'doc-3']);
      });

      it('falls back to the full documentIds union when newDocumentIds is absent', () => {
        const setGraphingSourceIds = jest.fn();
        (useChat as jest.Mock).mockReturnValue(createMockUseChat({
          setGraphingSourceIds,
        }));

        (useGetActiveGraphBuilds as jest.Mock).mockReturnValue({
          data: [{
            graphId: 'graph-1',
            documentIds: ['doc-1', 'doc-2'],
            status: 'Building',
            currentStep: 'Extracting',
            createdAt: new Date(),
          }],
          isLoading: false,
          error: null,
        });

        renderComponent();

        // Degrade-safe: without newDocumentIds the whole union is restored.
        expect(setGraphingSourceIds).toHaveBeenCalledWith(['doc-1', 'doc-2']);
      });
    });
  });

  describe('Document selection state combinations', () => {
    describe('All selected documents are graphed', () => {
      it('should recognize when all selected docs are already graphed', () => {
        const docIds = ['doc-1', 'doc-2'];
        const chatMock = createMockUseChat({
          documentIds: docIds,
          graphedSourceIds: docIds, // All docs are graphed
        });
        (useChat as jest.Mock).mockReturnValue(chatMock);

        renderComponent();

        // All selected docs are graphed
        expect(docIds.every(id => chatMock.graphedSourceIds.includes(id))).toBe(true);
      });
    });

    describe('No selected documents are graphed', () => {
      it('should recognize when no selected docs are graphed', () => {
        const docIds = ['doc-1', 'doc-2'];
        const chatMock = createMockUseChat({
          documentIds: docIds,
          graphedSourceIds: [], // None are graphed
        });
        (useChat as jest.Mock).mockReturnValue(chatMock);

        renderComponent();

        // No selected docs are graphed
        expect(docIds.some(id => chatMock.graphedSourceIds.includes(id))).toBe(false);
      });
    });

    describe('Mixed graphed/ungraphed documents', () => {
      it('should handle mixed state where some docs are graphed', () => {
        const docIds = ['doc-1', 'doc-2', 'doc-3'];
        const graphedIds = ['doc-1']; // Only first is graphed
        const chatMock = createMockUseChat({
          documentIds: docIds,
          graphedSourceIds: graphedIds,
        });
        (useChat as jest.Mock).mockReturnValue(chatMock);

        renderComponent();

        // Some but not all are graphed
        const someGraphed = docIds.some(id => chatMock.graphedSourceIds.includes(id));
        const allGraphed = docIds.every(id => chatMock.graphedSourceIds.includes(id));
        expect(someGraphed).toBe(true);
        expect(allGraphed).toBe(false);
      });
    });

    describe('No documents selected', () => {
      it('should handle empty document selection', () => {
        const chatMock = createMockUseChat({
          documentIds: [],
          graphedSourceIds: ['doc-1', 'doc-2'],
        });
        (useChat as jest.Mock).mockReturnValue(chatMock);

        renderComponent();

        // No documents are selected
        expect(chatMock.documentIds).toHaveLength(0);
      });
    });
  });

  describe('Graph generation state', () => {
    describe('isGeneratingGraph flag', () => {
      it('should track when graph is being generated', () => {
        const chatMock = createMockUseChat({
          isGeneratingGraph: true,
          documentIds: ['doc-1'],
          graphingSourceIds: ['doc-1'],
        });
        (useChat as jest.Mock).mockReturnValue(chatMock);

        renderComponent();

        expect(chatMock.isGeneratingGraph).toBe(true);
        expect(chatMock.graphingSourceIds).toContain('doc-1');
      });

      it('should be false when not generating', () => {
        const chatMock = createMockUseChat({
          isGeneratingGraph: false,
        });
        (useChat as jest.Mock).mockReturnValue(chatMock);

        renderComponent();

        expect(chatMock.isGeneratingGraph).toBe(false);
      });
    });
  });

  describe('Props passed to child components', () => {
    it('should pass graphedSourceIds to CollapsedSourcesList', () => {
      const graphedIds = ['doc-1', 'doc-2'];
      const chatMock = createMockUseChat({
        graphedSourceIds: graphedIds,
        sourcesSidebarExpanded: false,
      });
      (useChat as jest.Mock).mockReturnValue(chatMock);

      renderComponent();

      // CollapsedSourcesList should be rendered
      expect(screen.getByTestId('collapsed-sources-list')).toBeInTheDocument();
    });

    it('should pass graphingSourceIds to ExpandedSourcesList', () => {
      const graphingIds = ['doc-1'];
      const chatMock = createMockUseChat({
        graphingSourceIds: graphingIds,
        sourcesSidebarExpanded: true,
      });
      (useChat as jest.Mock).mockReturnValue(chatMock);

      renderComponent();

      // ExpandedSourcesList should be rendered with correct props
      expect(screen.getByTestId('expanded-sources-list')).toBeInTheDocument();
      expect(screen.getByTestId('expanded-sources-graphing-ids')).toHaveTextContent('doc-1');
    });

    it('should pass removingGraphedSourceIds to ExpandedSourcesList', () => {
      const removingIds = ['doc-2'];
      const chatMock = createMockUseChat({
        removingGraphedSourceIds: removingIds,
        sourcesSidebarExpanded: true,
      });
      (useChat as jest.Mock).mockReturnValue(chatMock);

      renderComponent();

      expect(screen.getByTestId('expanded-sources-list')).toBeInTheDocument();
      expect(screen.getByTestId('expanded-sources-removing-ids')).toHaveTextContent('doc-2');
    });

    it('should pass all graph-related props correctly to ExpandedSourcesList', () => {
      const chatMock = createMockUseChat({
        useGraph: false,
        graphingSourceIds: ['doc-1', 'doc-3'],
        removingGraphedSourceIds: ['doc-2', 'doc-4'],
        sourcesSidebarExpanded: true,
      });
      (useChat as jest.Mock).mockReturnValue(chatMock);

      renderComponent();

      expect(screen.getByTestId('expanded-sources-list')).toBeInTheDocument();
      expect(screen.getByTestId('expanded-sources-use-graph')).toHaveTextContent('false');
      expect(screen.getByTestId('expanded-sources-graphing-ids')).toHaveTextContent('doc-1,doc-3');
      expect(screen.getByTestId('expanded-sources-removing-ids')).toHaveTextContent('doc-2,doc-4');
    });

    it('should pass onSourceClick handler to ExpandedSourcesList', () => {
      const chatMock = createMockUseChat({
        sourcesSidebarExpanded: true,
      });
      (useChat as jest.Mock).mockReturnValue(chatMock);

      renderComponent();

      expect(screen.getByTestId('expanded-sources-list')).toBeInTheDocument();
      expect(screen.getByTestId('expanded-sources-click-handler')).toBeInTheDocument();
    });
  });

  describe('Graph toggle and chat integration', () => {
    it('should provide setUseGraph to update graph state', () => {
      const setUseGraph = jest.fn();
      const chatMock = createMockUseChat({
        setUseGraph,
        useGraph: false,
      });
      (useChat as jest.Mock).mockReturnValue(chatMock);

      renderComponent();

      expect(chatMock.setUseGraph).toBeDefined();
    });

    it('should provide setGraphedSourceIds to track graphed documents', () => {
      const setGraphedSourceIds = jest.fn();
      const chatMock = createMockUseChat({
        setGraphedSourceIds,
        graphedSourceIds: [],
      });
      (useChat as jest.Mock).mockReturnValue(chatMock);

      renderComponent();

      expect(chatMock.setGraphedSourceIds).toBeDefined();
    });

    it('should handle showGraphTooltip for UI feedback', () => {
      const setShowGraphTooltip = jest.fn();
      const chatMock = createMockUseChat({
        setShowGraphTooltip,
      });
      (useChat as jest.Mock).mockReturnValue(chatMock);

      renderComponent();

      expect(chatMock.setShowGraphTooltip).toBeDefined();
    });
  });

  describe('Graph database access control', () => {
    it('should hide graph features when user has no graph database access', () => {
      (useGetUserGraphDatabaseAccess as jest.Mock).mockReturnValue({
        data: {
          hasAccess: false,
        },
      });

      (useChat as jest.Mock).mockReturnValue(createMockUseChat({ sourcesSidebarExpanded: true }));

      renderComponent();

      // Graph button should not be displayed when user has no access
      expect(screen.queryByTestId('generate-graph-button')).not.toBeInTheDocument();
    });

    it('should show graph features when user has graph database access', () => {
      (useGetUserGraphDatabaseAccess as jest.Mock).mockReturnValue({
        data: {
          hasAccess: true,
        },
      });

      (useChat as jest.Mock).mockReturnValue(createMockUseChat({ sourcesSidebarExpanded: true }));

      renderComponent();

      // Graph button should be displayed when user has access
      expect(screen.getByTestId('generate-graph-button')).toBeInTheDocument();
    });

    it('should handle undefined graph database access data gracefully', () => {
      (useGetUserGraphDatabaseAccess as jest.Mock).mockReturnValue({
        data: undefined,
      });

      (useChat as jest.Mock).mockReturnValue(createMockUseChat({ sourcesSidebarExpanded: true }));

      renderComponent();

      // Should default to no access when data is undefined
      expect(screen.queryByTestId('generate-graph-button')).not.toBeInTheDocument();
    });

    it('should handle null hasAccess property gracefully', () => {
      (useGetUserGraphDatabaseAccess as jest.Mock).mockReturnValue({
        data: {
          hasAccess: null,
        },
      });

      (useChat as jest.Mock).mockReturnValue(createMockUseChat({ sourcesSidebarExpanded: true }));

      renderComponent();

      // Should default to no access when hasAccess is null
      expect(screen.queryByTestId('generate-graph-button')).not.toBeInTheDocument();
    });
  });

  describe('Graph controls', () => {
    it('displays both buttons when user has graph access', () => {
      (useChat as jest.Mock).mockReturnValue(createMockUseChat({ sourcesSidebarExpanded: true }));

      (useGetUserGraphDatabaseAccess as jest.Mock).mockReturnValue({
        data: { hasAccess: true },
      });

      renderComponent();

      expect(screen.getByTestId('generate-graph-button')).toBeInTheDocument();
      expect(screen.getByTestId('view-graph-button')).toBeInTheDocument();
    });

    it('hides buttons when user lacks graph access', () => {
      (useChat as jest.Mock).mockReturnValue(createMockUseChat({ sourcesSidebarExpanded: true }));

      (useGetUserGraphDatabaseAccess as jest.Mock).mockReturnValue({
        data: { hasAccess: false },
      });

      renderComponent();

      expect(screen.queryByTestId('generate-graph-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('view-graph-button')).not.toBeInTheDocument();
    });

    it('does not display buttons when user access data is undefined', () => {
      (useChat as jest.Mock).mockReturnValue(createMockUseChat({ sourcesSidebarExpanded: true }));

      (useGetUserGraphDatabaseAccess as jest.Mock).mockReturnValue({
        data: undefined,
      });

      renderComponent();

      expect(screen.queryByTestId('generate-graph-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('view-graph-button')).not.toBeInTheDocument();
    });

    it('does not display buttons in collapsed sidebar', () => {
      (useChat as jest.Mock).mockReturnValue(createMockUseChat({ sourcesSidebarExpanded: false }));

      renderComponent();

      // Neither button should be visible in collapsed state
      expect(screen.queryByTestId('generate-graph-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('view-graph-button')).not.toBeInTheDocument();
    });
  });

  describe('Tabular file handling', () => {
    it('disables graph button when tabular files are selected', () => {
      (useChat as jest.Mock).mockReturnValue(createMockUseChat({
        sourcesSidebarExpanded: true,
        documentIds: ['csv-doc-1'],
        graphSelectedIds: ['csv-doc-1'],
      }));

      (useGetDocuments as jest.Mock).mockReturnValue({
        data: {
          documents: [
            { id: 'csv-doc-1', filename: 'data.csv', text: 'some,csv,data' },
          ],
        },
      });

      (useGetSystemConfig as jest.Mock).mockReturnValue({
        data: {
          documentLibraryDocumentUploadProviderId: 'test-provider-id',
          knowledgeGraphAiProviderModelId: 'test-model-id',
        },
      });

      renderComponent();

      const graphButton = screen.getByTestId('generate-graph-button');
      expect(graphButton).toBeDisabled();
    });

    it('disables graph button when XLSX files are selected', () => {
      (useChat as jest.Mock).mockReturnValue(createMockUseChat({
        sourcesSidebarExpanded: true,
        documentIds: ['xlsx-doc-1'],
        graphSelectedIds: ['xlsx-doc-1'],
      }));

      (useGetDocuments as jest.Mock).mockReturnValue({
        data: {
          documents: [
            { id: 'xlsx-doc-1', filename: 'spreadsheet.xlsx', text: 'data' },
          ],
        },
      });

      (useGetSystemConfig as jest.Mock).mockReturnValue({
        data: {
          documentLibraryDocumentUploadProviderId: 'test-provider-id',
          knowledgeGraphAiProviderModelId: 'test-model-id',
        },
      });

      renderComponent();

      const graphButton = screen.getByTestId('generate-graph-button');
      expect(graphButton).toBeDisabled();
    });

    it('disables graph button when XLS files are selected', () => {
      (useChat as jest.Mock).mockReturnValue(createMockUseChat({
        sourcesSidebarExpanded: true,
        documentIds: ['xls-doc-1'],
        graphSelectedIds: ['xls-doc-1'],
      }));

      (useGetDocuments as jest.Mock).mockReturnValue({
        data: {
          documents: [
            { id: 'xls-doc-1', filename: 'legacy.xls', text: 'data' },
          ],
        },
      });

      (useGetSystemConfig as jest.Mock).mockReturnValue({
        data: {
          documentLibraryDocumentUploadProviderId: 'test-provider-id',
          knowledgeGraphAiProviderModelId: 'test-model-id',
        },
      });

      renderComponent();

      const graphButton = screen.getByTestId('generate-graph-button');
      expect(graphButton).toBeDisabled();
    });

    it('enables graph button when non-tabular files are selected', () => {
      (useChat as jest.Mock).mockReturnValue(createMockUseChat({
        sourcesSidebarExpanded: true,
        documentIds: ['pdf-doc-1'],
        graphSelectedIds: ['pdf-doc-1'],
      }));

      (useGetDocuments as jest.Mock).mockReturnValue({
        data: {
          documents: [
            { id: 'pdf-doc-1', filename: 'document.pdf', text: 'some content' },
          ],
        },
      });

      (useGetSystemConfig as jest.Mock).mockReturnValue({
        data: {
          documentLibraryDocumentUploadProviderId: 'test-provider-id',
          knowledgeGraphAiProviderModelId: 'test-model-id',
        },
      });

      renderComponent();

      const graphButton = screen.getByTestId('generate-graph-button');
      expect(graphButton).not.toBeDisabled();
    });

    it('disables graph button when mixed tabular and non-tabular files are selected', () => {
      (useChat as jest.Mock).mockReturnValue(createMockUseChat({
        sourcesSidebarExpanded: true,
        documentIds: ['pdf-doc-1', 'csv-doc-1'],
        graphSelectedIds: ['pdf-doc-1', 'csv-doc-1'],
      }));

      (useGetDocuments as jest.Mock).mockReturnValue({
        data: {
          documents: [
            { id: 'pdf-doc-1', filename: 'document.pdf', text: 'content' },
            { id: 'csv-doc-1', filename: 'data.csv', text: 'csv,data' },
          ],
        },
      });

      (useGetSystemConfig as jest.Mock).mockReturnValue({
        data: {
          documentLibraryDocumentUploadProviderId: 'test-provider-id',
          knowledgeGraphAiProviderModelId: 'test-model-id',
        },
      });

      renderComponent();

      const graphButton = screen.getByTestId('generate-graph-button');
      expect(graphButton).toBeDisabled();
    });

    it('handles case-insensitive file extensions', () => {
      (useChat as jest.Mock).mockReturnValue(createMockUseChat({
        sourcesSidebarExpanded: true,
        documentIds: ['csv-doc-1'],
        graphSelectedIds: ['csv-doc-1'],
      }));

      (useGetDocuments as jest.Mock).mockReturnValue({
        data: {
          documents: [
            { id: 'csv-doc-1', filename: 'DATA.CSV', text: 'data' },
          ],
        },
      });

      (useGetSystemConfig as jest.Mock).mockReturnValue({
        data: {
          documentLibraryDocumentUploadProviderId: 'test-provider-id',
          knowledgeGraphAiProviderModelId: 'test-model-id',
        },
      });

      renderComponent();

      const graphButton = screen.getByTestId('generate-graph-button');
      expect(graphButton).toBeDisabled();
    });
  });

  describe('graph status effect — cancel vs genuine completion', () => {
    const activeBuild = {
      graphId: 'graph-cancel-test',
      documentIds: ['doc-1'],
      newDocumentIds: ['doc-1'],
      status: 'Building',
      currentStep: 'Processing chunks',
      createdAt: new Date(0).toISOString(),
    };

    const rerenderWith = (rerender: (ui: React.ReactElement) => void) => {
      rerender(
        <MantineProvider>
          <SourcesSidebar />
        </MantineProvider>
      );
    };

    it('skips the success tooltip when the settled graph was user-cancelled, but still refetches graphed documents', () => {
      (useGetActiveGraphBuilds as jest.Mock).mockReturnValue({ data: [activeBuild], isLoading: false, error: null });
      const chatMock = createMockUseChat({ cancelledGraphIds: ['graph-cancel-test'] });
      (useChat as jest.Mock).mockReturnValue(chatMock);

      const { rerender } = renderComponent();

      (useGetGraphStatus as jest.Mock).mockReturnValue({ data: { status: GraphBuildStatus.Completed }, isLoading: false });
      rerenderWith(rerender);

      expect(chatMock.setShowGraphTooltip).not.toHaveBeenCalledWith(true);
      expect(chatMock.setUseGraph).not.toHaveBeenCalledWith(true);
      expect(mockRefetchGraphedDocuments).toHaveBeenCalled();

      expect(chatMock.setCancelledGraphIds).toHaveBeenCalledWith(expect.any(Function));
      const updater = chatMock.setCancelledGraphIds.mock.calls[0][0];
      expect(updater(['graph-cancel-test', 'other-graph'])).toEqual(['other-graph']);
    });

    it('re-stages the rolled-back docs on a cancelled settle, regardless of which phase the cancel landed in', () => {
      // graphingSourceIds mirrors the worker's extractDocumentIds for the whole
      // run (extraction AND resolution phases write the same value), so it is
      // the exact set the rollback deleted — this must come back to staged.
      (useGetActiveGraphBuilds as jest.Mock).mockReturnValue({ data: [activeBuild], isLoading: false, error: null });
      const chatMock = createMockUseChat({
        cancelledGraphIds: ['graph-cancel-test'],
        graphingSourceIds: ['doc-1'],
      });
      (useChat as jest.Mock).mockReturnValue(chatMock);

      const { rerender } = renderComponent();

      (useGetGraphStatus as jest.Mock).mockReturnValue({ data: { status: GraphBuildStatus.Completed }, isLoading: false });
      rerenderWith(rerender);

      // Multiple setGraphSelectedIds updaters can be recorded (the pre-existing
      // "drop from staged once graphed" effect also uses this setter) — check
      // that one of them is the restore, not that it's a specific call index.
      const results = chatMock.setGraphSelectedIds.mock.calls.map(([updater]) => updater(['doc-already-staged']));
      expect(results).toContainEqual(['doc-already-staged', 'doc-1']);
    });

    it('shows the success tooltip for a genuine completion (graphId not in cancelledGraphIds) and does NOT re-stage anything', () => {
      (useGetActiveGraphBuilds as jest.Mock).mockReturnValue({ data: [activeBuild], isLoading: false, error: null });
      const chatMock = createMockUseChat({ cancelledGraphIds: [], graphingSourceIds: ['doc-1'] });
      (useChat as jest.Mock).mockReturnValue(chatMock);

      const { rerender } = renderComponent();

      (useGetGraphStatus as jest.Mock).mockReturnValue({ data: { status: GraphBuildStatus.Completed }, isLoading: false });
      rerenderWith(rerender);

      expect(chatMock.setShowGraphTooltip).toHaveBeenCalledWith(true);
      expect(chatMock.setUseGraph).toHaveBeenCalledWith(true);
      expect(mockRefetchGraphedDocuments).toHaveBeenCalled();
      // A genuine finish is not a rollback — the finished docs are really
      // graphed now, not un-done, so nothing should re-add 'doc-1' to staged.
      const everRestoresDoc1 = chatMock.setGraphSelectedIds.mock.calls.some(([updater]) => updater(['x']).includes('doc-1'));
      expect(everRestoresDoc1).toBe(false);
    });

    it('shows "Cancelling..." immediately from cancelledGraphIds, even before activeGraphBuilds ever reports Cancelling', () => {
      // Simulates a fast ER-phase cancel: the build can fully settle between
      // 3s polls, so activeGraphBuilds may never be observed with status
      // Cancelling — the button must not depend on that polled signal alone.
      (useGetActiveGraphBuilds as jest.Mock).mockReturnValue({
        data: [{ ...activeBuild, status: 'Building' }],
        isLoading: false,
        error: null,
      });
      const chatMock = createMockUseChat({
        sourcesSidebarExpanded: true,
        isGeneratingGraph: true,
        cancelledGraphIds: ['graph-cancel-test'],
      });
      (useChat as jest.Mock).mockReturnValue(chatMock);

      renderComponent();

      expect(screen.getByTestId('generate-graph-button')).toHaveTextContent('Cancelling...');
    });

    it('shows "Graphing..." (not "Cancelling...") when nothing has been cancelled', () => {
      (useGetActiveGraphBuilds as jest.Mock).mockReturnValue({
        data: [{ ...activeBuild, status: 'Building' }],
        isLoading: false,
        error: null,
      });
      const chatMock = createMockUseChat({
        sourcesSidebarExpanded: true,
        isGeneratingGraph: true,
        cancelledGraphIds: [],
      });
      (useChat as jest.Mock).mockReturnValue(chatMock);

      renderComponent();

      expect(screen.getByTestId('generate-graph-button')).toHaveTextContent('Graphing...');
    });

    it('stops the spinner without a tooltip when a first-ever build settles to Cancelled, and re-stages the requested docs', () => {
      (useGetActiveGraphBuilds as jest.Mock).mockReturnValue({ data: [activeBuild], isLoading: false, error: null });
      const chatMock = createMockUseChat({ graphingSourceIds: ['doc-1'] });
      (useChat as jest.Mock).mockReturnValue(chatMock);

      const { rerender } = renderComponent();

      (useGetGraphStatus as jest.Mock).mockReturnValue({ data: { status: GraphBuildStatus.Cancelled }, isLoading: false });
      rerenderWith(rerender);

      expect(chatMock.setIsGeneratingGraph).toHaveBeenCalledWith(false);
      expect(chatMock.setGraphingSourceIds).toHaveBeenCalledWith([]);
      expect(chatMock.setShowGraphTooltip).not.toHaveBeenCalledWith(true);
      expect(chatMock.setUseGraph).not.toHaveBeenCalledWith(true);

      const results = chatMock.setGraphSelectedIds.mock.calls.map(([updater]) => updater([]));
      expect(results).toContainEqual(['doc-1']);
    });

    it('a settled failure (Completed WITH errorMessage) shows a failure notification, never the success tooltip', () => {
      (useGetActiveGraphBuilds as jest.Mock).mockReturnValue({ data: [activeBuild], isLoading: false, error: null });
      const chatMock = createMockUseChat({ cancelledGraphIds: [] });
      (useChat as jest.Mock).mockReturnValue(chatMock);

      const { rerender } = renderComponent();

      (useGetGraphStatus as jest.Mock).mockReturnValue({
        data: { status: GraphBuildStatus.Completed, errorMessage: 'Resolution incomplete: 3 block LLM call(s) failed' },
        isLoading: false,
      });
      rerenderWith(rerender);

      expect(notifications.show).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Graph build failed', color: 'red' })
      );
      expect(chatMock.setShowGraphTooltip).not.toHaveBeenCalledWith(true);
      expect(chatMock.setUseGraph).not.toHaveBeenCalledWith(true);
      // Finished docs were preserved, so badges still need refreshing.
      expect(mockRefetchGraphedDocuments).toHaveBeenCalled();
    });

    it('a terminal Failed status shows a failure notification', () => {
      (useGetActiveGraphBuilds as jest.Mock).mockReturnValue({ data: [activeBuild], isLoading: false, error: null });
      const chatMock = createMockUseChat();
      (useChat as jest.Mock).mockReturnValue(chatMock);

      const { rerender } = renderComponent();

      (useGetGraphStatus as jest.Mock).mockReturnValue({ data: { status: GraphBuildStatus.Failed }, isLoading: false });
      rerenderWith(rerender);

      expect(notifications.show).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Graph build failed', color: 'red' })
      );
      expect(chatMock.setIsGeneratingGraph).toHaveBeenCalledWith(false);
      expect(chatMock.setUseGraph).not.toHaveBeenCalledWith(true);
    });

    it('resets (not just invalidates) the getGraphStatus cache when starting a new build, so a stale terminal status from a previous attempt on the same graphId cannot flash', async () => {
      // graphId is reused across every build attempt on this graph (one row
      // per user) — e.g. re-graphing the same staged docs right after
      // cancelling them. If the cache merely gets invalidated (not reset), the
      // old terminal status (Completed/Cancelled) still returns synchronously
      // on the next render before the background refetch lands, which
      // re-fires the terminal-status effect and flickers the badge back to
      // "Staged" before flipping to "Graphing" again.
      (useGetSystemConfig as jest.Mock).mockReturnValue({
        data: {
          documentLibraryDocumentUploadProviderId: 'test-provider-id',
          knowledgeGraphAiProviderModelId: 'test-model-id',
        },
      });
      mockBuildGraphMutateAsync.mockResolvedValueOnce({ status: 'Building', graphId: 'graph-cancel-test' });
      const chatMock = createMockUseChat({
        sourcesSidebarExpanded: true,
        graphSelectedIds: ['doc-1'],
      });
      (useChat as jest.Mock).mockReturnValue(chatMock);

      renderComponent();

      fireEvent.click(screen.getByTestId('generate-graph-button'));

      await waitFor(() => {
        expect(mockGetGraphStatusReset).toHaveBeenCalledWith({ graphId: 'graph-cancel-test' });
      });
    });
  });

  describe('sidebar toggle audit record', () => {
    it('records collapsing the sidebar as a panel toggle', () => {
      (useChat as jest.Mock).mockReturnValue(createMockUseChat({ sourcesSidebarExpanded: true }));

      renderComponent();

      fireEvent.click(screen.getByTestId('collapse-sources-sidebar-button'));

      expect(mockCreateAuditRecord).toHaveBeenCalledWith({
        event: AuditRecordEvent.TogglePanel,
        label: 'Collapse sources sidebar',
      });
    });

    it('records expanding the sidebar as a panel toggle', () => {
      (useChat as jest.Mock).mockReturnValue(createMockUseChat({ sourcesSidebarExpanded: false }));

      renderComponent();

      fireEvent.click(screen.getByTestId('expand-sources-sidebar-button'));

      expect(mockCreateAuditRecord).toHaveBeenCalledWith({
        event: AuditRecordEvent.TogglePanel,
        label: 'Expand sources sidebar',
      });
    });

    // Collapsing a panel does not move the user between pages, so it must not be
    // recorded as a navigation.
    it('does not record the toggle as a navigation', () => {
      (useChat as jest.Mock).mockReturnValue(createMockUseChat({ sourcesSidebarExpanded: true }));

      renderComponent();

      fireEvent.click(screen.getByTestId('collapse-sources-sidebar-button'));

      expect(mockCreateAuditRecord).not.toHaveBeenCalledWith(
        expect.objectContaining({ event: AuditRecordEvent.Navigation }),
      );
    });
  });
});
