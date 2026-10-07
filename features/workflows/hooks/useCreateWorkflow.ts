import { trpc } from '@/libs';
import { useCreateWorkflow as useCreateWorkflowMutation } from '@/features/workflows/api/create-workflow';
import { PrimitiveType, PromptConfig } from '@/features/workflows/types/primitive';

export const useCreateWorkflow = () => {
  const createMutation = useCreateWorkflowMutation();
  const savePromptMutation = trpc.workflows.saveWorkflowPrompt.useMutation();

  const mutateAsync = async (input: Parameters<typeof createMutation.mutateAsync>[0]) => {
    const resolvedPrimitives: typeof input.primitives = [];
    for (const primitive of input.primitives) {
      if (primitive.type !== PrimitiveType.PROMPT) {
        resolvedPrimitives.push(primitive);
        continue;
      }
      const config = primitive.config as PromptConfig;
      if (config.model || config.prompt) {
        const { promptId } = await savePromptMutation.mutateAsync({
          promptId: config.promptId,
          instructions: config.prompt ?? '',
          model: config.model ?? '',
          temperature: config.temperature,
        });
        resolvedPrimitives.push({
          ...primitive,
          config: { ...config, promptId, prompt: undefined, promptText: undefined },
        });
      } else {
        resolvedPrimitives.push({
          ...primitive,
          config: { ...config, prompt: undefined, promptText: undefined },
        });
      }
    }

    return createMutation.mutateAsync({ ...input, primitives: resolvedPrimitives });
  };

  return { ...createMutation, mutateAsync };
};
