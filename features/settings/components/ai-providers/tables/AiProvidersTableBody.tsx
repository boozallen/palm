import getModels from '@/features/settings/api/ai-providers/get-models';
import ProviderRow from './ProviderRow';
import Loading from '@/features/shared/components/Loading';
import { Text } from '@mantine/core';
import ModelRow from './ModelRow';
import AddModelRow from './AddModelRow';
import React, { JSX, useState } from 'react';

type AiProvider = {
  id: string;
  label: string;
  createdAt: string;
  updatedAt: string;
};

type AiProvidersTableBodyProps = Readonly<{
  aiProviders: AiProvider[];
}>;

export type ShowModelRowType = {
  show: boolean;
  providerId: string;
};

const TableBodyWrapper = ({
  children,
}: {
  children: JSX.Element;
}): JSX.Element => {
  return (
    <tbody>
      <tr>
        <td>{children}</td>
      </tr>
    </tbody>
  );
};

export default function AiProvidersTableBody({
  aiProviders,
}: AiProvidersTableBodyProps) {
  const {
    data: modelsData,
    isPending: getModelsIsPending,
    error: getModelsError,
  } = getModels();

  const [showAddModelRow, setShowAddModelRow] = useState<ShowModelRowType>({
    show: false,
    providerId: '',
  });

  const [modelBeingTested, setModelBeingTested] = useState<string | null>(null);
  const [newModelBeingTested, setNewModelBeingTested] = useState<string | null>(
    null,
  );

  if (getModelsIsPending) {
    return (
      <TableBodyWrapper>
        <Loading />
      </TableBodyWrapper>
    );
  }

  if (getModelsError) {
    return (
      <TableBodyWrapper>
        <Text>{getModelsError?.message}</Text>
      </TableBodyWrapper>
    );
  }

  return (
    <tbody>
      {aiProviders.map((provider: AiProvider) => (
        <React.Fragment key={provider.id}>
          <ProviderRow
            provider={provider}
            setShowAddModelRow={setShowAddModelRow}
          />
          {showAddModelRow.show &&
            provider.id === showAddModelRow.providerId && (
              <AddModelRow
                providerId={provider.id}
                setShowAddModelRow={setShowAddModelRow}
                setNewModelBeingTested={setNewModelBeingTested}
              />
            )}
          {modelsData.models.map((model) => (
            <React.Fragment key={model.id}>
              {provider.id === model.aiProviderId &&
                model.id !== newModelBeingTested && (
                  <ModelRow
                    {...model}
                    modelBeingTested={modelBeingTested}
                    setModelBeingTested={setModelBeingTested}
                  />
                )}
            </React.Fragment>
          ))}
        </React.Fragment>
      ))}
    </tbody>
  );
}
