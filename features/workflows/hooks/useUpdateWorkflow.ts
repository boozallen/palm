import { trpc } from '@/libs';
import { useUpdateWorkflow as useUpdateWorkflowMutation } from '@/features/workflows/api/update-workflow';
import { PrimitiveType, PromptConfig } from '@/features/workflows/types/primitive';

export const useUpdateWorkflow = () => {
  const updateMutation = useUpdateWorkflowMutation();
  const savePromptMutation = trpc.workflows.saveWorkflowPrompt.useMutation();

  const mutateAsync = async (input: Parameters<typeof updateMutation.mutateAsync>[0]) => {
    let resolvedPrimitives = input.primitives;
    if (input.primitives) {
      const resolved: typeof input.primitives = [];
      for (const primitive of input.primitives) {
        if (primitive.type !== PrimitiveType.PROMPT) {
          resolved.push(primitive);
          continue;
        }
        const config = primitive.config as PromptConfig;
        if (config.prompt !== undefined) {
          const { promptId } = await savePromptMutation.mutateAsync({
            promptId: config.promptId,
            instructions: config.prompt ?? config.promptText ?? '',
            model: config.model ?? '',
            temperature: config.temperature,
          });
          resolved.push({
            ...primitive,
            config: { ...config, promptId, prompt: undefined, promptText: undefined },
          });
        } else {
          resolved.push({
            ...primitive,
            config: { ...config, prompt: undefined, promptText: undefined },
          });
        }
      }
      resolvedPrimitives = resolved;
    }

    return updateMutation.mutateAsync({ ...input, primitives: resolvedPrimitives });
  };

  return { ...updateMutation, mutateAsync };
};
