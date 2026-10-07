import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';

import PromptConfig from './PromptConfig';

// Track onChange calls from the component
let capturedOnChange: jest.Mock;

// Mock useGetAvailableModels
jest.mock('@/features/shared/api/get-available-models', () => ({
  __esModule: true,
  default: () => ({ data: { availableModels: [] } }),
}));

// Mock useWorkflowBuilder - only pinnedGroup is read by PromptConfig
jest.mock('@/features/workflows/providers/WorkflowBuilderProvider', () => ({
  useWorkflowBuilder: () => ({ pinnedGroup: null }),
}));

// Mock PromptSelector
jest.mock('@/features/workflows/components/nodes/config/inputs/PromptSelector', () => ({
  __esModule: true,
  default: () => <div data-testid='prompt-selector' />,
}));

// Mock Mantine hooks
jest.mock('@mantine/hooks', () => ({
  useDisclosure: () => [false, { open: jest.fn(), close: jest.fn() }],
}));

// Mock Mantine components with minimal implementations
jest.mock('@mantine/core', () => {
  const React = require('react');
  const PopoverMock = ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children);
  const PopoverTarget = ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children);
  PopoverTarget.displayName = 'PopoverTarget';
  PopoverMock.Target = PopoverTarget;
  const PopoverDropdown = ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children);
  PopoverDropdown.displayName = 'PopoverDropdown';
  PopoverMock.Dropdown = PopoverDropdown;

  return {
    Grid: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
    Stack: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
    Textarea: ({ value, onChange, label }: { value: string; onChange: (e: { currentTarget: { value: string } }) => void; label: string }) => (
      React.createElement('textarea', {
        'data-testid': `textarea-${label}`,
        value,
        onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => onChange({ currentTarget: { value: e.target.value } }),
      })
    ),
    Select: ({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) => (
      React.createElement('select', {
        'data-testid': `select-${label}`,
        value,
        onChange: (e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value),
      }, React.createElement('option', { value: '' }, 'Select'))
    ),
    Text: ({ children }: { children: React.ReactNode }) => React.createElement('span', null, children),
    Box: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
    Group: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
    Tooltip: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
    ThemeIcon: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
    Table: ({ children }: { children: React.ReactNode }) => React.createElement('table', null, children),
    Popover: PopoverMock,
    Slider: ({ thumbLabel, value, onChange }: { thumbLabel: string; value: number; onChange: (v: number) => void }) => (
      React.createElement('input', {
        type: 'range',
        'data-testid': `slider-${thumbLabel}`,
        value,
        min: 0,
        max: 1,
        step: 0.1,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(parseFloat(e.target.value)),
      })
    ),
  };
});

// Patch Grid.Col after the mock is set up (can't define compound components inside factory)
const mantineMock = jest.requireMock('@mantine/core');
const GridCol = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
GridCol.displayName = 'GridCol';
mantineMock.Grid.Col = GridCol;

// Mock tabler icons
jest.mock('@tabler/icons-react', () => ({
  IconInfoCircle: () => <span />,
}));

describe('PromptConfig', () => {
  beforeEach(() => {
    capturedOnChange = jest.fn();
  });

  const renderComponent = (configOverrides = {}) => {
    const config = {
      model: 'test-model',
      prompt: 'test prompt',
      temperature: 0.5,
      topP: 0.5,
      ...configOverrides,
    };

    return render(
      <PromptConfig
        config={config as Record<string, unknown>}
        onChange={capturedOnChange}
      />,
    );
  };

  it('renders sliders with initial values', () => {
    renderComponent({ temperature: 0.3, topP: 0.7 });

    const temperatureSlider = screen.getByTestId('slider-Temperature');
    const topPSlider = screen.getByTestId('slider-Top P');

    expect(temperatureSlider).toHaveValue('0.3');
    expect(topPSlider).toHaveValue('0.7');
  });

  it('preserves both slider values when changed sequentially', async () => {
    renderComponent({ temperature: 0.5, topP: 0.5 });

    const temperatureSlider = screen.getByTestId('slider-Temperature');
    const topPSlider = screen.getByTestId('slider-Top P');

    // Change temperature first
    await act(async () => {
      fireEvent.change(temperatureSlider, { target: { value: '0.3' } });
    });

    // Then change topP
    await act(async () => {
      fireEvent.change(topPSlider, { target: { value: '0.8' } });
    });

    // The last onChange call to the parent should have BOTH updated values
    const lastCall = capturedOnChange.mock.calls[capturedOnChange.mock.calls.length - 1][0];
    expect(lastCall.temperature).toBe(0.3);
    expect(lastCall.topP).toBe(0.8);
  });

  it('preserves prompt when sliders change', async () => {
    renderComponent({ prompt: 'my important prompt', temperature: 0.5 });

    const temperatureSlider = screen.getByTestId('slider-Temperature');

    await act(async () => {
      fireEvent.change(temperatureSlider, { target: { value: '0.9' } });
    });

    const lastCall = capturedOnChange.mock.calls[capturedOnChange.mock.calls.length - 1][0];
    expect(lastCall.prompt).toBe('my important prompt');
    expect(lastCall.temperature).toBe(0.9);
  });

  it('preserves slider values when prompt changes', async () => {
    renderComponent({ temperature: 0.3, topP: 0.7 });

    const textarea = screen.getByTestId('textarea-Prompt');

    await act(async () => {
      fireEvent.change(textarea, { target: { value: 'updated prompt' } });
    });

    const lastCall = capturedOnChange.mock.calls[capturedOnChange.mock.calls.length - 1][0];
    expect(lastCall.prompt).toBe('updated prompt');
    expect(lastCall.temperature).toBe(0.3);
    expect(lastCall.topP).toBe(0.7);
  });

  it('handles rapid sequential changes without losing values', async () => {
    renderComponent({ temperature: 0.5, topP: 0.5 });

    const temperatureSlider = screen.getByTestId('slider-Temperature');
    const topPSlider = screen.getByTestId('slider-Top P');

    // Simulate rapid slider drags
    await act(async () => {
      fireEvent.change(temperatureSlider, { target: { value: '0.1' } });
      fireEvent.change(temperatureSlider, { target: { value: '0.2' } });
      fireEvent.change(temperatureSlider, { target: { value: '0.3' } });
    });

    await act(async () => {
      fireEvent.change(topPSlider, { target: { value: '0.9' } });
    });

    const lastCall = capturedOnChange.mock.calls[capturedOnChange.mock.calls.length - 1][0];
    expect(lastCall.temperature).toBe(0.3);
    expect(lastCall.topP).toBe(0.9);
  });
});
