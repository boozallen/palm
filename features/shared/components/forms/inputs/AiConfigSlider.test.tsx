import { render, screen } from '@testing-library/react';
import AiConfigSlider from './AiConfigSlider';

jest.mock('@/features/shared/components/elements/InfoPopover', () => {
  return function MockInfoPopover({ label }: { label: string }) {
    return <div data-testid='mock-info-popover' data-label={label} />;
  };
});

jest.mock('@mantine/core', () => {
  const actualMantine = jest.requireActual('@mantine/core');
  return {
    ...actualMantine,
    Slider: ({ thumbLabel, value, onChange, onFocus, onBlur, min = 0, max = 1, step = 0.1 }: {
      thumbLabel?: string;
      value: number;
      onChange?: (value: number) => void;
      onFocus?: React.FocusEventHandler<HTMLInputElement>;
      onBlur?: React.FocusEventHandler<HTMLInputElement>;
      min?: number;
      max?: number;
      step?: number;
    }) => (
      <div data-testid='mock-slider-container'>
        <label id={`${thumbLabel ?? 'slider'}-label`}>{thumbLabel}</label>
        <input
          type='range'
          aria-labelledby={`${thumbLabel ?? 'slider'}-label`}
          data-testid='mock-slider'
          aria-valuenow={value}
          min={String(min)}
          max={String(max)}
          step={String(step)}
          value={String(value || 0)}
          onChange={(e) => onChange && onChange(parseFloat(e.target.value))}
          onFocus={onFocus}
          onBlur={onBlur}
        />
      </div>
    ),
  };
});

describe('AiConfigSlider', () => {
  const label = 'Slider';
  const value = 0.5;
  const onChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('displays label and value', () => {
    render(
      <AiConfigSlider
        label={label}
        value={value}
        onChange={onChange}
      />
    );

    const title = screen.getByText(`${label} (${value})`);
    expect(title).toBeInTheDocument();
  });

  it('renders slider', () => {
    render(
      <AiConfigSlider
        label={label}
        value={value}
        onChange={onChange}
      />
    );

    const slider = screen.getByRole('slider');
    expect(slider).toBeInTheDocument();
  });

  it('sets slider to correct value', () => {
    render(
      <AiConfigSlider
        label={label}
        value={value}
        onChange={onChange}
      />
    );

    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('aria-valuenow', `${value}`);
  });

  it('renders InfoPopover with label', () => {
    render(
      <AiConfigSlider
        label={label}
        value={value}
        onChange={onChange}
      />
    );

    const popover = screen.getByTestId('mock-info-popover');
    expect(popover).toBeInTheDocument();
    expect(popover).toHaveAttribute('data-label', label);
  });
});
