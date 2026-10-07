import { useEffect, useState } from 'react';
import { Stack } from '@mantine/core';

import TeamValueTable from './TeamValueTable';
import UseCaseDetailDrawer from './UseCaseDetailDrawer';
import UseCaseSpendSection from './UseCaseSpendSection';
import ValueHeadline from './ValueHeadline';
import useGetValueSummary from '@/features/context-studio/api/get-value-summary';
import StudioLoadError from '@/features/context-studio/components/sections/StudioLoadError';
import { TimeRange } from '@/features/context-studio/types/context-studio';
import { SpendRemainder } from '@/features/context-studio/types/value';
import { UseCase } from '@/features/shared/types/use-case';

// The Value tab: one query and three blocks. Read top to bottom it answers "is
// anyone using this", "are they doing real work", "does the output get used", and
// "what is it costing" in that order, because that is the order leadership asks
// them in.
//
// The limitations the spec requires the view to state live on the figures they
// qualify — ValueHeadline's tiles and UseCaseSpendSection's title and Unclassified
// row — not in a footnote block here. Seven sentences under three panels left the
// reader to work out which number each one was about; a tooltip on the number
// itself is there at the moment that number is questioned. Do not reinstate the
// block: the same sentences in two places are free to drift apart.

// The loading and error paths render the panel with every figure at zero rather
// than with an absent footer, so the layout does not jump when the query lands.
const EMPTY_REMAINDER: SpendRemainder = {
  platform: 0,
  workflow: 0,
  customAgent: 0,
  unattributed: 0,
};

type ValueSectionProps = Readonly<{
  timeRange: TimeRange;
  userGroupId: string;
  userId: string;
  enabled: boolean;
}>;

export default function ValueSection({
  timeRange,
  userGroupId,
  userId,
  enabled,
}: ValueSectionProps) {
  const {
    data: summary,
    isFetching,
    error,
  } = useGetValueSummary(timeRange, userGroupId, userId, enabled);

  const [selected, setSelected] = useState<UseCase | null>(null);

  // Clear selected when filters change.
  useEffect(() => {
    setSelected(null);
  }, [timeRange, userGroupId, userId]);

  // A rejected query leaves every field undefined, and rendering zeros for them
  // would read as a genuinely idle period rather than as a broken panel.
  if (error) {
    return <StudioLoadError />;
  }

  const loading = isFetching || !summary;

  return (
    <Stack spacing='lg'>
      <ValueHeadline summary={summary} loading={loading} />

      <UseCaseSpendSection
        byUseCase={summary?.byUseCase ?? []}
        chatCost={summary?.chatCost ?? 0}
        remainder={summary?.remainder ?? EMPTY_REMAINDER}
        totalCost={summary?.totalCost ?? 0}
        systemCost={summary?.systemCost ?? 0}
        loading={loading}
        onSelectUseCase={setSelected}
      />

      <TeamValueTable
        byTeam={summary?.byTeam ?? []}
        activePeople={summary?.activePeople.value ?? 0}
        loading={loading}
      />

      <UseCaseDetailDrawer
        useCase={selected}
        chatCost={summary?.chatCost ?? 0}
        timeRange={timeRange}
        userGroupId={userGroupId}
        userId={userId}
        onClose={() => setSelected(null)}
      />
    </Stack>
  );
}
