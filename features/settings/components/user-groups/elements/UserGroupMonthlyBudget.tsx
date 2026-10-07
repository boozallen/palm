import { useState } from 'react';
import { Button, Group, NumberInput, Paper, Stack, Text, ThemeIcon } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconX, IconCoin } from '@tabler/icons-react';
import useUpdateUserGroupMonthlyBudget from '@/features/settings/api/user-groups/update-user-group-monthly-budget';
import { formatCurrencyNumber, formatCurrencyNumberForAnalytics, formatTokenCount, parseNumber } from '@/features/shared/utils';

type UserGroupMonthlyBudgetProps = Readonly<{
  id: string;
  currentMonthlyBudget: number | null | undefined;
  totalSpend?: number;
  monthlySpend?: number;
  totalTokens?: number;
  monthlyTokens?: number;
}>;

export default function UserGroupMonthlyBudget({
  id,
  currentMonthlyBudget,
  totalSpend = 0,
  monthlySpend = 0,
  totalTokens = 0,
  monthlyTokens = 0,
}: UserGroupMonthlyBudgetProps) {
  const initialValue = currentMonthlyBudget ?? '';
  const [monthlyBudget, setMonthlyBudget] = useState<number | ''>(initialValue);

  const isOverBudget = currentMonthlyBudget != null &&
    (currentMonthlyBudget === 0 ? monthlySpend > 0 : monthlySpend >= currentMonthlyBudget);

  const {
    mutate: updateUserGroupMonthlyBudget,
    isPending: updateUserGroupMonthlyBudgetIsPending,
  } = useUpdateUserGroupMonthlyBudget();

  const handleSave = () => {
    updateUserGroupMonthlyBudget(
      { userGroupId: id, monthlyBudget: monthlyBudget === '' ? null : monthlyBudget },
      {
        onSuccess: () => {
          notifications.show({
            id: 'update-user-group-monthly-budget-success',
            title: 'Monthly Budget Updated',
            message: 'Successfully updated user group monthly budget.',
            icon: <IconCheck />,
            variant: 'successful_operation',
          });
        },
        onError: (error) => {
          notifications.show({
            id: 'update-user-group-monthly-budget-error',
            title: 'Failed to Update Monthly Budget',
            message:
              error.message ||
              'Unable to update user group monthly budget. Please try again later.',
            icon: <IconX />,
            variant: 'failed_operation',
            autoClose: false,
          });
        },
      }
    );
  };

  return (
    <Paper
      p='md'
      withBorder
      radius='md'
      bg='dark.7'
      data-testid='user-group-monthly-budget-container'
    >
      <Stack spacing='sm'>
        <Group spacing='xs'>
          <ThemeIcon
            variant='light'
            color='gray'
            size='md'
            radius='sm'
            sx={{ pointerEvents: 'none' }}
          >
            <IconCoin size={16} />
          </ThemeIcon>
          <Text size='sm' weight={600} color='gray.1'>
            Manage monthly budget
          </Text>
        </Group>

        <Group position='apart' align='center'>
          <Group spacing='md' align='flex-end'>
            <NumberInput
              data-testid='user-group-monthly-budget-input'
              variant='default'
              placeholder='No limit'
              precision={2}
              icon='$'
              min={0}
              hideControls
              mb={0}
              parser={(value) => parseNumber(value ?? '')}
              formatter={(value) => formatCurrencyNumber(value ?? '')}
              value={monthlyBudget}
              onChange={(value) => setMonthlyBudget(value === '' || value === undefined ? '' : value)}
              w='xxxl'
            />

            <Button
              data-testid='save-user-group-monthly-budget-button'
              onClick={handleSave}
              loading={updateUserGroupMonthlyBudgetIsPending}
              disabled={monthlyBudget === initialValue}
            >
              Save
            </Button>
          </Group>

          <Stack spacing={2} data-testid='user-group-spend-rollup'>
            <Group spacing='xl' position='apart'>
              <Text size='xs' color='gray.6'>
                Spent this month
              </Text>
              <Text
                size='sm'
                fw={600}
                c={isOverBudget ? 'red' : 'green.4'}
                data-testid={isOverBudget ? 'user-group-monthly-spend-over-limit' : 'user-group-monthly-spend'}
              >
                {formatCurrencyNumberForAnalytics(monthlySpend)}
                <Text span c='dimmed' fw={400}>
                  {' · '}{formatTokenCount(monthlyTokens)} tokens
                </Text>
              </Text>
            </Group>

            <Group spacing='xl' position='apart'>
              <Text size='xs' color='gray.6'>
                Total spend
              </Text>
              <Text size='sm' fw={600} color='gray.3' data-testid='user-group-total-spend'>
                {formatCurrencyNumberForAnalytics(totalSpend)}
                <Text span c='dimmed' fw={400}>
                  {' · '}{formatTokenCount(totalTokens)} tokens
                </Text>
              </Text>
            </Group>
          </Stack>
        </Group>
      </Stack>
    </Paper>
  );
}
