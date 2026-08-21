import { router } from '@/server/trpc';

import { createWorkflow } from '@/features/workflows/routes/create-workflow';
import { updateWorkflow } from '@/features/workflows/routes/update-workflow';
import { deleteWorkflow } from '@/features/workflows/routes/delete-workflow';
import { executeWorkflow } from '@/features/workflows/routes/execute-workflow';
import { getWorkflowStatus } from '@/features/workflows/routes/get-workflow-status';
import { getWorkflows } from '@/features/workflows/routes/get-workflows';
import { getWorkflow } from '@/features/workflows/routes/get-workflow';
import { shareWorkflow } from '@/features/workflows/routes/share-workflow';
import { updateWorkflowShares } from '@/features/workflows/routes/update-workflow-shares';
import { getSharedWorkflowsRoute } from '@/features/workflows/routes/get-shared-workflows';
import { acceptSharedWorkflowRoute } from '@/features/workflows/routes/accept-shared-workflow';
import { rejectSharedWorkflowRoute } from '@/features/workflows/routes/reject-shared-workflow';
import { copyWorkflowRoute } from '@/features/workflows/routes/copy-workflow';
import { saveWorkflowPrompt } from '@/features/workflows/routes/save-workflow-prompt';
import { generateWorkflowRoute } from '@/features/workflows/routes/generate-workflow';
import { planWorkflowConversationalRoute } from '@/features/workflows/routes/plan-workflow-conversational';
import { continueWorkflowExecution } from '@/features/workflows/routes/continue-workflow-execution';
import { cancelWorkflowExecution } from '@/features/workflows/routes/cancel-workflow-execution';
import { getWorkflowArtifactRoute } from '@/features/workflows/routes/get-workflow-artifact';
import { pushWorkflowArtifactToGithubRoute } from '@/features/workflows/routes/push-workflow-artifact-to-github';

export default router({
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  executeWorkflow,
  getWorkflowStatus,
  getWorkflows,
  getWorkflow,
  shareWorkflow,
  updateWorkflowShares,
  getSharedWorkflows: getSharedWorkflowsRoute,
  copyWorkflow: copyWorkflowRoute,
  acceptSharedWorkflow: acceptSharedWorkflowRoute,
  rejectSharedWorkflow: rejectSharedWorkflowRoute,
  saveWorkflowPrompt,
  generateWorkflow: generateWorkflowRoute,
  planWorkflowConversational: planWorkflowConversationalRoute,
  continueWorkflowExecution,
  cancelWorkflowExecution,
  getWorkflowArtifact: getWorkflowArtifactRoute,
  pushWorkflowArtifactToGithub: pushWorkflowArtifactToGithubRoute,
});
