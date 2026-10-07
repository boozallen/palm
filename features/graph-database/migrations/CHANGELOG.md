# GraphRAG Schema Migrations

## 001_remove_topics.cypher (2025-01-21)
- **Reason:** Topics redundant with Concepts
- **Changes:** Removed all Topic nodes and ABOUT relationships
- **Impact:** Reduces extraction complexity and cost
- **Rollback:** Cannot automatically restore Topics; rebuild graphs if needed

## 002_create_entity_indexes.cypher (2025-01-21) — CONSOLIDATED
- **Reason:** Enable efficient entity queries for resolution engine (F2.x)
- **Changes:** Added indexes on documentId, name, and aliases fields
- **Impact:** Improves entity lookup and filtering performance
- **Status:** File removed 2026-04-26. Indexes folded into the auto-bootstrap in
  `features/graph-database/sources/neo4j.ts` `createConstraintsAndIndexes()` so they
  apply on every Neo4j startup, not just on first manual run. The standalone
  `.cypher` file was never wired to a runner and was misleading; consolidating
  removes the drift between "declared" and "applied".

## 003_create_concept_indexes.cypher (2025-01-21) — CONSOLIDATED
- **Reason:** Enable efficient concept queries for resolution engine (F2.x)
- **Changes:** Added indexes on name, category, and documentId fields
- **Impact:** Improves concept lookup and filtering performance
- **Status:** File removed 2026-04-26. Same consolidation as 002 — indexes now
  live in `sources/neo4j.ts` auto-bootstrap. Note: `concept_category` was already
  in the bootstrap, so only `concept_name` and `concept_document` were the net
  additions.

## Note on auto-bootstrap vs. manual migrations (2026-04-26)
This codebase's actual mechanism for Neo4j schema is the auto-bootstrap function
`createConstraintsAndIndexes()` in `features/graph-database/sources/neo4j.ts`,
which runs on every Neo4j connection startup. All `CREATE ... IF NOT EXISTS`,
idempotent.

Standalone `.cypher` files in this directory should only exist for **destructive
one-time operations** that can't safely run on every startup (e.g., 001's
`DETACH DELETE`). For new indexes/constraints, add them directly to the
auto-bootstrap — don't create new standalone files unless they're truly one-time
manual runs.
