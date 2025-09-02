import { Accordion, Stack, Text, Title } from '@mantine/core';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import Loading from '@/features/shared/components/Loading';

export default function Policy() {
  const { data: systemConfig, isPending: systemConfigIsPending, error: systemConfigError } = useGetSystemConfig();

  if (systemConfigIsPending) {
    return <Loading />;
  }

  if (systemConfigError) {
    return <Text>{systemConfigError.message}</Text>;
  }
  return (
    <Accordion.Item value='restricted-rights'>
      <Accordion.Control>
        <Text fz='lg' fw='bold' c='gray.6'>
          Policy
        </Text>
      </Accordion.Control>
      <Accordion.Panel>
        <Stack spacing='md' mt='md'>
          <Title c='gray.6' pl='lg'>
            {systemConfig.legalPolicyHeader}
          </Title>
          <Text fz='md' c='gray.6' pl='lg'>
            {systemConfig.legalPolicyBody}
          </Text>
        </Stack>
      </Accordion.Panel>
    </Accordion.Item>
  );
}
