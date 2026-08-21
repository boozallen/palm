/**
 * Deterministic extraction of write-time graph citations from the agent's final answer.
 *
 * The agent cites graph evidence inline via short handles at three granularities: entities/concepts
 * as `[[E#]]`, relationships as `[[R#]]`, and whole retrievals as `[[Q#]]`. `handle_map` (built by
 * the LangGraph dispatchers as tool results arrive) maps each handle to a node UUID (`E#`), a
 * `(src, relType, tgt)` triple (`R#`), or a position in `graph_search_results` (`Q#`).
 *
 * This resolves the handles a regex pull, no LLM. A handle absent from the map is DROPPED, never
 * fabricated into an id (CLAUDE.md §9 — no synthetic ids). A cited `R#` implies its two endpoint
 * nodes, so both are added to `citedNodeIds` (an edge must never reference an absent node). A cited
 * `Q#` resolves to a retrieval index (`citedQueryIndices`) that the worker expands into the whole
 * result's node/edge mappings. The markers are stripped from `cleanedText` so the displayed/
 * persisted answer stays clean.
 */

export type CitedEdge = { src: string; relType: string; tgt: string };

/**
 * Maps a citation handle to a node UUID (`E#`), a relationship triple (`R#`), or a
 * `graph_search_results` index (`Q#`). Routing is by handle PREFIX, not value shape.
 */
export type HandleMap = Record<string, string | CitedEdge | number>;

export interface GraphCitations {
  citedNodeIds: string[];
  citedEdges: CitedEdge[];
  /** Indices into `graph_search_results` for retrievals the answer cites wholesale (`[[Q#]]`). */
  citedQueryIndices: number[];
  cleanedText: string;
}

// Capturing form drives extraction: group 1 is the handle (E#/R#/Q#); group 2 is the OPTIONAL cited
// text span an entity handle may carry inline (`[[E4:Comprehensive Fleet Management]]`, no brackets
// in the span). The span is render-only — it never affects which ids/edges are cited (those route off
// the handle prefix in group 1). Kept in lockstep with the renderer's copy in remarkGraphCitations.ts.
const CITATION_RE = /\[\[(E\d+|R\d+|Q\d+)(?::([^\][]+))?\]\]/g;
// Cleanup form (captures the leading space/tab + optional span): removing an inline marker eats one
// leading space so it doesn't leave a double space (newlines preserved). A span marker collapses to
// its span text (the entity name survives in the persisted/displayed answer); a handle-only marker is
// dropped entirely. Kept in lockstep with CITATION_RE above.
const STRIP_RE = /([ \t]?)\[\[(?:E\d+|R\d+|Q\d+)(?::([^\][]+))?\]\]/g;
// Defense-in-depth: after the valid single handles are stripped, any remaining `[[…]]` token is a
// citation the model malformed — a range `[[R1-R20]]` or list `[[E1, E2]]` that no single-handle
// pattern matches. Citation syntax is the only producer of `[[…]]` in an answer, so drop the
// leftover (eating one leading space) rather than letting it render as literal text.
const MALFORMED_CITATION_STRIP_RE = /[ \t]?\[\[[^\][]*\]\]/g;

function isCitedEdge(value: unknown): value is CitedEdge {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as CitedEdge).src === 'string' &&
    typeof (value as CitedEdge).relType === 'string' &&
    typeof (value as CitedEdge).tgt === 'string'
  );
}

export function extractGraphCitationsFromMessage(
  input: string,
  handleMap: HandleMap | null | undefined,
): GraphCitations {
  const map = handleMap ?? {};
  const nodeIds = new Set<string>();
  const edgeKeys = new Set<string>();
  const citedEdges: CitedEdge[] = [];
  const queryIdx = new Set<number>();

  const re = new RegExp(CITATION_RE.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = re.exec(input)) !== null) {
    const handle = match[1]; // e.g. "E12" | "R4" | "Q1"
    const value = map[handle];
    if (value === undefined) {
      continue; // hallucinated / garbled handle — drop, never synthesize an id
    }
    // Branch on the handle PREFIX, not the value shape: each granularity has a distinct value
    // type (E# -> string, R# -> triple, Q# -> number) and a value is only read for its prefix.
    if (handle[0] === 'E') {
      if (typeof value === 'string' && value) {
        nodeIds.add(value);
      }
    } else if (handle[0] === 'R') {
      if (isCitedEdge(value)) {
        const key = `${value.src}|${value.relType}|${value.tgt}`;
        if (!edgeKeys.has(key)) {
          edgeKeys.add(key);
          citedEdges.push({ src: value.src, relType: value.relType, tgt: value.tgt });
        }
        // A cited edge implies its endpoints — the build query needs both to render the edge.
        nodeIds.add(value.src);
        nodeIds.add(value.tgt);
      }
    } else if (handle[0] === 'Q') {
      if (typeof value === 'number' && Number.isInteger(value)) {
        queryIdx.add(value);
      }
    }
  }

  // Drop each marker, but keep an entity span's text (with its original leading space) so the
  // persisted/displayed answer reads naturally; a handle-only marker is removed with its leading
  // space. Then strip any malformed leftovers and trim.
  const cleanedText = input
    .replace(STRIP_RE, (_match, lead: string, span?: string) =>
      span !== undefined ? `${lead}${span}` : '',
    )
    .replace(MALFORMED_CITATION_STRIP_RE, '')
    .trim();

  return {
    citedNodeIds: Array.from(nodeIds),
    citedEdges,
    citedQueryIndices: Array.from(queryIdx),
    cleanedText,
  };
}

/**
 * Resolve a SINGLE citation handle to the graph elements it cites — the per-anchor companion to
 * {@link extractGraphCitationsFromMessage}, used at render time when a reader hovers/pins one inline
 * citation. Same prefix-routed contract: `E#` → its node UUID; `R#` → the relationship triple PLUS
 * both endpoint UUIDs (an edge implies its endpoints). `Q#` (whole retrieval) needs the message's
 * `graphSearchResult` to expand, which this pure helper doesn't hold → returns empty (MVP). A handle
 * absent from / mistyped in the map resolves to nothing — never a synthetic id (CLAUDE.md §9).
 */
export function resolveCitationHandle(
  handle: string,
  handleMap: HandleMap | null | undefined,
): { nodeUuids: string[]; edges: CitedEdge[] } {
  const value = (handleMap ?? {})[handle];
  if (value === undefined) {
    return { nodeUuids: [], edges: [] };
  }
  if (handle[0] === 'E') {
    if (typeof value === 'string' && value) {
      return { nodeUuids: [value], edges: [] };
    }
  } else if (handle[0] === 'R') {
    if (isCitedEdge(value)) {
      return {
        nodeUuids: [value.src, value.tgt],
        edges: [{ src: value.src, relType: value.relType, tgt: value.tgt }],
      };
    }
  }
  return { nodeUuids: [], edges: [] };
}

/**
 * The single graph element a citation points at, for the inspect/pin remote-control: a node (`E#`)
 * or a relationship (`R#`). The graph canvas resolves this UUID-space target to the rendered
 * node/edge and drives its existing hover (inspect) / right-click (pin) behavior with it.
 */
export type GraphCitationTarget = { nodeUuid?: string; edge?: CitedEdge };

/**
 * Collapse a handle to the ONE element a citation inspects/pins: the relationship for `R#`, otherwise
 * the node for `E#`. `Q#` and unresolvable handles → null (nothing to inspect). Mirrors how the canvas
 * treats a single node or a single edge — a citation is just a remote pointer to one of them.
 */
export function resolveCitationTarget(
  handle: string,
  handleMap: HandleMap | null | undefined,
): GraphCitationTarget | null {
  const { nodeUuids, edges } = resolveCitationHandle(handle, handleMap);
  if (edges.length > 0) {
    return { edge: edges[0] };
  }
  if (nodeUuids.length > 0) {
    return { nodeUuid: nodeUuids[0] };
  }
  return null;
}

/**
 * Does the cited edge triple's relationship type match a rendered edge's type? The handle map's
 * `relType` is sometimes the GENERIC Neo4j type (e.g. "RELATED") and sometimes the SEMANTIC one
 * (e.g. "USES"); a rendered edge carries the generic at `type` and the semantic at
 * `properties.relationType`. So a cited relationship matches if EITHER side lines up — otherwise a
 * legitimate `[[R#]]` to a visible edge (generic "RELATED" handle vs semantic "USES" edge) is missed.
 */
export function relationshipTypeMatches(
  citedRelType: string,
  edge: { type: string; properties?: Record<string, unknown> | null },
): boolean {
  const semanticType = (edge.properties?.relationType as string | undefined) || edge.type;
  return citedRelType === edge.type || citedRelType === semanticType;
}

/** The (subset of the) evidence graph a citation must resolve against: nodes carry their UUID at
 *  `properties.id`; edges carry generic type at `type` and semantic at `properties.relationType`.
 *  Matches the `GraphSearchResultData['graphData']` shape. */
export type CitationGraph = {
  nodes: { id: number; properties?: Record<string, unknown> | null }[];
  edges: { from: number; to: number; type: string; properties?: Record<string, unknown> | null }[];
};

/**
 * Does a citation handle resolve to an element ACTUALLY on the evidence graph? Same node-by-UUID /
 * edge-by-endpoints+relType match the canvas pin uses (relType via {@link relationshipTypeMatches},
 * so a generic "RELATED" handle still matches a semantic "USES" edge). `Q#`/unresolved → false.
 */
export function handleResolvesOnGraph(
  handle: string,
  handleMap: HandleMap | null | undefined,
  graph: CitationGraph | null | undefined,
): boolean {
  if (!graph) {
    return false;
  }
  const target = resolveCitationTarget(handle, handleMap);
  if (!target) {
    return false;
  }
  if (target.nodeUuid) {
    return graph.nodes.some(n => n.properties?.id === target.nodeUuid);
  }
  const { src, relType, tgt } = target.edge!;
  const srcNode = graph.nodes.find(n => n.properties?.id === src);
  const tgtNode = graph.nodes.find(n => n.properties?.id === tgt);
  if (!srcNode || !tgtNode) {
    return false;
  }
  return graph.edges.some(e => {
    const endpointsMatch =
      (e.from === srcNode.id && e.to === tgtNode.id) || (e.from === tgtNode.id && e.to === srcNode.id);
    return endpointsMatch && relationshipTypeMatches(relType, e);
  });
}

/**
 * Filter a handle map to only the handles whose element is present on the evidence graph — so the
 * citation renderer (which draws a marker for every handle in the map) draws a marker ONLY for
 * citations that can actually be acted on (drops `Q#` whole-retrieval and any off-graph handle).
 * Returns the full map unchanged when there's no graph to check against.
 */
export function filterHandlesToGraph(
  handleMap: HandleMap | null | undefined,
  graph: CitationGraph | null | undefined,
): HandleMap {
  const map = handleMap ?? {};
  if (!graph) {
    return map;
  }
  const out: HandleMap = {};
  for (const handle of Object.keys(map)) {
    if (handleResolvesOnGraph(handle, map, graph)) {
      out[handle] = map[handle];
    }
  }
  return out;
}
