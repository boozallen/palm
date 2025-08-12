import { Accordion as MAccordion } from '@mantine/core';

import { PolicyResults, Policy } from '@/features/ai-agents/types/certa/webPolicyCompliance';
import AccordionItem from './AccordionItem';

type AccordionProps = Readonly<{
  selectedPolicies: Policy[];
  results: PolicyResults;
  loadingPolicies: Record<string, boolean>;
}>;

export default function Accordion({
  selectedPolicies,
  results,
  loadingPolicies,
}: AccordionProps) {
  if (!selectedPolicies.length) {
    return null;
  }

  return (
    <MAccordion variant='separated'>
      {selectedPolicies.map((policy) => {
        const policyData = results[policy.title];
        return (
          <AccordionItem
            key={policy.title}
            policy={policy}
            isLoading={loadingPolicies[policy.title]}
            result={policyData?.result}
          />
        );
      })}
    </MAccordion>
  );
}
