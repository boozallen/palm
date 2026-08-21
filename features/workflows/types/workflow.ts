/**
 * Workflow definition and execution types
 */

import { PrimitiveConfig } from '@/features/workflows/types/primitive';

/**
 * A workflow is a collection of primitives that execute as a DAG
 */
export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  version: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;

  // Array of primitives to execute
  primitives: PrimitiveConfig[];

  // Canvas viewport state (zoom/pan position)
  viewport?: { x: number; y: number; zoom: number };

  // Trigger configuration
  trigger?: WorkflowTrigger;

  // Global workflow settings
  settings?: WorkflowSettings;
}

/**
 * Workflow trigger configuration
 */
export interface WorkflowTrigger {
  type: 'manual' | 'schedule' | 'webhook' | 'event';
  config: ScheduleTrigger | WebhookTrigger | EventTrigger;
}

export interface ScheduleTrigger {
  cron: string;
  timezone?: string;
}

export interface WebhookTrigger {
  secret: string;
  validateSignature?: boolean;
}

export interface EventTrigger {
  eventType: string;
  filters?: Record<string, any>;
}

/**
 * Global workflow settings
 */
export interface WorkflowSettings {
  timeout?: number; // Overall workflow timeout in seconds
  retryPolicy?: {
    maxRetries: number;
    backoffMultiplier: number;
  };
  notifications?: {
    onSuccess?: string[]; // User IDs to notify
    onFailure?: string[]; // User IDs to notify
  };
}

/**
 * Workflow execution instance
 */
export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: WorkflowStatus;
  triggeredBy: string;
  startedAt: Date;
  completedAt?: Date;
  error?: string;

  // Initial input to the workflow
  input: Record<string, any>;

  // Final output from the workflow
  output?: Record<string, any>;

  // Execution trace for each primitive
  trace: PrimitiveExecutionTrace[];
}

export enum WorkflowStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export const WorkflowStatusLabels: Record<WorkflowStatus, string> = {
  [WorkflowStatus.PENDING]: 'Pending',
  [WorkflowStatus.RUNNING]: 'Running',
  [WorkflowStatus.PAUSED]: 'Paused',
  [WorkflowStatus.COMPLETED]: 'Completed',
  [WorkflowStatus.FAILED]: 'Failed',
  [WorkflowStatus.CANCELLED]: 'Cancelled',
};

/**
 * Trace of a single primitive execution within a workflow
 */
export interface PrimitiveExecutionTrace {
  primitiveId: string;
  primitiveName: string;
  primitiveType: string;
  startedAt: Date;
  completedAt?: Date;
  status: 'pending' | 'running' | 'success' | 'error' | 'skipped' | 'paused';
  input: Record<string, any>;
  output?: Record<string, any>;
  error?: string;
  metadata?: Record<string, any>;
  // Config snapshot used during this execution
  config?: Record<string, any>;
}

/**
 * Request to execute a workflow
 */
export interface ExecuteWorkflowRequest {
  workflowId: string;
  input?: Record<string, any>;
  overrides?: {
    primitives?: Partial<PrimitiveConfig>[];
  };
}

/**
 * Response from workflow execution start
 */
export interface ExecuteWorkflowResponse {
  executionId: string;
  status: WorkflowStatus;
  message: string;
}

/**
 * Request to get workflow execution status
 */
export interface GetWorkflowStatusRequest {
  executionId: string;
}

/**
 * Response with workflow execution status
 */
export interface GetWorkflowStatusResponse {
  execution: WorkflowExecution;
}
