-- Rename embedding tables to clarify they are part of Graph RAG system
-- This distinguishes them from the existing Embedding table used for plain RAG

-- Rename EntityEmbedding to GraphEntityEmbedding
ALTER TABLE "entity_embeddings" RENAME TO "graph_entity_embeddings";

-- Rename ConceptEmbedding to GraphConceptEmbedding
ALTER TABLE "concept_embeddings" RENAME TO "graph_concept_embeddings";
