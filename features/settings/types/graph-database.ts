export interface NetworkFilters {
  limit?: number;
  labels?: string[];
  relationships?: string[];
}

export interface GraphNode {
  id: number;
  label: string;
  labels: string[];
  properties: Record<string, any>;
  group: string;
}

export interface GraphEdge {
  from: number;
  to: number;
  label: string;
  type: string;
  properties: Record<string, any>;
}

export interface NetworkResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata: {
    nodeCount: number;
    edgeCount: number;
    limit: number;
    filters: {
      labels: string[];
      relationships: string[];
    };
  };
}

export interface SearchParams {
  query: string;
  allowWrite: boolean;
}

export interface SearchResult {
  results: Record<string, any>[];
  recordCount: number;
  summary: {
    queryType: string;
    executionTime: number;
    counters?: {
      nodesCreated: number;
      nodesDeleted: number;
      relationshipsCreated: number;
      relationshipsDeleted: number;
      propertiesSet: number;
      labelsAdded: number;
      labelsRemoved: number;
    };
  };
}

export interface NodeType {
  labels: string[];
  count: number;
}

export interface RelationshipType {
  type: string;
  count: number;
}

export interface OverviewResult {
  totalNodes: number;
  totalRelationships: number;
  nodeTypes: NodeType[];
  relationshipTypes: RelationshipType[];
}

/**
 * Canonical solicitation document types recognized by the government-pursuit schema.
 * Used to determine whether a document should be processed with the government-pursuit
 * schema vs the general schema during graph extraction.
 */
export const GOVERNMENT_PURSUIT_SCHEMA_TYPES = [
  'SOO',
  'Statement of Objectives',
  'PWS',
  'Performance Work Statement',
  'Draft PWS',
  'Draft Performance Work Statement',
  'Section L',
  'Section M',
  'Announcement',
  'RFI',
  'Request for Information',
  'RFP',
  'Request for Proposal',
  'RFQ',
  'Request for Quote',
  'Q&A',
  'Questions and Answers',
  'Amendment',
  'SLA',
  'Service Level Agreement',
  'QASP',
  'Quality Assurance Surveillance Plan',
  'Reps & Certs',
  'Reps and Certs',
  'Representations & Certifications',
  'Representations and Certifications',
  'GFI',
  'Government Furnished Information',
  'Attachment',
  'Solicitation',
] as const;

/**
 * Normalized set for fast membership checks (lowercase, whitespace-collapsed).
 */
export const GOVERNMENT_PURSUIT_SCHEMA_TYPES_NORMALIZED = new Set(
  GOVERNMENT_PURSUIT_SCHEMA_TYPES.map((type) =>
    type.toLowerCase().replace(/\s+/g, ' ').trim(),
  ),
);
