import React, { useState } from 'react';
import { MultiSelect, SimpleGrid, Loader } from '@mantine/core';
import { useGetTags } from '@/features/shared/api/get-tags';
import { useDebouncedValue } from '@mantine/hooks';

interface TagMultiselectProps {
  filteredTags: string[];
  setFilteredTags: (values: string[]) => void;
}

const TagMultiselect: React.FC<TagMultiselectProps> = ({
  filteredTags,
  setFilteredTags,
}) => {
  const [searchTagsQuery, setSearchTagsQuery] = useState('');
  const [debouncedSearchTagsQuery] = useDebouncedValue(searchTagsQuery, 500);

  const promptTagsData = useGetTags(debouncedSearchTagsQuery);
  const promptTags = promptTagsData.data?.tags ?? [];

  return (
    <SimpleGrid
      cols={2}
      pt='lg'
      px='xl'
      pb='0'
    >
      <MultiSelect
        data={[...new Set([...filteredTags, ...promptTags])]}
        maxSelectedValues={3}
        disableSelectedItemFiltering
        label='Tag'
        nothingFound='Nothing found'
        placeholder='Select tag(s)'
        onChange={setFilteredTags}
        value={filteredTags}
        searchable
        onSearchChange={setSearchTagsQuery}
        rightSection={promptTagsData.isFetching ? <Loader size='sm' /> : null}
      />
    </SimpleGrid>
  );
};

export default TagMultiselect;
