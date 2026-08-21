import type { Entity, Concept, SignalVector } from '@/features/graph-database/types';
import type { ResolutionEdgeName } from '@/features/graph-database/config/storage-model.config';

export interface PromptOptions {
  allowedEdgeTypes: ResolutionEdgeName[];
  worldKnowledgeAllowed: boolean;
  signals: SignalVector;
}

export interface ResolutionResponse {
  decision: ResolutionEdgeName | 'UNRELATED';
  confidence: number;        // 0.0-1.0
  rationale: string;         // Brief explanation
}

/**
 * Type guard to check if a node is a Concept
 * F2.7: Concept Resolution
 */
function isConceptNode(node: Entity | Concept): node is Concept {
  return 'category' in node && !('type' in node);
}

/**
 * Build unified resolution prompt for entity/concept pair
 *
 * Asks LLM to classify relationship in ONE call (not 3 separate prompts)
 * LLM decides edge type based on allowedEdgeTypes
 * F2.7: Extended to support both entities and concepts
 */
export function buildUnifiedPrompt(
  n1: Entity | Concept,
  n2: Entity | Concept,
  options: PromptOptions
): string {
  const { allowedEdgeTypes, worldKnowledgeAllowed, signals } = options;

  // F2.7: Detect what types we're comparing
  const bothConcepts = isConceptNode(n1) && isConceptNode(n2);
  const bothEntities = !isConceptNode(n1) && !isConceptNode(n2);

  // Build edge type definitions with type-specific guidance
  const edgeTypeDefinitions = getEdgeTypeDefinitions(allowedEdgeTypes, bothConcepts, bothEntities);

  // Build world knowledge instructions
  const worldKnowledgeInstr = getWorldKnowledgeInstructions(worldKnowledgeAllowed);

  // Format node context
  const node1Context = formatNodeContext(n1);
  const node2Context = formatNodeContext(n2);

  // Build signal description based on node types
  const signalDescription = formatSignalsForNodeType(signals, bothConcepts, bothEntities);

  return `Analyze the relationship between these two nodes:

${node1Context}

${node2Context}

${signalDescription}

**Task:**
Classify the relationship between these nodes. Choose ONE of the following:

${edgeTypeDefinitions}
- UNRELATED: No meaningful relationship exists

${worldKnowledgeInstr}

**Return your response as JSON:**
{
  "decision": "${allowedEdgeTypes.join('" | "')}" | "UNRELATED",
  "confidence": 0.0-1.0,
  "rationale": "Brief explanation of your decision (1-2 sentences)"
}

**Important:**
- Choose EXACTLY ONE decision
- Confidence should reflect your certainty (0.0 = no confidence, 1.0 = certain)
- Rationale should explain WHY you made this decision
- Return ONLY valid JSON, no additional text`;
}

/**
 * Format node context for prompt
 * F2.7: Extended to support both entities and concepts
 */
export function formatNodeContext(node: Entity | Concept): string {
  if (isConceptNode(node)) {
    return `**Node: "${node.name}"** (CONCEPT: ${node.category})
  Description: ${node.description}
  Category: ${node.category}`;
  } else {
    // Note: context is now per-mention on MENTIONS edge, not on Entity node
    return `**Node: "${node.name}"** (ENTITY: ${node.type})
  Description: ${node.description}
  Aliases: ${node.aliases?.length > 0 ? node.aliases.join(', ') : 'none'}`;
  }
}

/**
 * Get edge type definitions based on allowed types and node types
 * F2.7: Extended with concept-specific guidance
 */
export function getEdgeTypeDefinitions(
  allowedEdgeTypes: ResolutionEdgeName[],
  bothConcepts: boolean,
  bothEntities: boolean
): string {
  // Type-specific definitions
  const conceptDefinitions: Record<ResolutionEdgeName, string> = {
    IDENTITY: '- IDENTITY: These refer to the SAME abstract concept (e.g., "ML" = "Machine Learning")\n  - Different names for the identical abstract idea\n  - Would be used interchangeably in all contexts',
    SIMILAR: '- SIMILAR: These are semantically RELATED but DISTINCT concepts (e.g., "ML" ~ "Deep Learning")\n  - Related but NOT the same\n  - One might be a subcategory, related technique, or complementary idea\n  - High semantic overlap but meaningful distinction',
    RELATED_RESOLUTION: '- RELATED_RESOLUTION: These have a meaningful connection but are clearly different',
  };

  const entityDefinitions: Record<ResolutionEdgeName, string> = {
    IDENTITY: '- IDENTITY: These refer to the SAME real-world entity (e.g., "DHA" = "Defense Health Agency")\n  - Just different names/abbreviations for the same organization/person/thing',
    SIMILAR: '- SIMILAR: These are semantically RELATED but DISTINCT entities',
    RELATED_RESOLUTION: '- RELATED_RESOLUTION: These have a meaningful business relationship (competitor, subsidiary, partner, etc.)\n  - Different entities with a meaningful connection',
  };

  const crossDefinitions: Record<ResolutionEdgeName, string> = {
    IDENTITY: '- IDENTITY: Not applicable for cross-type pairs',
    SIMILAR: '- SIMILAR: Not applicable for cross-type pairs',
    RELATED_RESOLUTION: '- RELATED_RESOLUTION: Entity is associated with the concept\n  - e.g., "AWS" related to "Cloud Computing"\n  - Entity is an example, tool, or implementation of the concept',
  };

  const definitions = bothConcepts ? conceptDefinitions : (bothEntities ? entityDefinitions : crossDefinitions);

  return allowedEdgeTypes
    .map(type => definitions[type])
    .join('\n\n');
}

/**
 * Format signals based on node type
 * F2.7: Concept-specific signal formatting
 */
function formatSignalsForNodeType(
  signals: SignalVector,
  bothConcepts: boolean,
  bothEntities: boolean
): string {
  const baseSignals = `**Pre-computed Similarity Signals:**
- Embedding similarity: ${(signals.embedding_similarity * 100).toFixed(1)}%
- Same main name: ${signals.same_name ? 'YES' : 'NO'}
- Same document: ${signals.same_document ? 'YES' : 'NO'}`;

  if (bothConcepts) {
    // Concepts: No aliases, show category matching
    return `${baseSignals}
- Same category: ${signals.same_type ? 'YES' : 'NO'}`;
  } else if (bothEntities) {
    // Entities: Show full signals with aliases
    return `${baseSignals}
- Same entity type: ${signals.same_type ? 'YES' : 'NO'}
- Name/alias overlap: ${signals.has_name_alias_overlap ? 'YES' : 'NO'}
${signals.sharedNames && signals.sharedNames.length > 0 ? `- Shared names: ${signals.sharedNames.join(', ')}` : ''}`;
  } else {
    // Cross-type: Simple signals
    return `${baseSignals}`;
  }
}

/**
 * Get world knowledge instructions
 */
export function getWorldKnowledgeInstructions(
  worldKnowledgeAllowed: boolean
): string {
  if (worldKnowledgeAllowed) {
    return '**Knowledge Constraint:** You MAY use your knowledge of these entities. If you know additional information about them from your training, you can use that to inform your decision.';
  } else {
    return '**Knowledge Constraint:** Use ONLY the information provided above. Do NOT use external knowledge about these entities. Base your decision solely on the descriptions, aliases, and signals provided.';
  }
}

/**
 * Parse LLM response into structured format
 */
export function parseResolutionResponse(
  response: string
): ResolutionResponse {
  try {
    // Try to extract JSON from the response (in case LLM added extra text)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const json = JSON.parse(jsonMatch[0]);

    // Validate required fields
    if (!json.decision || typeof json.confidence !== 'number' || !json.rationale) {
      throw new Error('Missing required fields in response');
    }

    // Validate decision is valid edge type
    const validDecisions = ['IDENTITY', 'SIMILAR', 'RELATED_RESOLUTION', 'UNRELATED'];
    if (!validDecisions.includes(json.decision)) {
      throw new Error(`Invalid decision: ${json.decision}`);
    }

    // Validate confidence range
    if (json.confidence < 0 || json.confidence > 1) {
      throw new Error(`Invalid confidence: ${json.confidence}`);
    }

    return {
      decision: json.decision,
      confidence: json.confidence,
      rationale: json.rationale,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to parse LLM response: ${errorMessage}\nResponse: ${response}`);
  }
}
