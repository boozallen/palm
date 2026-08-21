import { getGraphDatabaseSource } from '@/features/graph-database';
import { logger } from '@/server/logger';

/**
 * Result from executing a Cypher query
 */
export interface CypherExecutionResult {
  results: Record<string, unknown>[];
  rowCount: number;
  executionTimeMs: number;
  error?: string;
}

/**
 * Result from security validation
 */
export interface SecurityValidation {
  valid: boolean;
  reason?: string;
}

/**
 * Result from parsing LLM response for Cypher
 */
export interface ParsedCypherResponse {
  cypher: string;
  suggestedFormat: 'table' | 'prose';
}

const FORBIDDEN_LABELS = ['chat', 'message', 'artifact'];
export const FORBIDDEN_REL_TYPES = ['REFERENCED', 'IN_CHAT', 'PRODUCED'] as const;
export const MATCH_CLAUSE_PATTERN = /\b(?:optional\s+)?match\b([\s\S]*?)(?=\b(?:where|with|return|unwind|call|optional\s+match|match)\b|$)/gi;
export const VARIABLE_LENGTH_RELATIONSHIP_PATTERN = /<?-\s*\[[^\]]*\*[^\]]*\]\s*-(?:>)?/g;
const FORBIDDEN_RELATIONSHIP_GUARD_PATTERN = /\bnone\s*\((?:[^()]|\([^()]*\))*\)/gi;
const INTROSPECTION_OPERAND_PATTERN = '(?:\\[[^\\]]*\\]|\'(?:[^\']|\'\')*\'|"(?:[^"]|"")*")';

function getGuardedPathVariable(predicate: string): string | null {
  const guardMatch = predicate.match(
    /^none\s*\(\s*([a-z_][a-z0-9_]*)\s+in\s+relationships\s*\(\s*([a-z_][a-z0-9_]*)\s*\)\s+where\s+type\s*\(\s*\1\s*\)\s+in\s*\[([^\]]*)\]\s*\)$/i,
  );
  if (!guardMatch) {
    return null;
  }

  const relationshipTypes = guardMatch[3].split(',').map((entry) => {
    const quotedEntry = entry.trim().match(/^(['"])([a-z_][a-z0-9_]*)\1$/i);
    return quotedEntry?.[2].toLowerCase() ?? null;
  });
  if (relationshipTypes.some((relationshipType) => relationshipType === null)) {
    return null;
  }

  const relationshipTypeSet = new Set(relationshipTypes);
  const hasExactDenylist = FORBIDDEN_REL_TYPES.every((relationshipType) =>
    relationshipTypeSet.has(relationshipType.toLowerCase()),
  );

  return hasExactDenylist ? guardMatch[2].toLowerCase() : null;
}

function getCypherOutsideForbiddenRelationshipGuards(cypher: string): string {
  return cypher.replace(
    FORBIDDEN_RELATIONSHIP_GUARD_PATTERN,
    (predicate) => getGuardedPathVariable(predicate) ? '' : predicate,
  );
}

function getForbiddenIntrospectionType(
  cypher: string,
  functionName: 'labels' | 'type',
  forbiddenTypes: string[],
): string | null {
  const functionCallPattern = new RegExp(`\\b${functionName}\\s*\\([^()]*\\)`, 'gi');

  for (const functionCall of cypher.matchAll(functionCallPattern)) {
    const functionStart = functionCall.index;
    const functionEnd = functionStart + functionCall[0].length;
    const beforeFunction = cypher.slice(0, functionStart);
    const afterFunction = cypher.slice(functionEnd);
    const operands: string[] = [];
    const beforeComparison = beforeFunction.match(
      new RegExp(`(${INTROSPECTION_OPERAND_PATTERN})\\s*(?:(?:not\\s+)?in|=|<>|!=)\\s*$`, 'i'),
    );
    const afterComparison = afterFunction.match(
      new RegExp(`^\\s*(?:(?:not\\s+)?in|=|<>|!=|contains)\\s*(${INTROSPECTION_OPERAND_PATTERN})`, 'i'),
    );

    if (beforeComparison) {
      operands.push(beforeComparison[1]);
    }
    if (afterComparison) {
      operands.push(afterComparison[1]);
    }

    const collectionBinding = beforeFunction.match(
      /(?:\b(?:all|any|none|single)\s*\(|\[)\s*([a-z_][a-z0-9_]*)\s+in\s*$/i,
    );
    if (collectionBinding) {
      const variableName = collectionBinding[1];
      const predicateComparison = afterFunction.match(new RegExp(
        `^\\s+where\\s+(?:${variableName}\\s*(?:(?:not\\s+)?in|=|<>|!=)\\s*(${INTROSPECTION_OPERAND_PATTERN})|(${INTROSPECTION_OPERAND_PATTERN})\\s*(?:(?:not\\s+)?in|=|<>|!=)\\s*${variableName})`,
        'i',
      ));
      if (predicateComparison?.[1]) {
        operands.push(predicateComparison[1]);
      }
      if (predicateComparison?.[2]) {
        operands.push(predicateComparison[2]);
      }
    }

    for (const operand of operands) {
      for (const literal of operand.matchAll(/(['"])([a-z_][a-z0-9_]*)\1/gi)) {
        const introspectedType = literal[2].toLowerCase();
        if (forbiddenTypes.includes(introspectedType)) {
          return introspectedType;
        }
      }
    }
  }

  return null;
}

function getGuardedPathVariables(cypher: string): Set<string> {
  const pathVariables = new Set<string>();
  for (const guard of cypher.match(FORBIDDEN_RELATIONSHIP_GUARD_PATTERN) ?? []) {
    const pathVariable = getGuardedPathVariable(guard);
    if (pathVariable) {
      pathVariables.add(pathVariable);
    }
  }
  return pathVariables;
}

function splitTopLevelPatterns(matchClause: string): string[] {
  const patterns: string[] = [];
  let start = 0;
  let parenthesisDepth = 0;
  let bracketDepth = 0;
  let braceDepth = 0;

  for (let index = 0; index < matchClause.length; index += 1) {
    const character = matchClause[index];
    if (character === '(') {
      parenthesisDepth += 1;
    } else if (character === ')') {
      parenthesisDepth -= 1;
    } else if (character === '[') {
      bracketDepth += 1;
    } else if (character === ']') {
      bracketDepth -= 1;
    } else if (character === '{') {
      braceDepth += 1;
    } else if (character === '}') {
      braceDepth -= 1;
    } else if (
      character === ','
      && parenthesisDepth === 0
      && bracketDepth === 0
      && braceDepth === 0
    ) {
      patterns.push(matchClause.slice(start, index));
      start = index + 1;
    }
  }

  patterns.push(matchClause.slice(start));
  return patterns;
}

function getVariableLengthPathVariables(cypher: string): Array<string | null> {
  const pathVariables: Array<string | null> = [];

  for (const clauseMatch of cypher.matchAll(MATCH_CLAUSE_PATTERN)) {
    for (const pattern of splitTopLevelPatterns(clauseMatch[1])) {
      const variableLengthRelationships = pattern.match(VARIABLE_LENGTH_RELATIONSHIP_PATTERN);
      if (!variableLengthRelationships) {
        continue;
      }

      const assignment = pattern.match(/^\s*([a-z_][a-z0-9_]*)\s*=/i);
      for (let index = 0; index < variableLengthRelationships.length; index += 1) {
        pathVariables.push(assignment?.[1].toLowerCase() ?? null);
      }
    }
  }

  return pathVariables;
}

/**
 * Validate Cypher query for security requirements.
 * Ensures required filters are present and no write operations.
 *
 * @param cypher - The Cypher query to validate
 * @returns SecurityValidation with valid flag and optional reason
 */
export function validateCypherSecurity(cypher: string): SecurityValidation {
  const lowerCypher = cypher.toLowerCase();

  // SECURITY: Must have documentIds filter
  if (!lowerCypher.includes('$documentids')) {
    return { valid: false, reason: 'Missing $documentIds filter' };
  }

  // SECURITY: Block write operations
  // Strip string literals first to avoid false positives from entity/document names
  // e.g., "process asset library" contains "set" but it's data, not a Cypher keyword
  const cypherWithoutStrings = lowerCypher.replace(/'(?:[^']|'')*'/g, '');
  const writeOps = ['create ', 'merge ', 'set ', 'delete ', 'remove ', 'detach '];
  for (const op of writeOps) {
    if (cypherWithoutStrings.includes(op)) {
      return { valid: false, reason: `Write operation detected: ${op.trim()}` };
    }
  }

  // Keep this rule aligned with the private validator in text2Cypher.ts. Proving
  // that every matched node is scoped requires a full parser; this exact
  // denylist closes the conversation-topology gap without pretending to do so.
  const forbiddenRelationshipTypes = FORBIDDEN_REL_TYPES.map((relationshipType) =>
    relationshipType.toLowerCase(),
  );
  for (const forbiddenType of [...FORBIDDEN_LABELS, ...forbiddenRelationshipTypes]) {
    const typeReference = new RegExp(`:\\s*\`?${forbiddenType}\`?(?![a-z0-9_])`);
    if (typeReference.test(cypherWithoutStrings)) {
      logger.warn('[CYPHER-UTILS] Forbidden graph type referenced', {
        cypher,
        forbiddenType,
      });
      return {
        valid: false,
        reason: `Forbidden graph label or relationship type: ${forbiddenType}`,
      };
    }
  }

  // Inspect only comparison operands attached to labels() / type(). This still
  // blocks dynamic access to forbidden topology without treating an unrelated
  // entity named "message" as a graph label. The exact path denylist required
  // below is the sole exemption because it must name the forbidden rel types.
  const cypherOutsideRelationshipGuards = getCypherOutsideForbiddenRelationshipGuards(lowerCypher);
  const forbiddenIntrospectionType = getForbiddenIntrospectionType(
    cypherOutsideRelationshipGuards,
    'labels',
    FORBIDDEN_LABELS,
  ) ?? getForbiddenIntrospectionType(
    cypherOutsideRelationshipGuards,
    'type',
    forbiddenRelationshipTypes,
  );
  if (forbiddenIntrospectionType) {
    logger.warn('[CYPHER-UTILS] Forbidden graph type introspected', {
      cypher,
      forbiddenType: forbiddenIntrospectionType,
    });
    return {
      valid: false,
      reason: `Forbidden graph label or relationship type: ${forbiddenIntrospectionType}`,
    };
  }

  for (const queryPart of lowerCypher.split(/\bunion(?:\s+all)?\b/)) {
    const pathVariables = getVariableLengthPathVariables(queryPart);
    if (pathVariables.some((pathVariable) => pathVariable === null)) {
      logger.warn('[CYPHER-UTILS] Unguarded variable-length relationship pattern', {
        cypher,
      });
      return {
        valid: false,
        reason: 'Variable-length relationship patterns require a path variable for their forbidden relationship guard',
      };
    }

    const guardedPathVariables = getGuardedPathVariables(queryPart);
    const unguardedPathVariable = pathVariables.find(
      (pathVariable) => pathVariable && !guardedPathVariables.has(pathVariable),
    );
    if (unguardedPathVariable) {
      logger.warn('[CYPHER-UTILS] Unguarded variable-length relationship pattern', {
        cypher,
        pathVariable: unguardedPathVariable,
      });
      return {
        valid: false,
        reason: `Variable-length path ${unguardedPathVariable} must exclude forbidden relationship types with none()`,
      };
    }
  }

  return { valid: true };
}

/**
 * Parse LLM response to extract Cypher query and format suggestion.
 * Handles both JSON responses and raw Cypher fallback.
 *
 * @param response - The raw LLM response text
 * @returns ParsedCypherResponse with cypher and suggestedFormat
 */
export function parseCypherResponse(response: string): ParsedCypherResponse {
  // Strip markdown code blocks if present
  const cleaned = response
    .replace(/```json\n?/gi, '')
    .replace(/```cypher\n?/gi, '')
    .replace(/```\n?/g, '')
    .trim();

  // Extract the first JSON object if the LLM added extra text after it
  const jsonMatch = cleaned.match(/\{[\s\S]*?"cypher"\s*:\s*"[\s\S]*?"\s*(?:,\s*"suggestedFormat"\s*:\s*"[^"]*"\s*)?\}/);

  try {
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
    return {
      cypher: parsed.cypher || cleaned,
      suggestedFormat: parsed.suggestedFormat || 'prose',
    };
  } catch {
    // Fallback: assume it's raw cypher (backward compatibility)
    return {
      cypher: cleaned,
      suggestedFormat: 'prose',
    };
  }
}

/**
 * Fix short search terms (≤3 chars) that use CONTAINS instead of word-boundary regex.
 * Rewrites toLower(x) CONTAINS 'ai' → x =~ '(?i).*\\bai\\b.*' to prevent false substring matches.
 */
export function fixShortTermContains(cypher: string): string {
  return cypher.replace(
    /toLower\(([^)]+)\)\s+CONTAINS\s+'([^']{1,3})'/gi,
    (match, field, term) => {
      // Only fix short terms — leave longer terms as CONTAINS
      if (term.length > 3) {return match;}
      return `${field} =~ '(?i).*\\\\b${term}\\\\b.*'`;
    }
  );
}

/**
 * Execute a Cypher query against Neo4j with proper integer conversion.
 * Wraps graphDb.run with Neo4j Integer to JS number conversion.
 */
export async function executeCypher(
  cypher: string,
  params: { documentIds: string[]; graphEntityIds?: string[] }
): Promise<CypherExecutionResult> {
  const startTime = Date.now();
  try {
    const graphDb = await getGraphDatabaseSource();
    const result = await graphDb.run(cypher, params);

    // GOTCHA: Neo4j integers need .toNumber() conversion
    const results = result.records.map((record) => {
      const obj: Record<string, unknown> = {};
      record.keys.forEach((key) => {
        const keyStr = String(key);
        const value = record.get(keyStr);
        obj[keyStr] = typeof value?.toNumber === 'function' ? value.toNumber() : value;
      });
      return obj;
    });

    return {
      results,
      rowCount: results.length,
      executionTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    logger.error('[CYPHER-UTILS] Query execution failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      cypher: cypher.substring(0, 100),
    });
    return {
      results: [],
      rowCount: 0,
      executionTimeMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Query execution failed',
    };
  }
}

/**
 * Check if an error is a Cypher syntax error that can be retried.
 *
 * @param error - Error message to check
 * @returns true if this is a retryable syntax error
 */
export function isSyntaxError(error: string): boolean {
  return (
    error.includes('SyntaxError') ||
    error.includes('not defined') ||
    error.includes('Invalid input')
  );
}

// ============================================
// Shared Prompt Sections
// ============================================

export const SECURITY_RULES = `
SECURITY RULES (MANDATORY):
1. ALWAYS include: WHERE ... documentId IN $documentIds (and use (n:Document AND n.id IN $documentIds) for Document nodes — they use 'id' instead of 'documentId')
2. These filters MUST be on the first node in the pattern
3. Use the $documentIds parameter - never hardcode values
4. Do NOT add WHERE ... userId = $userId predicates. Authorization is enforced at the route boundary.
`.trim();

export const CYPHER_PITFALLS = `
CYPHER PITFALLS - AVOID THESE MISTAKES:
1. You CANNOT reference an alias in the same WITH clause where it's defined
   BAD:  WITH d.filename as doc, collect(DISTINCT doc) as docs
   GOOD: WITH collect(DISTINCT d.filename) as docs
2. Variables go out of scope after WITH - include them if needed later
   BAD:  MATCH (e:Entity) ... WITH d.filename as doc RETURN e.name  -- e is out of scope!
   GOOD: MATCH (e:Entity) ... WITH e, d.filename as doc RETURN e.name
3. Non-aggregated columns in WITH become grouping keys
   BAD:  MATCH (e:Entity) RETURN e.type, e.name, count(*)  -- groups by BOTH type AND name
   GOOD: MATCH (e:Entity) WITH e.type as type, count(*) as cnt RETURN type, cnt
4. UNION requires identical column names - avoid UNION for multi-count queries
   BAD:  MATCH (e:Entity) RETURN count(e) as entityCount UNION MATCH (c:Concept) RETURN count(c) as conceptCount
   GOOD: MATCH (e:Entity) WITH count(e) as entityCount MATCH (c:Concept) RETURN entityCount, count(c) as conceptCount
5. Multiple CONTAINS on the same field with AND requires ALL substrings present simultaneously
   BAD:  WHERE toLower(e.name) CONTAINS 'a16z' AND toLower(e.name) CONTAINS 'andreessen horowitz'  -- name must contain BOTH at once!
   GOOD: WHERE toLower(e.name) CONTAINS 'a16z' OR toLower(e.name) CONTAINS 'andreessen horowitz'
   Use OR (not AND) when an entity might be known by different names or aliases.
`.trim();

export const QUERY_RULES = `
QUERY RULES:
1. For type/category/relationType: use exact UPPERCASE values from the schema (e.g., e.type = 'PERSON')
2. For name/description matching:
   - Long terms (4+ chars): use toLower() + CONTAINS (e.g., toLower(e.name) CONTAINS 'acme')
   - Short terms (≤3 chars like "ai", "hr", "vr"): use word-boundary regex to avoid false substring matches
     GOOD: e.name =~ '(?i).*\\bai\\b.*' OR e.description =~ '(?i).*\\bai\\b.*'
     BAD:  toLower(e.name) CONTAINS 'ai'  -- matches "said", "air", "obtain"
3. Return meaningful column aliases
4. For counts, use count(DISTINCT x) to avoid duplicates
5. Only READ operations - no CREATE, MERGE, SET, DELETE
6. Never return IDs to the user - return human-readable names instead
7. When returning document information, join to Document node and return d.filename, not documentId
8. When listing entities or concepts, use DISTINCT to avoid duplicates unless user asks about document-level occurrences
`.trim();

export const IDENTITY_RULES = `
IDENTITY RELATIONSHIPS:
- IDENTITY edges link the same entity across documents - do NOT report as a "connection"
- When returning relationships, filter with WHERE type(r) <> 'IDENTITY'
`.trim();
