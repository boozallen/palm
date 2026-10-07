import type { ReactNode } from 'react';
import { Box, Group, Stack, Text, ThemeIcon, Title } from '@mantine/core';

type SetupStepProps = Readonly<{
  step: number;
  title: string;
  description?: string;
  disabled?: boolean;
  disabledReason?: string | null;
  testId: string;
  children: ReactNode;
}>;

export default function SetupStep({
  step,
  title,
  description,
  disabled = false,
  disabledReason = null,
  testId,
  children,
}: SetupStepProps) {
  return (
    <Stack spacing='sm' data-testid={testId}>
      <Group spacing='sm' noWrap>
        <ThemeIcon radius='xl' variant={disabled ? 'light' : 'filled'}>
          <Text size='sm' data-testid={`${testId}-number`}>{step}</Text>
        </ThemeIcon>
        <Title order={3}>{title}</Title>
      </Group>

      {description && (
        <Text data-testid={`${testId}-description`} size='sm' c='gray.4'>{description}</Text>
      )}

      {disabled && disabledReason && (
        <Text data-testid={`${testId}-disabled-reason`} size='sm' c='yellow.5'>{disabledReason}</Text>
      )}

      {/* A disabled fieldset disables every control inside it, including ones in child components. */}
      <Box
        component='fieldset'
        disabled={disabled}
        data-testid={`${testId}-body`}
        m={0}
        p={0}
        opacity={disabled ? 0.5 : 1}
        sx={{ border: 0, minWidth: 0 }}
      >
        {children}
      </Box>
    </Stack>
  );
}
