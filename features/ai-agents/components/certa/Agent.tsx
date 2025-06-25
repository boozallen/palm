import {
  useState,
  useRef,
  createContext,
  useContext,
  useMemo,
  useEffect,
} from 'react';
import { Stack } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconX, IconCheck } from '@tabler/icons-react';

import Form from './Form';
import Accordion from './Accordion';
import {
  useWebPolicyCompliance,
  useComplianceStatus,
} from '@/features/ai-agents/api/certa/web-policy-compliance';
import {
  PolicyCompliance,
  PolicyResults,
  Policy,
} from '@/features/ai-agents/types/certa/webPolicyCompliance';
import { downloadComplianceResults } from '@/features/ai-agents/utils/certa/exportComplianceResults';

type ResultsContextType = {
  results: PolicyResults;
  setResults: React.Dispatch<React.SetStateAction<PolicyResults>>;
};

const ResultsContext = createContext<ResultsContextType>({
  results: {},
  setResults: () => { },
});

export const useResults = () => useContext(ResultsContext);

type AgentProps = Readonly<{
  id: string;
}>;

export default function Agent({ id }: AgentProps) {

  const [results, setResults] = useState<PolicyResults>({});
  const [selectedPolicies, setSelectedPolicies] = useState<Policy[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const formData = useRef<PolicyCompliance>(null);
  const contextValue = useMemo(() => ({ results, setResults }), [results]);
  const [loadingPolicies, setLoadingPolicies] = useState<
    Record<string, boolean>
  >({});

  const { mutate: webPolicyCompliance } = useWebPolicyCompliance();

  const { refetch: checkStatus } = useComplianceStatus(jobId);

  const updateLoadingStates = (completedPolicies: string[]) => {
    setLoadingPolicies((prev) => {
      const newLoadingState = { ...prev };
      completedPolicies.forEach((policyTitle) => {
        newLoadingState[policyTitle] = false;
      });
      return newLoadingState;
    });
  };

  useEffect(() => {
    if (!jobId || !isProcessing) {
      return;
    }

    const pollInterval = setInterval(async () => {
      const { data } = await checkStatus();

      // Check for and use partial results if available so policies will be displayed as they complete
      if (data?.partialResults) {
        setResults(data.partialResults);

        // Update loading states of completed policies
        updateLoadingStates(Object.keys(data.partialResults));
      }

      // Check for completion
      if (data?.results) {
        setResults(data.results);
        setLoadingPolicies({});
        setIsProcessing(false);
        setJobId(null);
        clearInterval(pollInterval);

        notifications.show({
          title: 'Compliance Check Complete',
          message: 'Your results are ready',
          icon: <IconCheck />,
          color: 'green',
        });
      } else if (!data || data.status === 'error') {
        notifications.show({
          title: 'Failed to Audit Site',
          message: 'An unexpected error has occurred',
          icon: <IconX />,
          autoClose: false,
          withCloseButton: true,
          variant: 'failed_operation',
        });
        setIsProcessing(false);
        setLoadingPolicies({});
        setJobId(null);
        clearInterval(pollInterval);
      }
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [jobId, isProcessing, checkStatus]);

  const handleComplianceCheck = async (data: PolicyCompliance) => {
    formData.current = data;
    setIsProcessing(true);

    const initialLoadingState: Record<string, boolean> = {};
    selectedPolicies.forEach((policy) => {
      initialLoadingState[policy.title] = true;
    });
    setLoadingPolicies(initialLoadingState);

    const aggregator: PolicyResults = {};

    for (const policy of selectedPolicies) {
      aggregator[policy.title] = { isLoading: true };
    }

    setResults({ ...aggregator });

    webPolicyCompliance(
      {
        url: data.url,
        model: data.model,
        policies: selectedPolicies,
        instructions: data.instructions,
      },
      {
        onSuccess: (response) => {
          // Instead of getting results directly, we get a jobId
          setJobId(response.jobId);
          notifications.show({
            title: 'Compliance Check Started',
            message:
              'Your request is being processed. This may take a few minutes.',
            icon: <IconCheck />,
          });
        },
        onError: () => {
          notifications.show({
            title: 'Error Completing Compliance Check',
            message: 'Failed to complete compliance check',
            icon: <IconX />,
            variant: 'failed_operation',
          });
          setIsProcessing(false);
        },
      }
    );
  };

  const handleDownload = () => {
    downloadComplianceResults(
      selectedPolicies,
      results,
      formData.current?.url ?? ''
    );
  };

  return (
    <ResultsContext.Provider value={contextValue}>
      <Stack bg='dark.6' p='xl' spacing='lg'>
        <Form
          agentId={id}
          onSubmit={handleComplianceCheck}
          selectedPolicies={selectedPolicies}
          setSelectedPolicies={setSelectedPolicies}
          handleDownload={handleDownload}
          isLoading={isProcessing}
        />
        <Accordion
          selectedPolicies={selectedPolicies}
          results={results}
          loadingPolicies={loadingPolicies}
        />
      </Stack>
    </ResultsContext.Provider>
  );
}
