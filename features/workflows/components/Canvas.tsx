/**
 * Canvas - Main React Flow canvas for visual workflow building
 */

import { useCallback, useState, useEffect, useRef, useMemo } from 'react';
import ReactFlow, {
  Node,
  addEdge,
  Connection,
  Background,
  BackgroundVariant,
  NodeTypes,
  EdgeTypes,
  BezierEdge,
  applyNodeChanges,
  applyEdgeChanges,
  OnMove,
  Viewport,
  ReactFlowInstance,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Box, Center, Stack, Text, ActionIcon, Group, Paper } from '@mantine/core';
import {
  IconHandGrab,
  IconZoomIn,
  IconZoomOut,
  IconFocusCentered,
} from '@tabler/icons-react';

import PrimitiveNode, { PrimitiveNodeData } from '@/features/workflows/components/nodes/PrimitiveNode';
import PrimitiveConfigModal from '@/features/workflows/components/modals/PrimitiveConfigModal';
import { PrimitiveType } from '@/features/workflows/types/primitive';
import { getNodeDef } from '@/features/workflows/utils/node-registry';
import { getPrimitiveLabel } from '@/features/workflows/utils/primitive-helpers';
import { useWorkflowBuilder } from '@/features/workflows/providers/WorkflowBuilderProvider';
import { NodeActionsContext } from '@/features/workflows/components/nodes/NodeActionsContext';
import { useNodeDisplayData } from '@/features/workflows/hooks/useNodeDisplayData';

interface CanvasProps {
  workflowId?: string;
  onSaveNodeConfig?: (nodeId: string, label: string, config: Record<string, unknown>) => Promise<void>;
  executionTrace?: Array<{ primitiveId: string; status: string }>;
  isExecuting?: boolean;
}

const nodeTypes: NodeTypes = {
  primitive: PrimitiveNode,
};

const edgeTypes: EdgeTypes = {
  default: BezierEdge,
};

export default function Canvas({ workflowId, onSaveNodeConfig, executionTrace = [], isExecuting = false }: CanvasProps) {
  const { nodes, edges, viewport, setNodes, setEdges, setViewport } = useWorkflowBuilder();
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node<PrimitiveNodeData> | null>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance<PrimitiveNodeData> | null>(null);
  const hasAppliedInitialViewportRef = useRef(false);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);

  const displayData = useNodeDisplayData(nodes);

  // Create a map of node execution status
  const nodeStatusMap = useMemo(() => {
    const map = new Map<string, string>();
    executionTrace.forEach((trace) => {
      map.set(trace.primitiveId, trace.status);
    });
    return map;
  }, [executionTrace]);

  const generateNodeId = useCallback(() => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    return `node-${timestamp}-${random}`;
  }, []);

  const handleDeleteNode = useCallback((nodeId: string) => {
    setNodes(nds => nds.filter(n => n.id !== nodeId));
    setEdges(eds => {
      const incoming = eds.find(e => e.target === nodeId);
      const outgoing = eds.find(e => e.source === nodeId);
      const remaining = eds.filter(e => e.source !== nodeId && e.target !== nodeId);
      if (incoming && outgoing) {
        return [...remaining, {
          id: `edge-${incoming.source}-${outgoing.target}`,
          source: incoming.source,
          target: outgoing.target,
          type: 'default',
        }];
      }
      return remaining;
    });
  }, [setNodes, setEdges]);

  const handleConfigureNode = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      setSelectedNode(node);
      setConfigModalOpen(true);
    }
  }, [nodes]);

  const handleSaveConfig = (nodeId: string, label: string, config: Record<string, unknown>) => {
    setNodes(nds =>
      nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, label, config } } : n)
    );
  };

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges(eds => addEdge({ ...params, type: 'default' }, eds));
    },
    [setEdges]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow') as PrimitiveType;
      if (!type || !reactFlowInstance) {
        return;
      }

      const nodeId = generateNodeId();
      const def = getNodeDef(type);

      const reactFlowBounds = event.currentTarget.getBoundingClientRect();
      const position = reactFlowInstance.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      const newNode: Node<PrimitiveNodeData> = {
        id: nodeId,
        type: 'primitive',
        position,
        data: {
          type,
          label: getPrimitiveLabel(type),
          icon: def.icon,
          color: def.color,
          config: { ...def.defaultConfig },
        },
      };

      setNodes(nds => nds.concat(newNode));
    },
    [generateNodeId, setNodes, reactFlowInstance]
  );

  const handleZoomIn = useCallback(() => {
    if (reactFlowInstance) {
      reactFlowInstance.zoomIn();
    }
  }, [reactFlowInstance]);

  const handleZoomOut = useCallback(() => {
    if (reactFlowInstance) {
      reactFlowInstance.zoomOut();
    }
  }, [reactFlowInstance]);

  const handleFitView = useCallback(() => {
    if (reactFlowInstance) {
      reactFlowInstance.fitView();
    }
  }, [reactFlowInstance]);

  const onInit = useCallback((instance: ReactFlowInstance<PrimitiveNodeData>) => {
    setReactFlowInstance(instance);
  }, []);

  // Apply the initial viewport once, after both the ReactFlow instance and nodes
  // are available. onInit fires too early (before data loads from localStorage/DB)
  // so the viewport must be applied imperatively here instead.
  useEffect(() => {
    if (!reactFlowInstance || hasAppliedInitialViewportRef.current || nodes.length === 0) {
      return;
    }
    hasAppliedInitialViewportRef.current = true;
    const isDefault = viewport.x === 0 && viewport.y === 0 && viewport.zoom === 0.8;
    if (isDefault) {
      reactFlowInstance.fitView({ padding: 0.1, maxZoom: 1 });
    } else {
      reactFlowInstance.setViewport(viewport);
    }
  }, [reactFlowInstance, nodes, viewport]);

  const onViewportChangeHandler: OnMove = useCallback((_event: MouseEvent | TouchEvent, vp: Viewport) => {
    setViewport(vp);
  }, [setViewport]);

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (isExecuting) {
      setTooltipPosition({ x: event.clientX, y: event.clientY });
    }
  }, [isExecuting]);

  const handleMouseLeave = useCallback(() => {
    setTooltipPosition(null);
  }, []);

  return (
    <NodeActionsContext.Provider value={{ onDelete: handleDeleteNode, onConfigure: handleConfigureNode, displayData, nodeStatusMap, isExecuting, isConfigPanelOpen: configModalOpen }}>
      <Box style={{ flex: 1, height: '100%', position: 'relative' }}>
        <style>{'.react-flow__attribution { display: none; }'}</style>
        {nodes.length === 0 && (
          <Center style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }}>
            <Stack align='center' spacing='sm'>
              <IconHandGrab size={56} color='var(--mantine-color-dark-4)' strokeWidth={1.5} />
              <Text size='xl' c='gray.4' fw={600} data-testid='empty-state-title'>
                Create a workflow
              </Text>
              <Text size='md' c='gray.2' fw={500} data-testid='empty-state-description'>
                Drag nodes here or generate a workflow to get started
              </Text>
            </Stack>
          </Center>
        )}

        {selectedNode && (
          <PrimitiveConfigModal
            key={selectedNode.id}
            opened={configModalOpen}
            onClose={() => setConfigModalOpen(false)}
            nodeId={selectedNode.id}
            nodeType={selectedNode.data.type}
            nodeLabel={selectedNode.data.label}
            currentConfig={selectedNode.data.config || {}}
            onSave={handleSaveConfig}
            workflowId={workflowId}
            onSaveToDatabase={onSaveNodeConfig}
          />
        )}

        <Box
          style={{ height: '100%', width: '100%', position: 'relative' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={(changes) => {
              setNodes(applyNodeChanges(changes, nodes));
            }}
            onEdgesChange={(changes) => {
              setEdges(applyEdgeChanges(changes, edges));
            }}
            onConnect={onConnect}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onInit={onInit}
            onMove={onViewportChangeHandler}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            minZoom={0.1}
            maxZoom={2}
            deleteKeyCode={['Delete', 'Backspace']}
            nodesDraggable={!isExecuting}
            nodesConnectable={!isExecuting}
            elementsSelectable={!isExecuting}
            style={{
              background: 'var(--mantine-color-dark-7)',
              height: '100%',
              width: '100%',
            }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={4}
              color='var(--mantine-color-dark-4)'
            />
          </ReactFlow>

          {/* Cursor-following tooltip */}
          {isExecuting && tooltipPosition && (
            <Box
              style={{
                position: 'fixed',
                left: tooltipPosition.x + 10,
                top: tooltipPosition.y + 10,
                zIndex: 10000,
                pointerEvents: 'none',
                backgroundColor: '#FAB005',
                color: '#000',
                padding: '8px 14px',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 500,
                border: '1px solid #4F545F',
                whiteSpace: 'nowrap',
              }}
            >
              Editing is disabled while workflow is running
            </Box>
          )}
        </Box>

        <Paper
          shadow='xl'
          p='xs'
          bg='dark.7'
          style={{
            position: 'absolute',
            bottom: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            backdropFilter: 'blur(12px)',
            border: '1px solid var(--mantine-color-dark-5)',
            borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.3)',
          }}
        >
          <Group spacing='xs'>
            <ActionIcon
              variant='subtle'
              onClick={handleZoomOut}
              size='md'
              c='gray.4'
              sx={(theme) => ({
                '&:hover': {
                  backgroundColor: theme.colors.dark[5],
                  color: theme.colors.gray[2],
                },
              })}
            >
              <IconZoomOut size={16} />
            </ActionIcon>
            <ActionIcon
              variant='subtle'
              onClick={handleFitView}
              size='md'
              c='gray.4'
              sx={(theme) => ({
                '&:hover': {
                  backgroundColor: theme.colors.dark[5],
                  color: theme.colors.gray[2],
                },
              })}
            >
              <IconFocusCentered size={16} />
            </ActionIcon>
            <ActionIcon
              variant='subtle'
              onClick={handleZoomIn}
              size='md'
              c='gray.4'
              sx={(theme) => ({
                '&:hover': {
                  backgroundColor: theme.colors.dark[5],
                  color: theme.colors.gray[2],
                },
              })}
            >
              <IconZoomIn size={16} />
            </ActionIcon>
          </Group>
        </Paper>
      </Box>
    </NodeActionsContext.Provider>
  );
}
