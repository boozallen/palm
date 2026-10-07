import { useEffect, useMemo, useState, useCallback } from 'react';
import { Box, Table, Text, Pagination, Stack } from '@mantine/core';

import Loading from '@/features/shared/components/Loading';
import { useGetRateCardCategories } from '@/features/ai-agents/api/rcast/get-rate-card-categories';
import { useGetRateCards } from '@/features/ai-agents/api/rcast/get-rate-cards';
import useFetchSalaryComData from '@/features/ai-agents/api/rcast/fetch-salary-com-data';
import RateCardCategoryRow from './RateCardCategoryRow';
import { BlsWageData, DolWageData, SalaryComWageData } from '@/features/ai-agents/shared/wage-data';
import { getRegionMapping } from '@/features/ai-agents/data/rcast/regionMappings';
import { PercentileKey } from '@/features/ai-agents/types/rcast/experienceLevel';

const ITEMS_PER_PAGE = 25;

export type RateCardCategory = {
  id: string;
  laborCategoryName: string;
  experienceLevel: string;
  billRate: number | null;
  mappedSocCode: string | null;
  mappedSocTitle: string | null;
  blsSalaryData: BlsWageData | null;
  dolSalaryData: DolWageData | null;
  lastSalaryUpdate: Date | null;
};

export type CategoryGroup = {
  baseName: string;
  variants: RateCardCategory[];
};

export function stripTrailingNumber(name: string): { baseName: string; num: number | null } {
  const match = /^(.*?)\s+(\d+)$/.exec(name.trim());
  if (match) {
    return { baseName: match[1], num: parseInt(match[2], 10) };
  }
  return { baseName: name.trim(), num: null };
}

function getExperienceLevelOrder(experienceLevel: string): number {
  const lvl = experienceLevel.toLowerCase().trim();
  if (lvl.startsWith('jun') || lvl === 'jr' || lvl === 'entry') { return 0; }
  if (lvl.startsWith('jour') || lvl === 'mid' || lvl === 'intermediate') { return 1; }
  if (lvl.startsWith('sen') || lvl === 'sr') { return 2; }
  return 3;
}

type SalaryComDataMap = Record<string, {
  data: SalaryComWageData | null;
  error: string | null;
  loading: boolean;
}>;

type RateCardTableProps = Readonly<{
  aiAgentId: string;
  selectedRateCardId?: string | null;
  onRateCardSelect?: (rateCardId: string | null) => void;
  geographicRegion: string;
  wrapRate: number;
}>;

export default function RateCardTable({
  aiAgentId,
  selectedRateCardId,
  onRateCardSelect: _onRateCardSelect,
  geographicRegion,
  wrapRate,
}: RateCardTableProps) {
  const { data: rateCards, isPending: isLoadingRateCards } = useGetRateCards(aiAgentId);
  const { data: categories, isPending } = useGetRateCardCategories(aiAgentId, selectedRateCardId ?? null);
  const [currentPage, setCurrentPage] = useState(1);

  const [salaryComEnabled, setSalaryComEnabled] = useState(false);
  const [salaryComData, setSalaryComData] = useState<SalaryComDataMap>({});
  const fetchSalaryComMutation = useFetchSalaryComData();

  const [selectedLevels, setSelectedLevels] = useState<Record<string, PercentileKey>>({});

  useEffect(() => {
    setCurrentPage(1);
    setSalaryComData({});
    setSelectedLevels({});
  }, [selectedRateCardId]);

  const categoriesTyped = categories as unknown as RateCardCategory[] | undefined;
  const groups = useMemo((): CategoryGroup[] => {
    if (!categoriesTyped) { return []; }

    const groupMap = new Map<string, RateCardCategory[]>();
    for (const cat of categoriesTyped) {
      const { baseName } = stripTrailingNumber(cat.laborCategoryName);
      const existing = groupMap.get(baseName) ?? [];
      existing.push(cat);
      groupMap.set(baseName, existing);
    }

    const result: CategoryGroup[] = [];
    groupMap.forEach((variants, baseName) => {
      const sorted = [...variants].sort(
        (a, b) => getExperienceLevelOrder(a.experienceLevel) - getExperienceLevelOrder(b.experienceLevel)
      );
      result.push({ baseName, variants: sorted });
    });

    return result.sort((a, b) => a.baseName.localeCompare(b.baseName));
  }, [categoriesTyped]);

  useEffect(() => {
    if (!groups.length) { return; }
    setSelectedLevels((prev) => {
      const next = { ...prev };
      for (const group of groups) {
        if (!next[group.baseName] && group.variants.length > 0) {
          next[group.baseName] = PercentileKey.JUNIOR;
        }
      }
      return next;
    });
  }, [groups]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(groups.length / ITEMS_PER_PAGE)), [groups]);

  const paginatedGroups = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return groups.slice(start, start + ITEMS_PER_PAGE);
  }, [currentPage, groups]);

  const fetchSalaryComForGroups = useCallback(async () => {
    if (!salaryComEnabled || !paginatedGroups.length) { return; }

    const toFetch = paginatedGroups
      .map((g) => g.baseName)
      .filter((name) => !salaryComData[name]);

    if (!toFetch.length) { return; }

    const loadingState: SalaryComDataMap = {};
    toFetch.forEach((name) => { loadingState[name] = { data: null, error: null, loading: true }; });
    setSalaryComData((prev) => ({ ...prev, ...loadingState }));

    for (const baseName of toFetch) {
      try {
        const result = await fetchSalaryComMutation.mutateAsync({ jobTitle: baseName });
        setSalaryComData((prev) => ({
          ...prev,
          [baseName]: {
            data: result.success && result.data ? {
              jobTitle: result.data.jobTitle,
              benchmarkJobTitle: result.data.benchmarkJobTitle,
              jobLevelName: result.data.jobLevelName,
              jobFamilyName: result.data.jobFamilyName,
              matchRating: result.data.matchRating,
              salary10: result.data.salary10,
              salary25: result.data.salary25,
              salary50: result.data.salary50,
              salary75: result.data.salary75,
              salary90: result.data.salary90,
              dataScope: { countryCode: 'USA', industryCode: '', industryName: '' },
              fetchedAt: new Date().toISOString(),
            } : null,
            error: result.success ? null : (result.error || 'Failed to fetch data'),
            loading: false,
          },
        }));
      } catch (error) {
        setSalaryComData((prev) => ({
          ...prev,
          [baseName]: {
            data: null,
            error: error instanceof Error ? error.message : 'Failed to fetch Salary.com data',
            loading: false,
          },
        }));
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }, [salaryComEnabled, paginatedGroups, salaryComData, fetchSalaryComMutation]);

  useEffect(() => {
    if (salaryComEnabled) { fetchSalaryComForGroups(); }
  }, [salaryComEnabled, currentPage, fetchSalaryComForGroups]);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) { setCurrentPage(totalPages); }
  }, [currentPage, totalPages]);

  const handleSalaryComToggle = (checked: boolean) => {
    setSalaryComEnabled(checked);
    if (!checked) { setSalaryComData({}); }
  };

  const handleLevelChange = (baseName: string, level: PercentileKey) => {
    setSelectedLevels((prev) => ({ ...prev, [baseName]: level }));
  };

  const localityMultiplier = getRegionMapping(geographicRegion).localityMultiplier;

  if (isLoadingRateCards) { return <Loading />; }

  if (!rateCards?.length) {
    return (
      <Box bg='dark.8' p='md'>
        <Text c='gray.4'>No rate cards have been uploaded yet.</Text>
      </Box>
    );
  }

  if (!selectedRateCardId) { return null; }

  if (isPending) { return <Loading />; }

  if (!categories?.length) {
    return (
      <Box bg='dark.8' p='md'>
        <Text c='gray.4'>No categories found in this rate card.</Text>
      </Box>
    );
  }

  return (
    <Stack spacing='lg'>
      <Table variant='rate_card_table' style={{ overflowX: 'auto' }}>
        <thead>
          <tr>
            <th>Labor Category</th>
            <th>Level</th>
            <th>Adjusted Rate ($/hr)</th>
            <th>SOC Code</th>
            <th>SOC Title</th>
            <th>BLS Wage ($/hr)</th>
            <th>DOL Wage ($/hr)</th>
          </tr>
        </thead>
        <tbody>
          {paginatedGroups.map((group) => {
            const selectedLevel = selectedLevels[group.baseName] ?? PercentileKey.JUNIOR;
            return (
              <RateCardCategoryRow
                key={group.baseName}
                group={group}
                selectedLevel={selectedLevel}
                salaryComData={null}
                salaryComError={null}
                salaryComLoading={false}
                salaryComEnabled={false}
                wrapRate={wrapRate}
                localityMultiplier={localityMultiplier}
                onLevelChange={handleLevelChange}
              />
            );
          })}
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
              case 'previous': return { 'aria-label': 'Previous' };
              case 'next': return { 'aria-label': 'Next' };
              default: return {};
            }
          }}
        />
      )}
    </Stack>
  );
}
