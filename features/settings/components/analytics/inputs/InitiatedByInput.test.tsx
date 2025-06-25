import { UseFormReturnType, useForm } from '@mantine/form';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AnalyticsQuery, InitiatedBy, TimeRange } from '@/features/settings/types/analytics';
import InitiatedByInput from './InitiatedByInput';

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

jest.mock('@mantine/form', () => ({
  useForm: () => ({
    getInputProps: jest.fn().mockReturnValue({
      value: InitiatedBy.Any,
      onChange: jest.fn(),
    }),
  }),
}));

describe('InitiatedBy', () => {

  const mockForm: UseFormReturnType<AnalyticsQuery> = useForm<AnalyticsQuery>({
    initialValues: {
      initiatedBy: InitiatedBy.Any,
      aiProvider: 'all',
      model: 'all',
      timeRange: TimeRange.Month,
    },
    validate: jest.fn(),
  });

  it('renders initiatedByInput', () => {
    render(<InitiatedByInput form={mockForm} />);

    const initiatedBy = screen.getByLabelText('Initiated By');
    expect(initiatedBy).toBeInTheDocument();
    expect(initiatedBy).toHaveAttribute('placeholder', 'Select what initiated the AI call');
    expect(initiatedBy).toHaveValue(InitiatedBy.Any);
  });

  it('displays initiatedBy values', async () => {
    render(<InitiatedByInput form={mockForm} />);

    const initiatedBy = screen.getByLabelText('Initiated By');

    await userEvent.click(initiatedBy);

    await Promise.all(
      Object.values(InitiatedBy).map((value) =>
        waitFor(() => {
          expect(screen.getByText(value)).toBeInTheDocument();
        })
      )
    );
  });
});
