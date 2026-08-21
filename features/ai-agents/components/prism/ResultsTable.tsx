import { useMemo, useState } from 'react';
import { Table, Stack, Text, Switch, Pagination, Tabs } from '@mantine/core';

import ResultRow from './ResultRow';
import type { ComplianceResult } from '@/features/ai-agents/types/prism/complianceResult';

const ITEMS_PER_PAGE = 50;

type ResultsTableProps = Readonly<{
  items: ComplianceResult[];
  showCitations: boolean;
  onShowCitationsChange: (show: boolean) => void;
}>;

export default function ResultsTable({ items, showCitations, onShowCitationsChange }: ResultsTableProps) {
  const [currentPage, setCurrentPage] = useState(1);

  const hasCategories = useMemo(() => items.some((r) => r.category !== null), [items]);

  const categories = useMemo(() => {
    if (!hasCategories) {
      return [];
    }
    return [...new Set(items.map((r) => r.category ?? ''))];
  }, [items, hasCategories]);

  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const activeItems = useMemo(() => {
    if (!hasCategories) {
      return items;
    }
    const cat = activeCategory ?? categories[0] ?? null;
    return items.filter((r) => (r.category ?? '') === cat);
  }, [items, hasCategories, activeCategory, categories]);

  const totalPages = useMemo(() => Math.ceil(activeItems.length / ITEMS_PER_PAGE), [activeItems]);

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return activeItems.slice(start, start + ITEMS_PER_PAGE);
  }, [activeItems, currentPage]);

  const handleTabChange = (value: string | null) => {
    setActiveCategory(value);
    setCurrentPage(1);
  };

  return (
    <Stack spacing='lg'>
      {hasCategories && (
        <Tabs
          value={activeCategory ?? categories[0] ?? null}
          onTabChange={handleTabChange}
        >
          <Tabs.List>
            {categories.map((cat) => (
              <Tabs.Tab key={cat} value={cat}>
                {cat}
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs>
      )}

      <Table striped highlightOnHover style={{ overflowX: 'auto' }}>
        <thead>
          <tr>
            <th>Requirement</th>
            <th style={{ width: '12%' }}>Status</th>
            <th style={{ width: '30%' }}>Reasoning</th>
            <th style={{ width: '15%' }}>
              <Stack spacing={4} align='center'>
                <Text size='sm'>Citations</Text>
                <Switch
                  size='xs'
                  checked={showCitations}
                  onChange={(e) => onShowCitationsChange(e.currentTarget.checked)}
                  aria-label='Toggle citations'
                />
              </Stack>
            </th>
          </tr>
        </thead>
        <tbody>
          {paginatedItems.map((item) => (
            <ResultRow
              key={item.id}
              item={item}
              showCitations={showCitations}
            />
          ))}
        </tbody>
      </Table>

      {totalPages > 1 && (
        <Pagination
          total={totalPages}
          value={currentPage}
          onChange={setCurrentPage}
          position='right'
          getControlProps={(control) => {
            switch (control) {
              case 'previous':
                return { 'aria-label': 'Previous' };
              case 'next':
                return { 'aria-label': 'Next' };
              default:
                return {};
            }
          }}
        />
      )}
    </Stack>
  );
}
