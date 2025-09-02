import { SimpleGrid, Title, Text, Stack } from '@mantine/core';
import Legal from '@/features/legal/components/Legal';

export default function LegalPolicies() {
  return (
    <>
      <SimpleGrid cols={2} p='xl' bg='dark.6'>
        <Stack spacing='xxs'>
          <Title order={1} fz='xxl' align='left' c='gray.1'>
            Legal Policies
          </Title>
          <Text fz='md' c='gray.6'>
            View information regarding organizational policies.
          </Text>
        </Stack>
      </SimpleGrid>
      <SimpleGrid p='sm'>
        <Legal />
      </SimpleGrid>
    </>
  );
}
