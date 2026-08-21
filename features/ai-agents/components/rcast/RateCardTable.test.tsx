import { render, screen } from '@testing-library/react';

import { useGetRateCards } from '@/features/ai-agents/api/rcast/get-rate-cards';
import { useGetRateCardCategories } from '@/features/ai-agents/api/rcast/get-rate-card-categories';
import RateCardTable from './RateCardTable';

jest.mock('./RateCardCategoryRow', () => {
  return function MockRateCardCategoryRow() {
    return (
      <tr>
        <td>Mock Rate Card Category Row</td>
      </tr>
    );
  };
});

jest.mock('@/features/ai-agents/api/rcast/get-rate-cards');
jest.mock('@/features/ai-agents/api/rcast/get-rate-card-categories');
jest.mock('@/features/ai-agents/api/rcast/fetch-salary-com-data', () => ({
  __esModule: true,
  default: () => ({
    mutateAsync: jest.fn(),
  }),
}));

describe('RateCardTable', () => {
  const mockAiAgentId = '7365c7c3-d10f-48cb-bfbc-0c2566f29599';

  const defaultProps = {
    aiAgentId: mockAiAgentId,
    geographicRegion: 'US Baseline',
    wrapRate: 2.04,
  };

  const mockRateCards = [
    {
      id: '0499945a-5bb1-4a13-9850-f8424654d003',
      filename: 'rate-card-2024.xlsx',
      uploadStatus: 'completed',
      createdAt: new Date('2024-01-01'),
    },
    {
      id: '50796284-970c-4c1c-bd07-02b981844a78',
      filename: 'rate-card-2023.xlsx',
      uploadStatus: 'completed',
      createdAt: new Date('2023-01-01'),
    },
  ];

  const mockCategories = [
    {
      id: 'cat-1',
      laborCategoryName: 'Software Engineer',
      experienceLevel: 'Senior',
      billRate: 150.0,
      mappedSocCode: '15-1252',
      mappedSocTitle: 'Software Developers',
      blsSalaryData: null,
      dolSalaryData: null,
      lastSalaryUpdate: null,
    },
    {
      id: 'cat-2',
      laborCategoryName: 'Data Scientist',
      experienceLevel: 'Mid-Level',
      billRate: 125.0,
      mappedSocCode: null,
      mappedSocTitle: null,
      blsSalaryData: null,
      dolSalaryData: null,
      lastSalaryUpdate: null,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    (useGetRateCards as jest.Mock).mockReturnValue({
      data: mockRateCards,
      isPending: false,
    });

    (useGetRateCardCategories as jest.Mock).mockReturnValue({
      data: mockCategories,
      isPending: false,
    });
  });

  it('renders loading state while rate cards are loading', () => {
    (useGetRateCards as jest.Mock).mockReturnValue({
      data: undefined,
      isPending: true,
    });

    render(<RateCardTable {...defaultProps} />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders no rate cards message when no rate cards exist', () => {
    (useGetRateCards as jest.Mock).mockReturnValue({
      data: [],
      isPending: false,
    });

    render(<RateCardTable {...defaultProps} />);

    expect(
      screen.getByText('No rate cards have been uploaded yet.')
    ).toBeInTheDocument();
  });

  it('renders table headers when rate card is selected', () => {
    render(
      <RateCardTable {...defaultProps} selectedRateCardId={mockRateCards[0].id} />
    );

    expect(screen.getByText('Labor Category')).toBeInTheDocument();
    expect(screen.getByText('Level')).toBeInTheDocument();
    expect(screen.getByText('SOC Code')).toBeInTheDocument();
  });

  it('does not render table when no rate card is selected', () => {
    render(<RateCardTable {...defaultProps} />);

    expect(
      screen.queryByText('Mock Rate Card Category Row')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Labor Category')).not.toBeInTheDocument();
  });

  it('does not display pagination when no rate card is selected', () => {
    render(<RateCardTable {...defaultProps} />);

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('renders category rows when rate card is selected', () => {
    render(
      <RateCardTable {...defaultProps} selectedRateCardId={mockRateCards[0].id} />
    );

    expect(screen.getAllByText('Mock Rate Card Category Row')).toHaveLength(2);
  });

  it('does not render a Salary.com toggle', () => {
    render(
      <RateCardTable {...defaultProps} selectedRateCardId={mockRateCards[0].id} />
    );

    expect(screen.queryByText('Salary.com')).not.toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });
});
