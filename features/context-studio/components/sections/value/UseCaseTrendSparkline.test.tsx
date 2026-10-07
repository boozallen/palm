import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';

import UseCaseTrendSparkline from './UseCaseTrendSparkline';
import { UseCaseWeekPoint } from '@/features/context-studio/types/use-case-detail';
import { USE_CASE_ACCENT_COLOR, USE_CASE_NEUTRAL_COLOR } from '@/features/context-studio/types/value';
import { appTheme } from '@/providers/AppMantineProvider';
import { UseCase } from '@/features/shared/types/use-case';

function renderWithTheme(ui: React.ReactElement) {
  return render(<MantineProvider theme={appTheme}>{ui}</MantineProvider>);
}

describe('UseCaseTrendSparkline', () => {
  const mockWeekly: UseCaseWeekPoint[] = [
    { weekStart: new Date('2024-01-01'), cost: 100, shareOfChatSpend: 0.25 },
    { weekStart: new Date('2024-01-08'), cost: 120, shareOfChatSpend: 0.30 },
    { weekStart: new Date('2024-01-15'), cost: 0, shareOfChatSpend: null },
    { weekStart: new Date('2024-01-22'), cost: 150, shareOfChatSpend: 0.35 },
    { weekStart: new Date('2024-01-29'), cost: 140, shareOfChatSpend: 0.32 },
  ];

  it('plots one point per week', () => {
    renderWithTheme(<UseCaseTrendSparkline useCase={UseCase.ProposalCapture} weekly={mockWeekly} />);
    const points = screen.getAllByTestId('use-case-trend-point');
    expect(points).toHaveLength(4);
  });

  it('skips a week where no chat spend landed', () => {
    const weekly: UseCaseWeekPoint[] = [
      { weekStart: new Date('2024-01-01'), cost: 100, shareOfChatSpend: 0.25 },
      { weekStart: new Date('2024-01-08'), cost: 120, shareOfChatSpend: 0.30 },
      { weekStart: new Date('2024-01-15'), cost: 0, shareOfChatSpend: null },
      { weekStart: new Date('2024-01-22'), cost: 150, shareOfChatSpend: 0.35 },
    ];
    renderWithTheme(<UseCaseTrendSparkline useCase={UseCase.ProposalCapture} weekly={weekly} />);
    const points = screen.getAllByTestId('use-case-trend-point');
    expect(points).toHaveLength(3);
  });

  it('states the range it covers', () => {
    renderWithTheme(<UseCaseTrendSparkline useCase={UseCase.ProposalCapture} weekly={mockWeekly} />);
    const caption = screen.getByTestId('use-case-trend-caption');
    expect(caption).toBeInTheDocument();
  });

  it('renders nothing when a single week is all there is', () => {
    const singleWeek: UseCaseWeekPoint[] = [
      { weekStart: new Date('2024-01-01'), cost: 100, shareOfChatSpend: 0.25 },
    ];
    renderWithTheme(<UseCaseTrendSparkline useCase={UseCase.ProposalCapture} weekly={singleWeek} />);
    expect(screen.getByTestId('use-case-trend-empty')).toBeInTheDocument();
  });

  it('renders empty state when weekly array is empty', () => {
    renderWithTheme(<UseCaseTrendSparkline useCase={UseCase.ProposalCapture} weekly={[]} />);
    expect(screen.getByTestId('use-case-trend-empty')).toBeInTheDocument();
  });

  it('renders empty state when all weeks have null shareOfChatSpend', () => {
    const allNull: UseCaseWeekPoint[] = [
      { weekStart: new Date('2024-01-01'), cost: 0, shareOfChatSpend: null },
      { weekStart: new Date('2024-01-08'), cost: 0, shareOfChatSpend: null },
      { weekStart: new Date('2024-01-15'), cost: 0, shareOfChatSpend: null },
    ];
    renderWithTheme(<UseCaseTrendSparkline useCase={UseCase.ProposalCapture} weekly={allNull} />);
    expect(screen.getByTestId('use-case-trend-empty')).toBeInTheDocument();
  });

  // Markers stay circular instead of stretching into ellipses that cover the line.
  it('scales both axes equally', () => {
    const { container } = renderWithTheme(<UseCaseTrendSparkline useCase={UseCase.ProposalCapture} weekly={mockWeekly} />);
    const svg = container.querySelector('svg');
    expect(svg).not.toHaveAttribute('preserveAspectRatio', 'none');
    expect(svg).toHaveAttribute('viewBox', '0 0 320 32');
  });

  it('keeps the first and last marker inside the plotted area', () => {
    const { container } = renderWithTheme(<UseCaseTrendSparkline useCase={UseCase.ProposalCapture} weekly={mockWeekly} />);
    const markers = [...container.querySelectorAll('[data-testid="use-case-trend-point"]')];
    const xs = markers.map((m) => Number(m.getAttribute('cx')));
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(6);
    expect(Math.max(...xs)).toBeLessThanOrEqual(314);
  });

  it('uses neutral color for Unclassified category', () => {
    const { container } = renderWithTheme(<UseCaseTrendSparkline useCase={UseCase.Unclassified} weekly={mockWeekly} />);
    const path = container.querySelector('path');
    expect(path).toHaveAttribute('stroke', USE_CASE_NEUTRAL_COLOR);
  });

  it('uses accent color for real categories', () => {
    const { container } = renderWithTheme(<UseCaseTrendSparkline useCase={UseCase.ProposalCapture} weekly={mockWeekly} />);
    const path = container.querySelector('path');
    expect(path).toHaveAttribute('stroke', USE_CASE_ACCENT_COLOR);
  });
});
