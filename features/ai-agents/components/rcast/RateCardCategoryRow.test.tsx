import { render, screen } from '@testing-library/react';

import RateCardCategoryRow from './RateCardCategoryRow';
import { PercentileKey } from '@/features/ai-agents/types/rcast/experienceLevel';
import type { CategoryGroup } from './RateCardTable';

describe('RateCardCategoryRow', () => {
  const mockGroup: CategoryGroup = {
    baseName: 'Software Engineer',
    variants: [
      {
        id: '0499945a-5bb1-4a13-9850-f8424654d003',
        laborCategoryName: 'Software Engineer',
        experienceLevel: 'Senior',
        billRate: 150.5,
        mappedSocCode: '15-1252.00',
        mappedSocTitle: 'Software Developers',
        blsSalaryData: null,
        dolSalaryData: null,
        lastSalaryUpdate: null,
      },
    ],
  };

  // 'Senior' maps to PercentileKey.PCT_75 via getPercentileForExperienceLevel
  const defaultProps = {
    group: mockGroup,
    selectedLevel: PercentileKey.PCT_75,
    salaryComData: null,
    salaryComError: null,
    salaryComLoading: false,
    salaryComEnabled: false,
    wrapRate: 2.04,
    localityMultiplier: 1.0,
    onLevelChange: jest.fn(),
  };

  const container = document.body
    .appendChild(document.createElement('table'))
    .appendChild(document.createElement('tbody'));

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders labor category base name', () => {
    render(<RateCardCategoryRow {...defaultProps} />, { container });

    expect(screen.getByText('Software Engineer')).toBeInTheDocument();
  });

  it('renders adjusted bill rate with fee formula applied', () => {
    render(<RateCardCategoryRow {...defaultProps} />, { container });

    // $150.50 × (1 - 12.5%) ÷ 2.04 × 1.0 = $64.55
    expect(screen.getByText('$64.55')).toBeInTheDocument();
  });

  it('renders $0.00 when bill rate is null', () => {
    const groupNullRate: CategoryGroup = {
      ...mockGroup,
      variants: [{ ...mockGroup.variants[0], billRate: null }],
    };

    render(<RateCardCategoryRow {...defaultProps} group={groupNullRate} />, { container });

    expect(screen.getByText('$0.00')).toBeInTheDocument();
  });

  it('applies locality multiplier to adjusted rate', () => {
    render(
      <RateCardCategoryRow {...defaultProps} localityMultiplier={1.2501} />,
      { container }
    );

    // $150.50 × (1 - 12.5%) ÷ 2.04 × 1.2501 ≈ $80.70
    expect(screen.getByText('$80.70')).toBeInTheDocument();
  });

  it('renders SOC code from matched variant', () => {
    render(<RateCardCategoryRow {...defaultProps} />, { container });

    expect(screen.getByText('15-1252.00')).toBeInTheDocument();
  });

  it('renders dash when SOC code is null', () => {
    const groupNoSoc: CategoryGroup = {
      ...mockGroup,
      variants: [{ ...mockGroup.variants[0], mappedSocCode: null }],
    };

    render(<RateCardCategoryRow {...defaultProps} group={groupNoSoc} />, { container });

    // SOC code, BLS wage, DOL wage → at least 3 dashes
    expect(screen.getAllByText('-').length).toBeGreaterThanOrEqual(3);
  });

  it('renders SOC title', () => {
    render(<RateCardCategoryRow {...defaultProps} />, { container });

    expect(screen.getByText('Software Developers')).toBeInTheDocument();
  });

  it('renders dash when SOC code and SOC title are null', () => {
    const groupNoSocInfo: CategoryGroup = {
      ...mockGroup,
      variants: [
        { ...mockGroup.variants[0], mappedSocCode: null, mappedSocTitle: null },
      ],
    };

    render(<RateCardCategoryRow {...defaultProps} group={groupNoSocInfo} />, { container });

    // SOC code, SOC title, BLS wage, DOL wage → 4 dashes
    expect(screen.getAllByText('-')).toHaveLength(4);
  });
});
