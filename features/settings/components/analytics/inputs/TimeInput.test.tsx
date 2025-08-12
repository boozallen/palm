import { render, screen, waitFor } from '@testing-library/react';
import { UseFormReturnType, useForm } from '@mantine/form';
import userEvent from '@testing-library/user-event';

import { AnalyticsQuery, InitiatedBy, TimeRange } from '@/features/settings/types/analytics';
import TimeInput from './TimeInput';

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

jest.mock('@mantine/form', () => ({
  useForm: () => ({
    getInputProps: jest.fn().mockReturnValue({
      value: TimeRange.Month,
      onChange: jest.fn(),
    }),
  }),
}));

describe('TimeInput', () => {

  const mockForm: UseFormReturnType<AnalyticsQuery> = useForm<AnalyticsQuery>({
    initialValues: {
      initiatedBy: InitiatedBy.Any,
      aiProvider: 'all',
      model: 'all',
      timeRange: TimeRange.Month,
    },
    validate: jest.fn(),
  });

  it('renders timeInput', () => {
    render(<TimeInput form={mockForm} />);

    const timeInput = screen.getByLabelText('Time Range');
    expect(timeInput).toBeInTheDocument();
    expect(timeInput).toHaveAttribute('placeholder', 'Select time range');
    expect(timeInput).toHaveValue(TimeRange.Month);
  });

  it('displays time periods', async () => {
    render(<TimeInput form={mockForm} />);

    const timeInput = screen.getByLabelText('Time Range');

    await userEvent.click(timeInput);

    await waitFor(() => {
      expect(screen.getByText(TimeRange.Day)).toBeInTheDocument();
      expect(screen.getByText(TimeRange.Month)).toBeInTheDocument();
      expect(screen.getByText(TimeRange.Week)).toBeInTheDocument();
      expect(screen.getByText(TimeRange.Year)).toBeInTheDocument();
    });
  });
});
