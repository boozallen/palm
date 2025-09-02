import { Stack, Accordion } from '@mantine/core';
import Policy from '@/features/legal/components/restricted-rights/Policy';

export default function Legal() {

  return (
    <Stack p='lg'>
      <Accordion
        variant='separated'
        chevronPosition='right'
        defaultValue='policy'
      >
        <Policy />
      </Accordion>
    </Stack>
  );
}
