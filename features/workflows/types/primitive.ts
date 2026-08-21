/**
 * Core types for the workflow primitive system
 */

import type { ComponentType } from 'react';
import { AiSettings } from '@/types/ai-settings';
import { BaseArtifact, WorkflowArtifactFileType } from '@/features/shared/types/document';

/**
 * Primitive execution context - passed between primitives in a workflow
 */
export interface PrimitiveContext {
  // Data passed from the previous primitive
  input: Record<string, any>;
  // Accumulated data from all previous primitives
  state: Record<string, any>;
  // Workflow metadata
  workflowId: string;
  executionId: string;
  userId: string;
}

/**
 * Result of a primitive execution
 */
export interface PrimitiveResult {
  // Output data to pass to next primitive
  output: Record<string, any>;
  // Status of execution
  status: 'success' | 'error';
  // Error message if status is 'error'
  error?: string;
  // Additional metadata about the execution
  metadata?: Record<string, any>;
}

/**
 * Configuration for a primitive instance
 */
export interface PrimitiveConfig {
  // Unique identifier for this primitive instance
  id: string;
  // Type of primitive
  type: PrimitiveType;
  // Display name for UI
  name: string;
  // Primitive-specific configuration
  config: Record<string, any>;
  // Optional condition to determine if this primitive should execute
  condition?: {
    field: string;
    operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
    value: any;
  };
  // Optional visual position on canvas (for UI persistence)
  position?: {
    x: number;
    y: number;
  };
  // IDs of nodes directly connected to this node via graph edges.
  // Used to pull the correct predecessor outputs from execution state.
  predecessorIds?: string[];
}

/**
 * Available primitive types
 */
export enum PrimitiveType {
  DOCUMENT = 'document',
  WEBSCRAPER = 'webscraper',
  PROMPT = 'prompt',
  ARTIFACT = 'artifact',
}

/**
 * Base interface that all primitives must implement
 */
export interface Primitive {
  readonly type: PrimitiveType;
  readonly config: PrimitiveConfig;

  /**
   * Execute the primitive logic
   */
  execute(context: PrimitiveContext): Promise<PrimitiveResult>;

  /**
   * Validate the primitive configuration
   */
  validate(): Promise<{ valid: boolean; errors?: string[] }>;
}

/**
 * Web Scraper primitive configuration
 */
export interface WebScraperConfig {
  url: string;
  maxPages?: number;
  filterClasses?: string[];
  waitForSelector?: string;
}

/**
 * Prompt primitive configuration.
 * Extends Partial<AiSettings> to reuse the shared AI config shape
 * (temperature, topP, frequencyPenalty, presencePenalty).
 * `model` is re-declared here as required.
 */
export interface PromptConfig extends Partial<AiSettings> {
  model: string;
  promptId?: string;
  prompt?: string;
  promptText?: string;
  // Field from input to use as content
  inputField?: string;
  temperature?: number;
  topP?: number;
  systemMessage?: string;
  // RAG configuration
  useGraph?: boolean;
}

/**
 * Artifact primitive configuration
 */
export interface ArtifactConfig {
  format: WorkflowArtifactFileType;
  template?: string;
  includeFields?: string[];
  excludeFields?: string[];
  filename?: string;
}

/**
 * Workflow artifact - extends base artifact with workflow-specific fields
 */
export type WorkflowArtifact = BaseArtifact & {
  workflowExecutionId: string;
  primitiveId: string;
};

/**
 * Document structure for workflow primitive outputs
 */
export interface WorkflowDocument {
  id: string;
  name: string;
  mimeType: string;
  content: string;
}

/**
 * Document primitive configuration
 * Uses a single document from the document library
 */
export interface DocumentConfig {
  // ID of a single document from the user's library
  documentId?: string;
}

/**
 * Props passed to every node config component rendered inside PrimitiveConfigModal.
 */
export interface NodeConfigProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  onUploadingChange?: (uploading: boolean) => void;
}

/**
 * Full definition of a node type in the registry — label, icon, color,
 * config component, and default config. Runtime values live in node-registry.ts;
 * this interface lives here so it can be imported without pulling in React components.
 */
export interface NodeTypeDefinition {
  type: PrimitiveType;
  label: string;
  description: string;
  icon: ComponentType<{ size?: number }>;
  color: string;
  enabled: boolean;
  ConfigComponent: ComponentType<NodeConfigProps>;
  defaultConfig: Record<string, unknown>;
}

