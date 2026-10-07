import { trpc } from '@/libs';

export default function useAcceptSharedWorkflow() {
  const utils = trpc.useContext();

  return trpc.workflows.acceptSharedWorkflow.useMutation({
    onMutate: async (variables) => {
      await utils.workflows.getSharedWorkflows.cancel();

      const previousData = utils.workflows.getSharedWorkflows.getData();

      utils.workflows.getSharedWorkflows.setData(undefined, (old) => {
        if (!old) {
          return old;
        }

        return {
          ...old,
          incoming: old.incoming.filter((w) => w.id !== variables.sharedWorkflowId),
        };
      });

      return { previousData };
    },
    onSuccess: () => {
      utils.workflows.getSharedWorkflows.invalidate();
      utils.workflows.getWorkflows.invalidate();
    },
    onError: (_err, _variables, context) => {
      if (context?.previousData) {
        utils.workflows.getSharedWorkflows.setData(undefined, context.previousData);
      }
    },
  });
}
