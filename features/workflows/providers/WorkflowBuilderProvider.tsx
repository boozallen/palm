import { createContext, useContext, useState, ReactNode, useCallback, useRef } from 'react';
import { Node, Edge } from 'reactflow';
import { PrimitiveNodeData } from '@/features/workflows/components/nodes/PrimitiveNode';

interface CanvasState {
  nodes: Node<PrimitiveNodeData>[];
  edges: Edge[];
  viewport: { x: number; y: number; zoom: number };
}

interface WorkflowBuilderContextType {
  nodes: Node<PrimitiveNodeData>[];
  edges: Edge[];
  viewport: { x: number; y: number; zoom: number };
  setNodes: (updater: Node<PrimitiveNodeData>[] | ((prev: Node<PrimitiveNodeData>[]) => Node<PrimitiveNodeData>[])) => void;
  setEdges: (updater: Edge[] | ((prev: Edge[]) => Edge[])) => void;
  setViewport: (viewport: { x: number; y: number; zoom: number }) => void;
  loadFromLocalStorage: (workflowId: string) => void;
  clearLocalStorage: (workflowId: string) => void;
  getCurrentCanvasState: () => { nodes: Node<PrimitiveNodeData>[]; edges: Edge[] };
}

const WorkflowBuilderContext = createContext<WorkflowBuilderContextType | undefined>(undefined);

const getLocalStorageKey = (workflowId: string) => `workflow_canvas_${workflowId}`;

const DEFAULT_VIEWPORT = { x: 0, y: 0, zoom: 0.8 };

export function WorkflowBuilderProvider({ children }: { children: ReactNode }) {
  const [nodesState, setNodesState] = useState<Node<PrimitiveNodeData>[]>([]);
  const [edgesState, setEdgesState] = useState<Edge[]>([]);
  const [viewportState, setViewportState] = useState<{ x: number; y: number; zoom: number }>(DEFAULT_VIEWPORT);
  const [currentWorkflowId, setCurrentWorkflowId] = useState<string | null>(null);

  // Single ref tracking all canvas state for stale-closure-safe localStorage writes
  const canvasStateRef = useRef<CanvasState>({ nodes: [], edges: [], viewport: DEFAULT_VIEWPORT });

  const saveToLocalStorage = useCallback((workflowId: string) => {
    try {
      const { nodes: currentNodes, edges, viewport } = canvasStateRef.current;

      if (!Array.isArray(currentNodes)) {
        return;
      }

      // Strip non-serializable fields (functions, React elements) from node data
      const cleanNodes = currentNodes.map(node => ({
        ...node,
        data: {
          type: node.data.type,
          label: node.data.label,
          color: node.data.color,
          config: node.data.config,
        },
      }));

      localStorage.setItem(
        getLocalStorageKey(workflowId),
        JSON.stringify({ nodes: cleanNodes, edges, viewport, timestamp: Date.now() })
      );
    } catch {
      // Silently ignore localStorage errors (e.g. private browsing quota)
    }
  }, []);

  const setNodes = useCallback((updater: Node<PrimitiveNodeData>[] | ((prev: Node<PrimitiveNodeData>[]) => Node<PrimitiveNodeData>[])) => {
    const next = typeof updater === 'function' ? updater(canvasStateRef.current.nodes) : updater;
    canvasStateRef.current = { ...canvasStateRef.current, nodes: next };
    setNodesState(next);
    if (currentWorkflowId && typeof window !== 'undefined') {
      saveToLocalStorage(currentWorkflowId);
    }
  }, [currentWorkflowId, saveToLocalStorage]);

  const setEdges = useCallback((updater: Edge[] | ((prev: Edge[]) => Edge[])) => {
    const next = typeof updater === 'function' ? updater(canvasStateRef.current.edges) : updater;
    canvasStateRef.current = { ...canvasStateRef.current, edges: next };
    setEdgesState(next);
    if (currentWorkflowId && typeof window !== 'undefined') {
      saveToLocalStorage(currentWorkflowId);
    }
  }, [currentWorkflowId, saveToLocalStorage]);

  const setViewport = useCallback((newViewport: { x: number; y: number; zoom: number }) => {
    canvasStateRef.current = { ...canvasStateRef.current, viewport: newViewport };
    setViewportState(newViewport);
    if (currentWorkflowId && typeof window !== 'undefined') {
      saveToLocalStorage(currentWorkflowId);
    }
  }, [currentWorkflowId, saveToLocalStorage]);

  const loadFromLocalStorage = useCallback((workflowId: string) => {
    if (typeof window === 'undefined') {
      return;
    }

    setCurrentWorkflowId(workflowId);

    try {
      const savedData = localStorage.getItem(getLocalStorageKey(workflowId));
      if (!savedData) {
        return;
      }

      const parsed = JSON.parse(savedData) as {
        nodes?: Node<PrimitiveNodeData>[];
        edges?: Edge[];
        viewport?: { x: number; y: number; zoom: number };
      };

      if (parsed.nodes && Array.isArray(parsed.nodes)) {
        canvasStateRef.current = { ...canvasStateRef.current, nodes: parsed.nodes };
        setNodesState(parsed.nodes);
      }
      if (parsed.edges && Array.isArray(parsed.edges)) {
        canvasStateRef.current = { ...canvasStateRef.current, edges: parsed.edges };
        setEdgesState(parsed.edges);
      }
      if (parsed.viewport && typeof parsed.viewport === 'object') {
        canvasStateRef.current = { ...canvasStateRef.current, viewport: parsed.viewport };
        setViewportState(parsed.viewport);
      }
    } catch {
      // Silently ignore parse errors
    }
  }, []);

  const clearLocalStorage = useCallback((workflowId: string) => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      localStorage.removeItem(getLocalStorageKey(workflowId));
    } catch {
      // Silently ignore
    }
  }, []);

  const getCurrentCanvasState = useCallback(() => {
    return { nodes: canvasStateRef.current.nodes, edges: canvasStateRef.current.edges };
  }, []);

  return (
    <WorkflowBuilderContext.Provider
      value={{
        nodes: nodesState,
        edges: edgesState,
        viewport: viewportState,
        setNodes,
        setEdges,
        setViewport,
        loadFromLocalStorage,
        clearLocalStorage,
        getCurrentCanvasState,
      }}
    >
      {children}
    </WorkflowBuilderContext.Provider>
  );
}

export function useWorkflowBuilder() {
  const context = useContext(WorkflowBuilderContext);
  if (!context) {
    throw new Error('useWorkflowBuilder must be used within WorkflowBuilderProvider');
  }
  return context;
}
