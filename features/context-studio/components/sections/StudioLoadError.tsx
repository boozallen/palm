import { Center, Stack, Text, useMantineTheme } from '@mantine/core';

// A rejected query leaves stats undefined too, so without a distinct failure
// state a broken panel reads as a genuinely empty range.
export default function StudioLoadError() {
  const theme = useMantineTheme();
  return (
    <Center h={120} data-testid='studio-load-error'>
      <Stack spacing={2} align='center'>
        <Text size='sm' color='red.4'>Could not load this view.</Text>
        <Text size='xs' sx={{ color: theme.colors.dark[3] }}>
          This is a load failure, not an empty range — try again.
        </Text>
      </Stack>
    </Center>
  );
}
