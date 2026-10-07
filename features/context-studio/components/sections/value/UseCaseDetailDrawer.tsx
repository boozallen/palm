import { Divider, Drawer, Group, Skeleton, Stack, Text, useMantineTheme } from '@mantine/core';

import useGetUseCaseDetail from '@/features/context-studio/api/get-use-case-detail';
import useGetUseCaseThemes from '@/features/context-studio/api/get-use-case-themes';
import StudioLoadError from '@/features/context-studio/components/sections/StudioLoadError';
import UseCaseArtifactList from '@/features/context-studio/components/sections/value/UseCaseArtifactList';
import UseCaseChatList from '@/features/context-studio/components/sections/value/UseCaseChatList';
import UseCasePeopleTeams from '@/features/context-studio/components/sections/value/UseCasePeopleTeams';
import UseCaseThemesBlock from '@/features/context-studio/components/sections/value/UseCaseThemesBlock';
import UseCaseTrendSparkline from '@/features/context-studio/components/sections/value/UseCaseTrendSparkline';
import { TimeRange } from '@/features/context-studio/types/context-studio';
import { formatCount, formatPercent, formatUnitCost, rate } from '@/features/context-studio/utils/valueFormat';
import { UseCase, USE_CASE_LABELS } from '@/features/shared/types/use-case';
import { formatCurrencyNumberForAnalytics } from '@/features/shared/utils';

const DRAWER_WIDTH = 720;

// The drawer never has filters of its own, so any figure in it ties to the row that opened it.

type UseCaseDetailDrawerProps = Readonly<{
  useCase: UseCase | null;
  chatCost: number;
  timeRange: TimeRange;
  userGroupId: string;
  userId: string;
  onClose: () => void;
}>;

export default function UseCaseDetailDrawer({
  useCase,
  chatCost,
  timeRange,
  userGroupId,
  userId,
  onClose,
}: UseCaseDetailDrawerProps) {
  const theme = useMantineTheme();
  const isEnabled = useCase !== null;
  const activeUseCase = useCase ?? UseCase.Unclassified;

  const detailQuery = useGetUseCaseDetail(activeUseCase, timeRange, userGroupId, userId, isEnabled);
  const themesQuery = useGetUseCaseThemes(activeUseCase, timeRange, userGroupId, userId, isEnabled);

  const detail = detailQuery.data;

  const numeric = {
    fontFamily: theme.fontFamilyMonospace,
    textAlign: 'right' as const,
  };

  // Narrowing on useCase rather than isEnabled so the render below can index
  // USE_CASE_LABELS without re-checking for null.
  if (useCase === null) {
    return null;
  }

  return (
    <Drawer
      opened
      onClose={onClose}
      position='right'
      size={DRAWER_WIDTH}
      withCloseButton
      data-testid='use-case-detail-drawer'
      title={
        <Text size='lg' weight={theme.other.fontWeights.medium}>
          {USE_CASE_LABELS[useCase]}
        </Text>
      }
    >
      {detailQuery.isError ? (
        <StudioLoadError />
      ) : detailQuery.isLoading || !detail ? (
        <Stack spacing='md'>
          <Skeleton height={40} />
          <Skeleton height={200} />
          <Skeleton height={300} />
        </Stack>
      ) : (
        <Stack spacing='lg'>
          <Group position='apart' data-testid='use-case-detail-header'>
            <Stack spacing='xxs'>
              <Text size='xs' c='dimmed'>
                Spend
              </Text>
              <Text size='md' style={numeric}>
                {formatCurrencyNumberForAnalytics(detail.cost)}
              </Text>
            </Stack>
            <Stack spacing='xxs'>
              <Text size='xs' c='dimmed'>
                Share
              </Text>
              <Text size='md' style={numeric}>
                {formatPercent(rate(detail.cost, chatCost))}
              </Text>
            </Stack>
            <Stack spacing='xxs'>
              <Text size='xs' c='dimmed'>
                Made
              </Text>
              <Text size='md' style={numeric}>
                {formatCount(detail.artifacts)}
              </Text>
            </Stack>
            <Stack spacing='xxs'>
              <Text size='xs' c='dimmed'>
                Used
              </Text>
              <Text size='md' style={numeric}>
                {formatCount(detail.putToWork)}
              </Text>
            </Stack>
            <Stack spacing='xxs'>
              <Text size='xs' c='dimmed'>
                Per used
              </Text>
              <Text size='md' style={numeric}>
                {formatUnitCost(rate(detail.cost, detail.putToWork))}
              </Text>
            </Stack>
          </Group>

          <Divider />

          <UseCaseThemesBlock
            themes={themesQuery.data}
            loading={themesQuery.isLoading}
            failed={themesQuery.isError}
          />

          <Divider />

          <UseCaseTrendSparkline
            useCase={detail.useCase}
            weekly={detail.weekly.map((point) => ({
              ...point,
              weekStart: new Date(point.weekStart),
            }))}
          />

          <Divider />

          <UseCaseChatList
            chats={detail.chats.map((chat) => ({
              ...chat,
              createdAt: new Date(chat.createdAt),
            }))}
            totalChats={detail.totalChats}
            useCase={useCase}
            timeRange={timeRange}
            userGroupId={userGroupId}
            userId={userId}
          />

          <Divider />

          <UseCasePeopleTeams
            people={detail.people}
            teams={detail.teams}
          />

          <Divider />

          <Stack spacing='xs'>
            <Text size='xs' weight={theme.other.fontWeights.medium} c='gray.5' tt='uppercase'>
              Work products
            </Text>
            <UseCaseArtifactList
              artifacts={detail.artifactList}
            />
          </Stack>
        </Stack>
      )}
    </Drawer>
  );
}
