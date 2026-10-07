import { render, screen } from '@testing-library/react';
import { TimeRange } from '@/features/context-studio/types/context-studio';
import UserActivityChart from './UserActivityChart';

describe('UserActivityChart', () => {
  const mockTotalLoginsData = [
    { date: '2024-01-01', loginCount: 100 },
    { date: '2024-01-02', loginCount: 150 },
    { date: '2024-01-03', loginCount: 120 },
  ];

  const mockNewUsersData = [
    { date: '2024-01-01', count: 10 },
    { date: '2024-01-02', count: 15 },
    { date: '2024-01-03', count: 12 },
  ];

  const mockNoGroupUsersData = [
    { date: '2024-01-01', loginCount: 5 },
    { date: '2024-01-02', loginCount: 8 },
    { date: '2024-01-03', loginCount: 3 },
  ];

  const defaultProps = {
    totalLoginsData: mockTotalLoginsData,
    newUsersData: mockNewUsersData,
    noGroupUsersData: mockNoGroupUsersData,
    timeRange: TimeRange.Week,
    totalLogins: 370,
    uniqueUsers: 150,
    totalNewUsers: 37,
    totalNoGroupUsers: 16,
  };

  describe('Loading and empty states', () => {
    it('should render empty state when no data provided', () => {
      render(
        <UserActivityChart
          {...defaultProps}
          totalLoginsData={[]}
        />
      );

      expect(screen.getByText('User Activity')).toBeInTheDocument();
      expect(screen.getByText('No login data available.')).toBeInTheDocument();
    });

    it('should render empty state when totalLoginsData is undefined', () => {
      render(
        <UserActivityChart
          {...defaultProps}
          totalLoginsData={null as unknown as typeof mockTotalLoginsData}
        />
      );

      expect(screen.getByText('No login data available.')).toBeInTheDocument();
    });
  });

  describe('Data display', () => {
    it('should render chart title', () => {
      render(<UserActivityChart {...defaultProps} />);

      expect(screen.getByText('User Activity')).toBeInTheDocument();
    });

    it('should render total successful logins stat', () => {
      render(<UserActivityChart {...defaultProps} />);

      expect(screen.getByText('Login Events')).toBeInTheDocument();
      expect(screen.getByText('370')).toBeInTheDocument();
    });

    it('should render first-time users stat', () => {
      render(<UserActivityChart {...defaultProps} />);

      expect(screen.getByText('First-Time Users')).toBeInTheDocument();
      expect(screen.getByText('37')).toBeInTheDocument();
    });

    it('should render not yet in user group stat', () => {
      render(<UserActivityChart {...defaultProps} />);

      expect(screen.getByText('Not Yet in a User Group')).toBeInTheDocument();
      expect(screen.getByText('16')).toBeInTheDocument();
    });

    it('should render date range label', () => {
      render(<UserActivityChart {...defaultProps} />);

      const dateRangeText = screen.getByText(/Since/);
      expect(dateRangeText).toBeInTheDocument();
    });

    it('should render chart with SVG', () => {
      const { container } = render(<UserActivityChart {...defaultProps} />);

      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });
  });

  describe('Number formatting', () => {
    it('should format large numbers with commas', () => {
      render(
        <UserActivityChart
          {...defaultProps}
          totalLogins={1234567}
          totalNewUsers={98765}
          totalNoGroupUsers={4321}
        />
      );

      expect(screen.getByText('1,234,567')).toBeInTheDocument();
      expect(screen.getByText('98,765')).toBeInTheDocument();
      expect(screen.getByText('4,321')).toBeInTheDocument();
    });

    it('should handle zero values', () => {
      render(
        <UserActivityChart
          {...defaultProps}
          totalLogins={0}
          totalNewUsers={0}
          totalNoGroupUsers={0}
        />
      );

      expect(screen.getAllByText('0').length).toBeGreaterThan(0);
    });
  });

  describe('Time range handling', () => {
    it('should render with Week time range', () => {
      render(
        <UserActivityChart
          {...defaultProps}
          timeRange={TimeRange.Week}
        />
      );

      expect(screen.getByText('User Activity')).toBeInTheDocument();
    });

    it('should render with Month time range', () => {
      render(
        <UserActivityChart
          {...defaultProps}
          timeRange={TimeRange.Month}
        />
      );

      expect(screen.getByText('User Activity')).toBeInTheDocument();
    });

    it('should render with Year time range', () => {
      render(
        <UserActivityChart
          {...defaultProps}
          timeRange={TimeRange.Year}
        />
      );

      expect(screen.getByText('User Activity')).toBeInTheDocument();
    });

    it('should render with Forever time range', () => {
      render(
        <UserActivityChart
          {...defaultProps}
          timeRange={TimeRange.Forever}
        />
      );

      expect(screen.getByText('User Activity')).toBeInTheDocument();
    });
  });

  describe('Data reduction', () => {
    it('should handle large datasets', () => {
      const largeDataset = Array.from({ length: 100 }, (_, i) => ({
        date: `2024-01-${String(i + 1).padStart(2, '0')}`,
        loginCount: Math.floor(Math.random() * 1000),
      }));

      render(
        <UserActivityChart
          {...defaultProps}
          totalLoginsData={largeDataset}
        />
      );

      expect(screen.getByText('User Activity')).toBeInTheDocument();
    });

    it('should handle small datasets', () => {
      const smallDataset = [
        { date: '2024-01-01', loginCount: 50 },
      ];

      render(
        <UserActivityChart
          {...defaultProps}
          totalLoginsData={smallDataset}
        />
      );

      expect(screen.getByText('User Activity')).toBeInTheDocument();
    });
  });

  describe('Missing optional data', () => {
    it('should render without new users data', () => {
      render(
        <UserActivityChart
          {...defaultProps}
          newUsersData={[]}
          totalNewUsers={0}
        />
      );

      expect(screen.getByText('Login Events')).toBeInTheDocument();
      expect(screen.getByText('First-Time Users')).toBeInTheDocument();
    });

    it('should render without no group users data', () => {
      render(
        <UserActivityChart
          {...defaultProps}
          noGroupUsersData={[]}
          totalNoGroupUsers={0}
        />
      );

      expect(screen.getByText('Login Events')).toBeInTheDocument();
      expect(screen.getByText('Not Yet in a User Group')).toBeInTheDocument();
    });

    it('should render with partial date matches', () => {
      const partialNewUsersData = [
        { date: '2024-01-01', count: 5 },
      ];

      render(
        <UserActivityChart
          {...defaultProps}
          newUsersData={partialNewUsersData}
        />
      );

      expect(screen.getByText('User Activity')).toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('should handle dates at year boundaries', () => {
      const yearBoundaryData = [
        { date: '2023-12-31', loginCount: 100 },
        { date: '2024-01-01', loginCount: 150 },
      ];

      render(
        <UserActivityChart
          {...defaultProps}
          totalLoginsData={yearBoundaryData}
        />
      );

      expect(screen.getByText('User Activity')).toBeInTheDocument();
    });

    it('should handle very large login counts', () => {
      const largeCountData = [
        { date: '2024-01-01', loginCount: 1000000 },
      ];

      render(
        <UserActivityChart
          {...defaultProps}
          totalLoginsData={largeCountData}
          totalLogins={1000000}
        />
      );

      expect(screen.getByText('1,000,000')).toBeInTheDocument();
    });

    it('should render with all zero counts', () => {
      const zeroData = [
        { date: '2024-01-01', loginCount: 0 },
        { date: '2024-01-02', loginCount: 0 },
      ];

      render(
        <UserActivityChart
          {...defaultProps}
          totalLoginsData={zeroData}
          newUsersData={[]}
          noGroupUsersData={[]}
          totalLogins={0}
          totalNewUsers={0}
          totalNoGroupUsers={0}
        />
      );

      expect(screen.getByText('User Activity')).toBeInTheDocument();
    });
  });
});
