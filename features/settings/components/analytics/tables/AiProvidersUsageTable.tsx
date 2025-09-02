import React from 'react';
import { Table } from '@mantine/core';

import { ModelCosts, ProviderCosts } from '@/features/settings/types/analytics';
import ProviderUsageRow from './ProviderUsageRow';
import ModelUsageRow from './ModelUsageRow';

type AiProvidersUsageTableProps = Readonly<{
  providerCosts: ProviderCosts[];
}>;

export default function AiProvidersUsageTable({ providerCosts }: AiProvidersUsageTableProps) {
  return (
    <Table>
      <thead>
        <tr>
          <th>Provider</th>
          <th>Model Name</th>
          <th>Cost</th>
        </tr>
      </thead>
      <tbody>
        {providerCosts.map((provider: ProviderCosts) => (
          <React.Fragment key={provider.id}>
            <ProviderUsageRow label={provider.label} cost={provider.cost}/>
            {provider.models.map((model: ModelCosts) => (
              <ModelUsageRow key={model.id} label={model.label} cost={model.cost} />
            ))}
          </React.Fragment>
        ))}
      </tbody>
    </Table>
  );
};
