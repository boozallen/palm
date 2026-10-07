import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';

import RollupRow from './RollupRow';
import { DEFAULT_THINKING_LABEL } from '@/features/chat/types/agent-trace';

const renderWithMantine = (component: React.ReactElement) => {
  return render(
    <MantineProvider withGlobalStyles withNormalizeCSS>
      {component}
    </MantineProvider>
  );
};

describe('RollupRow', () => {
  it('shows the default thinking label while processing before any step label has arrived', () => {
    renderWithMantine(
      <RollupRow
        toolCallCount={0}
        completedToolCallCount={0}
        isProcessing
        lastStepLabel={null}
        lastStepIsPlainLabel
      />
    );

    expect(screen.getByTestId('agent-trace-rollup-label')).toHaveTextContent(DEFAULT_THINKING_LABEL);
  });

  it('shows the in-progress step label while processing', () => {
    renderWithMantine(
      <RollupRow
        toolCallCount={2}
        completedToolCallCount={1}
        isProcessing
        lastStepLabel='Reading the source documents'
        lastStepIsPlainLabel
      />
    );

    expect(screen.getByTestId('agent-trace-rollup-label')).toHaveTextContent('Reading the source documents');
  });

  it('shows the tool call count alongside the label while processing', () => {
    renderWithMantine(
      <RollupRow
        toolCallCount={2}
        completedToolCallCount={1}
        isProcessing
        lastStepLabel='Reading the source documents'
        lastStepIsPlainLabel
      />
    );

    expect(screen.getByText('2 tool calls')).toBeInTheDocument();
  });

  it('shows the completed summary label once processing finishes', () => {
    renderWithMantine(
      <RollupRow
        toolCallCount={2}
        completedToolCallCount={2}
        isProcessing={false}
        summaryLabel='Read 2 files'
      />
    );

    expect(screen.getByTestId('agent-trace-rollup-label')).toHaveTextContent('Read 2 files');
  });

  it('falls back to "Done" when finished with no summary label', () => {
    renderWithMantine(
      <RollupRow
        toolCallCount={0}
        completedToolCallCount={0}
        isProcessing={false}
      />
    );

    expect(screen.getByTestId('agent-trace-rollup-label')).toHaveTextContent('Done');
  });
});
