import { trpc } from '@/libs';
import { useExecuteWorkflow as useExecuteWorkflowMutation } from '@/features/workflows/api/execute-workflow';
import { PrimitiveType, PromptConfig } from '@/features/workflows/types/primitive';
import { Node, Edge } from 'reactflow';
import { PrimitiveNodeData } from '@/features/workflows/components/nodes/PrimitiveNode';
import { graphToWorkflow } from '@/features/workflows/utils/workflow-conversion';

interface ExecuteWorkflowInput {
  workflowId: string;
  input?: Record<string, unknown>;
  canvasState: {
    nodes: Node<PrimitiveNodeData>[];
    edges: Edge[];
  };
  enableContinueGates?: boolean;
  userGroupId?: string | null;
}

export const useExecuteWorkflow = () => {
  const executeMutation = useExecuteWorkflowMutation();
  const savePromptMutation = trpc.workflows.saveWorkflowPrompt.useMutation();

  const mutateAsync = async (input: ExecuteWorkflowInput) => {
    const resolvedNodes: Node<PrimitiveNodeData>[] = [];

    for (const node of input.canvasState.nodes) {
      if (node.data?.type !== PrimitiveType.PROMPT) {
        resolvedNodes.push(node);
        continue;
      }

      const config = node.data.config as PromptConfig | undefined;
      if (!config) {
        resolvedNodes.push(node);
        continue;
      }

      if (config.prompt) {
        const { promptId } = await savePromptMutation.mutateAsync({
          promptId: config.promptId,
          instructions: config.prompt,
          model: config.model ?? '',
          temperature: config.temperature,
        });
        resolvedNodes.push({
          ...node,
          data: {
            ...node.data,
            config: { ...config, promptId, prompt: undefined, promptText: undefined },
          },
        });
      } else {
        resolvedNodes.push({
          ...node,
          data: {
            ...node.data,
            config: { ...config, prompt: undefined, promptText: undefined },
          },
        });
      }
    }

    const primitives = graphToWorkflow(resolvedNodes, input.canvasState.edges);

    return executeMutation.mutateAsync({
      workflowId: input.workflowId,
      input: input.input,
      primitives,
      enableContinueGates: input.enableContinueGates,
      userGroupId: input.userGroupId,
    });
  };

  return { ...executeMutation, mutateAsync };
};
