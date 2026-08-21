/**
 * Workflow Conversion Utilities
 * Convert between React Flow graph format and workflow JSON definition
 */

import { Node, Edge } from 'reactflow';
import { PrimitiveConfig, PrimitiveType } from '@/features/workflows/types/primitive';
import { PrimitiveNodeData } from '@/features/workflows/components/nodes/PrimitiveNode';
import { getNodeDef } from '@/features/workflows/utils/node-registry';

/**
 * Convert React Flow nodes and edges to workflow primitives array.
 * Each node becomes a PrimitiveConfig; edges determine predecessorIds.
 * Execution order is a topological sort of the DAG.
 * Config is read from node.data.config.
 */
export function graphToWorkflow(
  nodes: Node<PrimitiveNodeData>[],
  edges: Edge[]
): PrimitiveConfig[] {
  const adjacencyMap = new Map<string, string[]>();
  const incomingEdgesMap = new Map<string, Edge[]>();

  edges.forEach((edge) => {
    const targets = adjacencyMap.get(edge.source) || [];
    targets.push(edge.target);
    adjacencyMap.set(edge.source, targets);

    const incoming = incomingEdgesMap.get(edge.target) || [];
    incoming.push(edge);
    incomingEdgesMap.set(edge.target, incoming);
  });

  // Topological sort (DFS post-order, reversed)
  const executionOrder: string[] = [];
  const visited = new Set<string>();

  const visit = (nodeId: string) => {
    if (visited.has(nodeId)) { return; }
    visited.add(nodeId);
    const children = adjacencyMap.get(nodeId) || [];
    children.forEach(visit);
    executionOrder.unshift(nodeId);
  };

  // Start from nodes with no incoming edges
  const nodesWithIncoming = new Set(edges.map((e) => e.target));
  nodes.filter((node) => !nodesWithIncoming.has(node.id)).forEach((node) => visit(node.id));

  // Convert nodes to PrimitiveConfigs in topological order
  const primitives: PrimitiveConfig[] = executionOrder.map((nodeId) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    const primitive: PrimitiveConfig = {
      id: nodeId,
      name: node.data.label,
      type: node.data.type,
      config: (node.data.config as Record<string, unknown>) || {},
      position: node.position ? { x: node.position.x, y: node.position.y } : undefined,
    };

    const predecessorIds = (incomingEdgesMap.get(nodeId) || []).map((e) => e.source);
    if (predecessorIds.length > 0) {
      primitive.predecessorIds = predecessorIds;
    }

    return primitive;
  });

  return primitives;
}

/**
 * Convert workflow primitives array to React Flow nodes and edges.
 * Edges are reconstructed from predecessorIds.
 */
export function workflowToGraph(
  primitives: PrimitiveConfig[]
): { nodes: Node<PrimitiveNodeData>[]; edges: Edge[] } {
  const nodes: Node<PrimitiveNodeData>[] = [];
  const edges: Edge[] = [];
  let yPosition = 20;

  primitives.forEach((primitive) => {
    const def = getNodeDef(primitive.type as PrimitiveType);
    const position = primitive.position || { x: 180, y: yPosition };

    // Merge default config with primitive config, with primitive config taking precedence
    // This ensures temperature, topP, etc. get default values when not specified
    const mergedConfig = { ...def.defaultConfig, ...(primitive.config || {}) };

    nodes.push({
      id: primitive.id,
      type: 'primitive',
      position,
      data: {
        type: primitive.type,
        label: primitive.name,
        icon: def.icon,
        color: def.color,
        config: mergedConfig,
      },
    });

    if (!primitive.position) {
      yPosition += 120;
    }

    // Reconstruct edges from predecessorIds
    if (primitive.predecessorIds && primitive.predecessorIds.length > 0) {
      for (const predId of primitive.predecessorIds) {
        edges.push({
          id: `edge-${predId}-${primitive.id}`,
          source: predId,
          target: primitive.id,
          type: 'default',
        });
      }
    }
  });

  return { nodes, edges };
}

/**
 * Validate that the graph forms a valid workflow
 * - Must have at least one node
 * - Must not have cycles
 */
export function validateWorkflowGraph(
  nodes: Node[],
  edges: Edge[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (nodes.length === 0) {
    errors.push('Workflow must have at least one primitive');
  }

  // Check for cycles using DFS
  const adjacencyMap = new Map<string, string[]>();
  edges.forEach((edge) => {
    const targets = adjacencyMap.get(edge.source) || [];
    targets.push(edge.target);
    adjacencyMap.set(edge.source, targets);
  });

  const visiting = new Set<string>();
  const visited = new Set<string>();

  const hasCycle = (nodeId: string): boolean => {
    if (visiting.has(nodeId)) { return true; }
    if (visited.has(nodeId)) { return false; }

    visiting.add(nodeId);

    const children = adjacencyMap.get(nodeId) || [];
    for (const child of children) {
      if (hasCycle(child)) { return true; }
    }

    visiting.delete(nodeId);
    visited.add(nodeId);
    return false;
  };

  for (const node of nodes) {
    if (hasCycle(node.id)) {
      errors.push('Workflow cannot have cycles');
      break;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
