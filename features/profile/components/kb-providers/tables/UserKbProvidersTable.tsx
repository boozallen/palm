import React from 'react';
import { Group, Table, Text, ThemeIcon, Tooltip } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';

import UserKbProviderRow from './UserKbProviderRow';
import UserKnowledgeBaseRow from './UserKnowledgeBaseRow';
import useGetUserKnowledgeBases from '@/features/shared/api/get-user-knowledge-bases';
import Loading from '@/features/shared/components/Loading';
import useGetUserPreselectedKnowledgeBases from '@/features/shared/api/get-user-preselected-knowledge-bases';

type UserKnowledgeBase = {
  id: string;
  label: string;
};

type GroupedKnowledgeBase = {
  id: string;
  label: string;
  knowledgeBases: UserKnowledgeBase[];
};

export default function UserKbProvidersTable() {

  const {
    data: userKnowledgeBases,
    isPending: userKnowledgeBasesPending,
  } = useGetUserKnowledgeBases();

  const {
    data: userPreselectedKnowledgeBases,
    isPending: userPreselectedKnowledgeBasesPending,
  } = useGetUserPreselectedKnowledgeBases();

  if (userKnowledgeBasesPending || userPreselectedKnowledgeBasesPending) {
    return <Loading />;
  }

  if (
    !userKnowledgeBases ||
    !userPreselectedKnowledgeBases ||
    !userKnowledgeBases.userKnowledgeBases.length
  ) {
    return <Text>No knowledge bases available.</Text>;
  }

  // Group knowledge bases by provider
  const groupedKnowledgeBases: GroupedKnowledgeBase[] = [];

  userKnowledgeBases.userKnowledgeBases.forEach((kb) => {
    // see if the provider is already in the array
    const existingProvider = groupedKnowledgeBases.find(
      (group) => group.id === kb.kbProviderId
    );

    if (existingProvider) {
      // if it is, push the new knowledge base to the provider object in the array
      existingProvider.knowledgeBases.push({
        id: kb.id,
        label: kb.label,
      });

    } else {
      // if not, push the new provider and knowledge base to the array
      groupedKnowledgeBases.push({
        id: kb.kbProviderId,
        label: kb.kbProviderLabel,
        knowledgeBases: [
          {
            id: kb.id,
            label: kb.label,
          },
        ],
      });
    }
  });

  // Parse knowledge bases so its an array of strings
  const preselectedKnowledgeBases = userPreselectedKnowledgeBases
    .userPreselectedKnowledgeBases
    .map((kb) => kb.id);

  return (
    <Table data-testid='user-kb-providers-table'>
      <thead>
        <tr>
          <th>Provider</th>
          <th>Knowledge Base Name</th>
          <th>
            <Group spacing='xs' align='end'>
              Preselect
              <Tooltip label='These knowledge base(s) are preselected when interacting with LLMs'>
                <ThemeIcon size='xs' data-testid='user-kb-table-info-icon'>
                  <IconInfoCircle />
                </ThemeIcon>
              </Tooltip>
            </Group>
          </th>
        </tr>
      </thead>
      <tbody>
        {groupedKnowledgeBases.map((kb) => (
          <React.Fragment key={kb.id}>
            <UserKbProviderRow kbProvider={kb} />
            {kb.knowledgeBases.map((knowledgeBase) => (
              <UserKnowledgeBaseRow
                key={knowledgeBase.id}
                knowledgeBase={knowledgeBase}
                checked={preselectedKnowledgeBases.includes(knowledgeBase.id)}
              />
            ))
            }
          </React.Fragment>
        ))}
      </tbody>
    </Table>
  );
}
