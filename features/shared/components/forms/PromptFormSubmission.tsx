import { AiResponse } from '@/features/ai-provider/sources/types';
import PromptSubmissionErrorNotification from '@/features/shared/components/notifications/prompt-submission/PromptSubmissionErrorNotification';
import PromptFormSubmissionLoading from '@/features/shared/components/forms/PromptFormSubmissionLoading';
import PromptFormSubmissionResponse from '@/features/shared/components/forms/PromptFormSubmissionResponse';

export type PromptFormSubmissionProps = Readonly<{
  hasPromptSubmissionError: boolean;
  errorMessage?: string;
  isPending: boolean;
  data?: AiResponse;
}>;

export default function PromptFormSubmission({ hasPromptSubmissionError, errorMessage, isPending, data }: PromptFormSubmissionProps) {
  if (hasPromptSubmissionError) {
    return <PromptSubmissionErrorNotification enabled={hasPromptSubmissionError} message={errorMessage} />;
  } else if (isPending) {
    return <PromptFormSubmissionLoading />;
  } else if (data) {
    return <PromptFormSubmissionResponse data={data} />;
  } else {
    return null;
  }
};
