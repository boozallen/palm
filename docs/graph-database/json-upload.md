# palm-graph JSON Upload

PALM accepts pre-built knowledge graphs as JSON. When a JSON document whose shape matches the palm-graph contract is uploaded and graphed, the graph-build worker writes the entities, relations, and supplementary structure straight into Neo4j without invoking LLM extraction.

This is the fastest path into the graph and the one with the strongest correctness guarantees: you control the entities, IDs, and relation types directly.

## When This Path Is Used

A document is routed to the palm-graph fast path when **both** of these hold:

1. The document's text is valid JSON.
2. The JSON parses successfully against `palmGraphSchema` — i.e. it has the required shape.

If either fails, the worker silently falls through to the standard chunk-and-extract path (chunking + LLM entity extraction). There is no error surfaced to the user today; check worker logs to confirm which path ran. (See "Confirming the Fast Path Ran" below.)

## Detection Is Shape-Based

There is **no magic string** to declare a JSON document as a palm-graph bundle. Detection is purely by structure: an `entities` array of strict-shaped items and a `relations` array of strict-shaped items. The `metadata` field is optional and informational — its contents are not validated and do not affect routing.

This means any tool that can produce a JSON document with the required shape will be ingested via the fast path automatically.

## Required Shape

The top-level object must contain:

| Field | Required | Type | Notes |
|---|---|---|---|
| `entities` | yes | array, length ≥ 1 | Strict per-item shape, see below |
| `relations` | yes | array (may be empty) | Strict per-item shape, see below |
| `supplementary` | no | object | Optional cross-cuts, see below |
| `metadata` | no | object | Informational pass-through; any keys allowed |

Unknown top-level keys are accepted and ignored (forward compatibility).

### `entities[]`

Each entity is a strict object — unknown fields cause parse failure.

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | yes | non-empty string | Stable, unique within the bundle. Used as the `externalId` and as the link target for relations |
| `label` | yes | `'Entity'` or `'Concept'` | Drives the Neo4j node label |
| `type` | yes | non-empty string | Domain type (`'company'`, `'agency'`, `'capability'`, etc.). Free-form string |
| `name` | yes | non-empty string | Display name |
| `description` | no | string \| null | Free-form description |
| `properties` | no | object | Arbitrary key/value pairs. **Keys must match `^[A-Za-z_][A-Za-z0-9_]*$`** (no dots, hyphens, or special characters — Cypher-safe identifier rules) |

### `relations[]`

Each relation is a strict object — unknown fields cause parse failure.

| Field | Required | Type | Notes |
|---|---|---|---|
| `source` | yes | non-empty string | Must match an `entities[].id` in the same bundle |
| `target` | yes | non-empty string | Must match an `entities[].id` in the same bundle |
| `type` | yes | non-empty string | **Must match `^[A-Za-z_][A-Za-z0-9_]*$`** — Cypher relationship type rules. Use `SCREAMING_SNAKE_CASE` (e.g. `HAS_CAPABILITY`, `RELEVANT_TO_AGENCY`). Hyphens are not allowed |
| `properties` | no | object | Arbitrary key/value pairs |

### `supplementary` (optional)

Cross-cutting structure that overlays the base graph.

| Field | Type | Notes |
|---|---|---|
| `corporate_structure[]` | array of objects | Each item links a `company_entity_id` (must match an existing entity ID) to ownership / control / partner-program signals |
| `partnering_match_hits[]` | array of objects | Each item links a `company_entity_id` to a `partnering_posture_id` and the keyword hits behind the match |

See `features/graph-database/services/jsonIngest/schema.ts` for the full per-field shapes.

### `metadata` (optional)

Any object. Common producer-emitted fields:

```json
{
  "metadata": {
    "generated_by": "merge_bd_bundle.py v3",
    "generated_at": "2026-04-26T18:00:00Z",
    "source_run": "abc123"
  }
}
```

`metadata.schema_version` is also accepted but **has no semantic effect** — it is informational only.

## Validation Rules

Beyond the per-field Zod shape, the ingest enforces:

- **Unique entity IDs.** Duplicates throw `Duplicate entity ids: …`.
- **Referential integrity.** Every `relations[].source` and `relations[].target` must reference an existing `entities[].id`. Missing references throw `Relation sources/targets not present in entities: …`.
- **Cypher-safe relation types.** `relations[].type` and entity `properties` keys must match `^[A-Za-z_][A-Za-z0-9_]*$`. Hyphens, dots, and special characters are rejected.
- **Supplementary references.** `supplementary.corporate_structure[].company_entity_id` and `supplementary.partnering_match_hits[].company_entity_id` must reference existing entities.

Validation errors throw `BadRequest` with a sample of the offending IDs (first 5, plus a total count if more).

## Minimal Valid Example

```json
{
  "entities": [
    {
      "id": "company:acme",
      "label": "Entity",
      "type": "company",
      "name": "ACME Defense"
    },
    {
      "id": "capability:autonomy",
      "label": "Concept",
      "type": "capability",
      "name": "Autonomous Systems"
    }
  ],
  "relations": [
    {
      "source": "company:acme",
      "target": "capability:autonomy",
      "type": "HAS_CAPABILITY"
    }
  ]
}
```

That is the smallest bundle that ingests successfully. A larger working example with `supplementary` and `metadata` lives at `features/graph-database/services/jsonIngest/__tests__/fixtures/small-valid-palm-graph.json`.

## What Happens on Ingest

When a bundle parses successfully and the worker picks it up:

1. The document record is loaded and its text is parsed via `tryParsePalmGraph`.
2. Referential integrity is validated.
3. Each entity becomes either an `Entity` or `Concept` node in Neo4j (per `label`), with the bundle's `id` preserved as `externalId` and a fresh UUID as the node `id`.
4. Each relation becomes an edge of type `relation.type` between the two corresponding nodes.
5. A `Document` node is created and connected to every entity via `MENTIONS` (Entity) or `DISCUSSES` (Concept) edges — one per entity, used as a fingerprint for the fast-path origin.
6. Embeddings are generated for entity/concept names and stored alongside the nodes.
7. Supplementary structure is layered on as additional nodes/edges.

The result is queryable in Neo4j Browser at `http://localhost:7474` immediately.

## Confirming the Fast Path Ran

Tail the worker logs while the document is graphed:

```bash
docker logs -f palm-oss-graph-build-worker-1
```

Look for:
- `[GRAPH-BUILD] Routing <filename> to palm-graph ingest` → fast path engaged
- `[GRAPH-BUILD] Completed palm-graph document: <filename>` → ingest succeeded

If you see `[GRAPH-BUILD] Processing chunk 1/N…` instead, the JSON failed to parse and fell through to LLM extraction. Common causes:
- Hyphens in `relations[].type` or entity property keys
- Unknown fields on entities or relations (the schema is strict)
- Empty `entities` array
- Missing `entities` key entirely
- Producer emitted invalid JSON

You can also verify in Neo4j directly — a fast-path document has its `MENTIONS`/`DISCUSSES` edge count equal to its entity/concept count (one per entity), with relation types from the bundle (e.g. `HAS_CAPABILITY`) rather than only the generic `RELATED` that LLM extraction emits.

## Producer-Side Notes

If you are building a tool that emits palm-graph JSON:

- Treat the shape as the contract. Don't rely on `metadata.schema_version` to be inspected — it is not.
- Use `SCREAMING_SNAKE_CASE` for relation types and snake_case for entity property keys. Hyphens will be rejected.
- Keep entity IDs stable across runs if you want graph reuse to work — the `documentId` indexes on Entity/Concept use them.
- Prefer fewer, well-shaped relation types over many fine-grained ones. The downstream graph UX surfaces relation types directly.

## Related

- Schema source of truth: `features/graph-database/services/jsonIngest/schema.ts`
- Referential rules: `features/graph-database/services/jsonIngest/referentialIntegrity.ts`
- Worker integration: `features/graph-database/utils/worker/worker.ts` (search for `tryParsePalmGraph`)
- Test fixtures: `features/graph-database/services/jsonIngest/__tests__/fixtures/`
