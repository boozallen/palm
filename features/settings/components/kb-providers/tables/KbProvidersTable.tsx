import React, { useState } from 'react';
import { Box, Table, Text } from '@mantine/core';

import KbProviderRow from './KbProviderRow';
import KnowledgeBaseRow from './KnowledgeBaseRow';
import AddKnowledgeBaseRow from './AddKnowledgeBaseRow';
import getKbProviders from '@/features/settings/api/get-kb-providers';
import getKnowledgeBases from '@/features/settings/api/get-knowledge-bases';
import Loading from '@/features/shared/components/Loading';
import { KbProviderType } from '@/features/shared/types';

export type DisplayKnowledgeBaseRow = {
  isVisible: boolean;
  kbProviderId: string;
};

type KbProvider = {
  id: string;
  label: string;
  config: Record<string, unknown>;
  kbProviderType: KbProviderType;
  updatedAt: string;
  createdAt: string;
};

export default function KbProvidersTable() {

  const [showAddKnowledgeBaseRow, setShowAddKnowledgeBaseRow] =
    useState<DisplayKnowledgeBaseRow>({
      isVisible: false,
      kbProviderId: '',
    });

  const {
    data: kbProvidersData,
    isPending: getKbProvidersIsPending,
    error: getKbProvidersError,
  } = getKbProviders();

  const {
    data: knowledgeBasesData,
    isPending: getKnowledgeBasesIsPending,
    error: getKnowledgeBasesError,
  } = getKnowledgeBases();

  if (getKbProvidersIsPending || getKnowledgeBasesIsPending) {
    return <Loading />;
  }

  if (getKbProvidersError || getKnowledgeBasesError) {
    if (getKbProvidersError) {
      return <Text>{getKbProvidersError?.message}</Text>;
    } else {
      return <Text>{getKnowledgeBasesError?.message}</Text>;
    }
  }

  if (!kbProvidersData.kbProviders || kbProvidersData.kbProviders.length === 0) {
    return (
      <Box bg='dark.8' p='md'>
        <Text c='gray.4'>No Knowledge Base Providers have been configured yet.</Text>
      </Box>
    );
  }

  return (
    <Box bg='dark.6' p='xl'>
      <Table>
        <thead>
          <tr>
            <th>Provider</th>
            <th>Knowledge Base Name</th>
            <th>Knowledge Base External ID</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody></tbody>
        <tbody>
          {kbProvidersData.kbProviders.map((kbProvider: KbProvider) => (
            <React.Fragment key={kbProvider.id}>
              <KbProviderRow
                kbProvider={kbProvider}
                setShowAddKnowledgeBaseRow={setShowAddKnowledgeBaseRow}
              />
              {showAddKnowledgeBaseRow.isVisible &&
                kbProvider.id === showAddKnowledgeBaseRow.kbProviderId && (
                  <AddKnowledgeBaseRow
                    kbProviderId={kbProvider.id}
                    setShowAddKnowledgeBaseRow={setShowAddKnowledgeBaseRow}
                  />
                )}
              {knowledgeBasesData.knowledgeBases
                .filter(
                  (knowledgeBase: { kbProviderId: string; }) =>
                    knowledgeBase.kbProviderId === kbProvider.id
                )
                .map((knowledgeBase) => (
                  <KnowledgeBaseRow
                    key={knowledgeBase.id}
                    knowledgeBase={{
                      ...knowledgeBase,
                      updatedAt: new Date(),
                    }}
                  />
                ))}
            </React.Fragment>
          ))}
        </tbody>
      </Table>
    </Box>
  );
}
