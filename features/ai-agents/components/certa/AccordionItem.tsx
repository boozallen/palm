import { Accordion, Group, Title } from '@mantine/core';

import { ComplianceResult, Policy } from '@/features/ai-agents/types/certa/webPolicyCompliance';
import Result from './Result';
import PolicyContent from './PolicyContent';
import Badge from './Badge';

type AccordionItemProps = Readonly<{
  policy: Policy;
  isLoading: boolean;
  result?: ComplianceResult;
}>;

export default function AccordionItem({
  policy,
  isLoading,
  result,
}: AccordionItemProps) {
  return (
    <Accordion.Item value={policy.title.replaceAll(' ', '-').toLowerCase()}>
      <Accordion.Control>
        <Group position='apart'>
          <Title order={2} color='gray.6' fz='xl' fw='bolder'>
            {policy.title}
          </Title>
          <Badge isLoading={isLoading} result={result?.complianceStatus} />
        </Group>
      </Accordion.Control>
      <Accordion.Panel pt='md'>
        <Group align='flex-start' grow>
          <PolicyContent policy={policy} />
          <Result isLoading={isLoading} result={result} />
        </Group>
      </Accordion.Panel>
    </Accordion.Item>
  );
}
