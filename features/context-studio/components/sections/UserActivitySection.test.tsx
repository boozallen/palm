import { render, screen } from '@testing-library/react';
import { Grid } from '@mantine/core';
import UserActivitySection from './UserActivitySection';
import { TimeRange, UserActivityStats } from '@/features/context-studio/types/context-studio';

describe('UserActivitySection', () => {
  const mockUserActivityStats: UserActivityStats = {
    totalUsers: 100,
    userGroups: 5,
    logins: 500,
    totalSessions: 300,
    newUsersThisWeek: 10,
    newUsersPreviousWeek: 8,
    joinCodeUses: 2,
    auditLogins: 450,
    auditUniqueUsers: 200,
    auditLoginsBlocked: 15,
    userCreatedCount: 95,
    earliestUserCreatedDate: '2023-01-01',
    userActivityTimeSeries: [
      {
        date: '2024-01-01',
        logins: 100,
        sessions: 80,
        newUsers: 5,
      },
      {
        date: '2024-01-02',
        logins: 120,
        sessions: 90,
        newUsers: 3,
      },
    ],
    auditLoginTimeSeries: [
      { date: '2024-01-01', loginCount: 95 },
      { date: '2024-01-02', loginCount: 110 },
    ],
    auditLoginBlockedTimeSeries: [
      { date: '2024-01-01', loginCount: 5 },
      { date: '2024-01-02', loginCount: 10 },
    ],
    userCreatedTimeSeries: [
      { date: '2024-01-01', count: 3 },
      { date: '2024-01-02', count: 2 },
    ],
  };

  const renderWithGrid = (
    userActivityStats: UserActivityStats | undefined,
    userActivityStatsLoading: boolean,
    timeRange: TimeRange | undefined = TimeRange.Week
  ) => {
    return render(
      <Grid>
        <UserActivitySection
          userActivityStats={userActivityStats}
          userActivityStatsLoading={userActivityStatsLoading}
          timeRange={timeRange}
        />
      </Grid>
    );
  };

  describe('Loading state', () => {
    it('should render skeleton when loading', () => {
      renderWithGrid(undefined, true);

      const skeleton = document.querySelector('.mantine-Skeleton-root');
      expect(skeleton).toBeInTheDocument();
    });

    it('should not render chart when loading', () => {
      renderWithGrid(undefined, true);

      expect(screen.queryByText('User Activity')).not.toBeInTheDocument();
    });
  });

  describe('No data state', () => {
    it('should render null when not loading and no stats', () => {
      const { container } = renderWithGrid(undefined, false);

      expect(screen.queryByText('User Activity')).not.toBeInTheDocument();
      expect(container.querySelector('[data-testid="audit-login-section"]')).not.toBeInTheDocument();
    });

    it('should render null when auditLoginTimeSeries is undefined', () => {
      const statsWithoutTimeSeries = {
        ...mockUserActivityStats,
        auditLoginTimeSeries: undefined as unknown as typeof mockUserActivityStats.auditLoginTimeSeries,
      };

      renderWithGrid(statsWithoutTimeSeries, false);

      expect(screen.queryByText('User Activity')).not.toBeInTheDocument();
    });

    it('should render null when auditLoginTimeSeries is empty', () => {
      const statsWithEmptyTimeSeries = {
        ...mockUserActivityStats,
        auditLoginTimeSeries: [],
      };

      renderWithGrid(statsWithEmptyTimeSeries, false);

      expect(screen.queryByText('User Activity')).not.toBeInTheDocument();
    });
  });

  describe('Data display', () => {
    it('should render chart when data is available', () => {
      renderWithGrid(mockUserActivityStats, false);

      expect(screen.getByText('User Activity')).toBeInTheDocument();
    });

    it('should pass correct totalLoginsData to chart', () => {
      renderWithGrid(mockUserActivityStats, false);

      expect(screen.getByText('User Activity')).toBeInTheDocument();
      expect(screen.getByText('450')).toBeInTheDocument();
    });

    it('should pass correct newUsersData to chart', () => {
      renderWithGrid(mockUserActivityStats, false);

      expect(screen.getByText('95')).toBeInTheDocument();
    });

    it('should pass correct noGroupUsersData to chart', () => {
      renderWithGrid(mockUserActivityStats, false);

      expect(screen.getByText('15')).toBeInTheDocument();
    });

    it('should render with span 6 grid column', () => {
      const { container } = renderWithGrid(mockUserActivityStats, false);

      const gridCol = container.querySelector('.mantine-Grid-col');
      expect(gridCol).toBeInTheDocument();
    });
  });

  describe('Time range handling', () => {
    it('should use provided time range', () => {
      renderWithGrid(mockUserActivityStats, false, TimeRange.Month);

      expect(screen.getByText('User Activity')).toBeInTheDocument();
    });

    it('should default to Forever when timeRange is undefined', () => {
      renderWithGrid(mockUserActivityStats, false, undefined);

      expect(screen.getByText('User Activity')).toBeInTheDocument();
    });

    it('should handle Week time range', () => {
      renderWithGrid(mockUserActivityStats, false, TimeRange.Week);

      expect(screen.getByText('User Activity')).toBeInTheDocument();
    });

    it('should handle Year time range', () => {
      renderWithGrid(mockUserActivityStats, false, TimeRange.Year);

      expect(screen.getByText('User Activity')).toBeInTheDocument();
    });
  });

  describe('Props passing to AuditLoginCombinedChart', () => {
    it('should pass empty arrays when data is missing but stats exist', () => {
      const minimalStats: UserActivityStats = {
        ...mockUserActivityStats,
        userCreatedTimeSeries: [],
        auditLoginBlockedTimeSeries: [],
      };

      renderWithGrid(minimalStats, false);

      expect(screen.getByText('User Activity')).toBeInTheDocument();
    });

    it('should pass all totals correctly', () => {
      renderWithGrid(mockUserActivityStats, false);

      expect(screen.getByText('450')).toBeInTheDocument();
      expect(screen.getByText('95')).toBeInTheDocument();
      expect(screen.getByText('15')).toBeInTheDocument();
    });

    it('should handle zero values', () => {
      const zeroStats: UserActivityStats = {
        ...mockUserActivityStats,
        auditLogins: 0,
        userCreatedCount: 0,
        auditLoginsBlocked: 0,
        auditLoginTimeSeries: [
          { date: '2024-01-01', loginCount: 0 },
        ],
      };

      renderWithGrid(zeroStats, false);

      expect(screen.getByText('User Activity')).toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('should handle stats with minimal time series data', () => {
      const minimalStats: UserActivityStats = {
        ...mockUserActivityStats,
        auditLoginTimeSeries: [
          { date: '2024-01-01', loginCount: 50 },
        ],
      };

      renderWithGrid(minimalStats, false);

      expect(screen.getByText('User Activity')).toBeInTheDocument();
    });

    it('should handle very large datasets', () => {
      const largeStats: UserActivityStats = {
        ...mockUserActivityStats,
        auditLoginTimeSeries: Array.from({ length: 365 }, (_, i) => ({
          date: `2024-01-${String((i % 30) + 1).padStart(2, '0')}`,
          loginCount: Math.floor(Math.random() * 1000),
        })),
      };

      renderWithGrid(largeStats, false);

      expect(screen.getByText('User Activity')).toBeInTheDocument();
    });

    it('should render correctly when switching from loading to loaded', () => {
      const { rerender } = render(
        <Grid>
          <UserActivitySection
            userActivityStats={undefined}
            userActivityStatsLoading={true}
            timeRange={TimeRange.Week}
          />
        </Grid>
      );

      const skeleton = document.querySelector('.mantine-Skeleton-root');
      expect(skeleton).toBeInTheDocument();

      rerender(
        <Grid>
          <UserActivitySection
            userActivityStats={mockUserActivityStats}
            userActivityStatsLoading={false}
            timeRange={TimeRange.Week}
          />
        </Grid>
      );

      expect(screen.getByText('User Activity')).toBeInTheDocument();
    });
  });
});
