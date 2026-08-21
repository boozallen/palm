import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from '@mantine/form';

import { ContextStudioQuery, TimeRange } from '@/features/context-studio/types/context-studio';
import TimeRangeInput from './TimeRangeInput';

describe('TimeRangeInput', () => {
  let currentValues: ContextStudioQuery;

  const TimeRangeInputWrapper = () => {
    const form = useForm<ContextStudioQuery>({
      initialValues: {
        timeRange: TimeRange.Month,
        userGroupId: 'all',
        userId: 'all',
        excludeAdmins: false,
      },
    });

    currentValues = form.values;

    return <TimeRangeInput form={form} />;
  };

  const openDropdown = async () => {
    const user = userEvent.setup();
    render(<TimeRangeInputWrapper />);
    await user.click(screen.getByTestId('context-studio-time-range-input'));

    return user;
  };

  it('renders the time range select', () => {
    render(<TimeRangeInputWrapper />);

    expect(screen.getByTestId('context-studio-time-range-input')).toBeInTheDocument();
  });

  it('offers all six presets', async () => {
    await openDropdown();

    expect(screen.getAllByRole('option')).toHaveLength(6);
  });

  // The label text drives the interaction the way a user would; the assertion is
  // on the value the form receives, not on the text being present.
  it.each([
    ['Last 24 Hours', TimeRange.Day],
    ['Last 7 Days', TimeRange.Week],
    ['Last 30 Days', TimeRange.Month],
    ['Last 365 Days', TimeRange.Year],
    ['Year to Date', TimeRange.YearToDate],
    ['All Time', TimeRange.Forever],
  ])('selecting %s sets the form value to %s', async (label, expected) => {
    const user = await openDropdown();

    await user.click(screen.getByRole('option', { name: label }));

    expect(currentValues.timeRange).toBe(expected);
  });
});
