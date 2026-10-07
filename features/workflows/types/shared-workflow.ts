import { z } from 'zod';

export const SHARED_WORKFLOW_INVITATION_EXPIRY_DAYS: number = 7;

export enum SharedWorkflowActionStatus {
  Accepted = 'accepted',
  Rejected = 'rejected',
}

export type SharedWorkflow = {
  id: string;
  sourceWorkflowId: string;
  sourceUserId: string;
  sharedWithUserGroupIds: string[];
  createdAt: Date;
  deletedAt?: Date;
};

export type SharedWorkflowAction = {
  id: string;
  sharedWorkflowId: string;
  copiedWorkflowId?: string;
  userId: string;
  status: SharedWorkflowActionStatus;
  createdAt: Date;
};

export const SharedWorkflowSchema = z.object({
  id: z.string().uuid(),
  sourceWorkflowId: z.string().uuid(),
  sourceUserId: z.string().uuid(),
  sharedWithUserGroupIds: z.array(z.string().uuid()),
  createdAt: z.date(),
  deletedAt: z.date().optional(),
});

export const SharedWorkflowActionSchema = z.object({
  id: z.string().uuid(),
  sharedWorkflowId: z.string().uuid(),
  copiedWorkflowId: z.string().uuid().optional(),
  userId: z.string().uuid(),
  status: z.nativeEnum(SharedWorkflowActionStatus),
  createdAt: z.date(),
});

export const IncomingSharedWorkflowSchema = z.object({
  id: z.string().uuid(),
  sourceWorkflowId: z.string().uuid(),
  sourceUserId: z.string().uuid(),
  sourceWorkflowName: z.string(),
  sharedByUsername: z.string(),
  createdAt: z.date(),
});

export type IncomingSharedWorkflow = z.infer<typeof IncomingSharedWorkflowSchema>;

export const OutgoingSharedWorkflowSchema = z.object({
  id: z.string().uuid(),
  workflowId: z.string().uuid(),
  workflowName: z.string(),
  sharedWithUserGroupIds: z.array(z.string().uuid()),
  createdAt: z.date(),
});

export type OutgoingSharedWorkflow = z.infer<typeof OutgoingSharedWorkflowSchema>;

export const GetSharedWorkflowsResultSchema = z.object({
  incoming: z.array(IncomingSharedWorkflowSchema),
  outgoing: z.array(OutgoingSharedWorkflowSchema),
});

export type GetSharedWorkflowsResult = z.infer<typeof GetSharedWorkflowsResultSchema>;
