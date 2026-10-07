import { Card, Grid, Skeleton } from '@mantine/core';
import { TimeRange, UserActivityStats } from '@/features/context-studio/types/context-studio';
import UserActivityChart from '@/features/context-studio/components/UserActivityChart';

type UserActivitySectionProps = Readonly<{
  userActivityStats: UserActivityStats | undefined;
  userActivityStatsLoading: boolean;
  timeRange: TimeRange | undefined;
}>;

export default function UserActivitySection({
  userActivityStats,
  userActivityStatsLoading,
  timeRange,
}: UserActivitySectionProps) {
  if (userActivityStatsLoading) {
    return (
      <Grid.Col span={6}>
        <Card shadow='sm' padding='lg' radius='md' withBorder>
          <Skeleton height={300} />
        </Card>
      </Grid.Col>
    );
  }

  if (!userActivityStats || !userActivityStats.auditLoginTimeSeries || userActivityStats.auditLoginTimeSeries.length === 0) {
    return null;
  }

  return (
    <Grid.Col span={6}>
      <UserActivityChart
        totalLoginsData={userActivityStats.auditLoginTimeSeries}
        newUsersData={userActivityStats.userCreatedTimeSeries}
        noGroupUsersData={userActivityStats.auditLoginBlockedTimeSeries}
        timeRange={timeRange || TimeRange.Forever}
        totalLogins={userActivityStats.auditLogins}
        uniqueUsers={userActivityStats.auditUniqueUsers}
        totalNewUsers={userActivityStats.userCreatedCount}
        totalNoGroupUsers={userActivityStats.auditLoginsBlocked}
      />
    </Grid.Col>
  );
}
