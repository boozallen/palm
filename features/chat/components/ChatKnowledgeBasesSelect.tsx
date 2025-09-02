import { forwardRef, useEffect, useMemo } from 'react';
import {
  Group,
  MultiSelect,
  MultiSelectValueProps,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';
import { useRouter } from 'next/router';

import { useChat } from '@/features/chat/providers/ChatProvider';
import useGetUserKnowledgeBases from '@/features/shared/api/get-user-knowledge-bases';
import useGetUserPreselectedKnowledgeBases from '@/features/shared/api/get-user-preselected-knowledge-bases';
import Loading from '@/features/shared/components/Loading';

type SelectItemProps = {
  label: string;
  selected: boolean;
};

type DisplayValueProps = MultiSelectValueProps & {
  knowledgeBaseIds: string[];
}

function DisplayValue({
  knowledgeBaseIds, onRemove: _Remove, ...others
}: DisplayValueProps) {

  return (
    <Title
      {...others}
      order={2}
      sx={(theme) => ({
        cursor: 'default',
        color: theme.colors.gray[6],
        backgroundColor: theme.colors.dark[7],
        border: theme.colors.dark[7],
        borderRadius: theme.radius.sm,
        margin: 'inherit',
        padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
        // show last-created element (if values.length = 1, show that element, if values.length = 4, show 4th element)
        display: 'none',
        ':last-of-type': {
          display: 'block',
        },
      })}
    >
      {knowledgeBaseIds.length} Knowledge Base
      {knowledgeBaseIds.length === 1 ? '' : 's'} Selected
    </Title>
  );
};

const SelectItem = forwardRef<HTMLDivElement, SelectItemProps>(
  function SelectItemWithRef(props, ref) {
    return (
      <Group spacing='sm' {...props} ref={ref}>
        {props.selected && (
          <ThemeIcon size='sm'>
            <IconCheck />
          </ThemeIcon>
        )}
        {props.label}
      </Group>
    );
  }
);

SelectItem.displayName = 'KnowledgeBaseSelectItem';

type RouterQuery = {
  knowledge_base_ids: string | undefined;
  chatId: string | undefined;
}

export default function ChatKnowledgeBasesSelect() {
  const { knowledgeBaseIds, setKnowledgeBaseIds } = useChat();

  const router = useRouter();
  const params = router.query as RouterQuery;

  const {
    data: userKnowledgeBases,
    isPending: userKnowledgeBasesIsPending,
  } = useGetUserKnowledgeBases();

  const {
    data: preselectedKnowledgeBases,
    isPending: preselectedKnowledgeBasesIsPending,
  } = useGetUserPreselectedKnowledgeBases();

  const knowledgeBaseOptions = useMemo(() => {
    if (!userKnowledgeBases?.userKnowledgeBases) {
      return [];
    }

    return userKnowledgeBases.userKnowledgeBases.map((knowledgeBase) => ({
      value: knowledgeBase.id,
      label: knowledgeBase.label,
      group: knowledgeBase.kbProviderLabel,
    }));
  }, [userKnowledgeBases]);

  const preselectedKnowledgeBasesIds = useMemo(() => {
    if (params?.knowledge_base_ids) {
      return params.knowledge_base_ids.split(',');
    } else if (params?.knowledge_base_ids === '') {
      return [];
    }

    if (!preselectedKnowledgeBases?.userPreselectedKnowledgeBases) {
      return [];
    }
    return preselectedKnowledgeBases.userPreselectedKnowledgeBases.map(
      (knowledgeBase) => knowledgeBase.id,
    );
  }, [preselectedKnowledgeBases, params?.knowledge_base_ids, params?.chatId]);

  useEffect(() => {
    if (preselectedKnowledgeBasesIds) {
      setKnowledgeBaseIds(preselectedKnowledgeBasesIds);
    }
  }, [
    preselectedKnowledgeBasesIds,
    setKnowledgeBaseIds,
  ]);

  const selectPlaceholder = knowledgeBaseOptions.length > 0 ?
    'Select knowledge base(s)' :
    'No knowledge bases available';

  if (userKnowledgeBasesIsPending || preselectedKnowledgeBasesIsPending) {
    return <Loading />;
  }

  return (
    <MultiSelect
      name='knowledge-base-multiselect'
      aria-label={selectPlaceholder}
      placeholder={selectPlaceholder}
      data={knowledgeBaseOptions}
      value={knowledgeBaseIds}
      valueComponent={(props) => (
        <DisplayValue {...props} knowledgeBaseIds={knowledgeBaseIds} />
      )}
      disableSelectedItemFiltering
      itemComponent={SelectItem}
      data-testid='knowledge-bases-select'
      searchable
      onChange={setKnowledgeBaseIds}
      disabled={knowledgeBaseOptions.length === 0}
    />
  );
}
