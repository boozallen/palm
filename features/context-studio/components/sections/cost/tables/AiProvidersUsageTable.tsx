import React, { useEffect, useState } from 'react';
import { Pagination, Stack, Table, Text } from '@mantine/core';

import { ModelCosts, ProviderCosts, UserGroupUsageRecord } from '@/features/context-studio/types/cost';
import { formatCurrencyNumberForAnalytics } from '@/features/shared/utils';
import { ITEMS_PER_PAGE } from '@/features/shared/utils/pagination';
import ProviderUsageRow from './ProviderUsageRow';
import ModelUsageRow from './ModelUsageRow';
import UserUsageRow from './UserUsageRow';

type AiProvidersUsageTableProps = Readonly<{
  providerCosts: ProviderCosts[];
  users?: UserGroupUsageRecord[];
}>;

export default function AiProvidersUsageTable({ providerCosts, users }: AiProvidersUsageTableProps) {
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [users, providerCosts]);

  if (users && users.length > 0) {
    const totalPages = Math.ceil(users.length / ITEMS_PER_PAGE);
    const paginatedUsers = users.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    return (
      <Stack spacing='lg'>
        <Table>
          <thead>
            <tr>
              <th data-testid='user-header'>User</th>
              <th data-testid='provider-header'>Provider</th>
              <th data-testid='model-header'>Model</th>
              <th data-testid='input-tokens-header' style={{ textAlign: 'right' }}>Input Tokens</th>
              <th data-testid='output-tokens-header' style={{ textAlign: 'right' }}>Output Tokens</th>
              <th data-testid='cost-header' style={{ textAlign: 'right' }}>Cost</th>
            </tr>
          </thead>
          <tbody>
            {paginatedUsers.map((user: UserGroupUsageRecord) => (
              <React.Fragment key={user.id}>
                <UserUsageRow
                  name={user.name}
                  cost={user.cost}
                  inputTokens={user.inputTokens}
                  outputTokens={user.outputTokens}
                />
                {user.providers.map((provider: ProviderCosts) => (
                  <React.Fragment key={provider.id}>
                    <tr>
                      <td></td>
                      <td><Text fw='bolder'>{provider.label}</Text></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td><Text fw='bolder'>{formatCurrencyNumberForAnalytics(provider.cost)}</Text></td>
                    </tr>
                    {provider.models.map((model: ModelCosts) => (
                      <tr key={model.id}>
                        <td></td>
                        <td></td>
                        <td>{model.label}</td>
                        <td></td>
                        <td></td>
                        <td>{formatCurrencyNumberForAnalytics(model.cost)}</td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </Table>
        {totalPages > 1 && (
          <Pagination
            total={totalPages}
            value={currentPage}
            onChange={setCurrentPage}
            position='right'
          />
        )}
      </Stack>
    );
  }

  const totalPages = Math.ceil(providerCosts.length / ITEMS_PER_PAGE);
  const paginatedProviders = providerCosts.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <Stack spacing='lg'>
      <Table>
        <thead>
          <tr>
            <th data-testid='provider-header'>Provider</th>
            <th data-testid='model-name-header'>Model Name</th>
            <th data-testid='input-tokens-header' style={{ textAlign: 'right' }}>Input Tokens</th>
            <th data-testid='output-tokens-header' style={{ textAlign: 'right' }}>Output Tokens</th>
            <th data-testid='cost-header' style={{ textAlign: 'right' }}>Cost</th>
          </tr>
        </thead>
        <tbody>
          {paginatedProviders.map((provider: ProviderCosts) => (
            <React.Fragment key={provider.id}>
              <ProviderUsageRow
                label={provider.label}
                cost={provider.cost}
                inputTokens={provider.inputTokens}
                outputTokens={provider.outputTokens}
                costPerInputToken={provider.costPerInputToken}
                costPerOutputToken={provider.costPerOutputToken}
              />
              {provider.models.map((model: ModelCosts) => (
                <ModelUsageRow
                  key={model.id}
                  label={model.label}
                  cost={model.cost}
                  inputTokens={model.inputTokens}
                  outputTokens={model.outputTokens}
                  costPerInputToken={model.costPerInputToken}
                  costPerOutputToken={model.costPerOutputToken}
                />
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </Table>
      {totalPages > 1 && (
        <Pagination
          total={totalPages}
          value={currentPage}
          onChange={setCurrentPage}
          position='right'
        />
      )}
    </Stack>
  );
}
