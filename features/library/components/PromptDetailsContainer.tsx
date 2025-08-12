import { Prompt } from '@/features/shared/types';
import { PromptDetailsProvider } from '@/features/library/providers/PromptDetailsProvider';
import RunPromptForm from './RunPromptForm';
import PromptDetailsHeader from './PromptDetailsHeader';

interface PromptDetailsContainerProps {
  prompt: Prompt;
}
const PromptDetailsContainer: React.FC<PromptDetailsContainerProps> = ({
  prompt,
}) => {
  return (
    <PromptDetailsProvider prompt={prompt}>
      <PromptDetailsHeader />
      <RunPromptForm />
    </PromptDetailsProvider>
  );
};

export default PromptDetailsContainer;
