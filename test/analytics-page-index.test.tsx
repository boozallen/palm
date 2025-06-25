import { render, screen } from '@testing-library/react';
import AnalyticsPage from '@/pages/analytics';

jest.mock('@/features/settings/components/analytics/Analytics', () => {
  return function MockedAnalyticsComponent() {
    return <div>Analytics Component</div>;
  };
});

describe('AnalyticsPage', () => {

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('renders analytics page and component', () => {
    render(<AnalyticsPage />);
    expect(screen.queryByText('Analytics')).toBeInTheDocument();
    expect(screen.queryByText('Gain insights into application usage with advanced filtering options.')).toBeInTheDocument();
    expect(screen.queryByText('Analytics Component')).toBeInTheDocument();
  });

});
