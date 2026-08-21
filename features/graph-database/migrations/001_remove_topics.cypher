// GraphRAG Schema Migration: Remove Topic Nodes
// Created: 2025-01-21
// Reason: Topics redundant with Concepts, may re-add via community detection

// Step 1: Count existing topics (for logging)
MATCH (t:Topic)
WITH count(t) as topicCount
RETURN topicCount;

// Step 2: Remove all Topic nodes and ABOUT relationships
MATCH (t:Topic)
DETACH DELETE t;

// Step 3: Verify deletion
MATCH (t:Topic)
RETURN count(t) as remaining_topics;
// Expected output: 0
