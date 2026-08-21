import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { GraphErrorBoundary } from './GraphErrorBoundary';
import { MantineProvider } from '@mantine/core';

// Component that throws an error
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

const renderWithMantine = (component: React.ReactElement) => {
  return render(
    <MantineProvider>
      {component}
    </MantineProvider>
  );
};

describe('GraphErrorBoundary', () => {
  beforeEach(() => {
    // Suppress console.error for these tests since we're intentionally throwing errors
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should render children when there is no error', () => {
    renderWithMantine(
      <GraphErrorBoundary>
        <ThrowError shouldThrow={false} />
      </GraphErrorBoundary>
    );

    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  it('should display error UI when child component throws', () => {
    renderWithMantine(
      <GraphErrorBoundary>
        <ThrowError shouldThrow={true} />
      </GraphErrorBoundary>
    );

    expect(screen.getByText('Graph Visualization Error')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong with the graph visualization.')).toBeInTheDocument();
  });

  it('should show reset button when error occurs', () => {
    renderWithMantine(
      <GraphErrorBoundary>
        <ThrowError shouldThrow={true} />
      </GraphErrorBoundary>
    );

    expect(screen.getByRole('button', { name: /reset graph/i })).toBeInTheDocument();
  });

  it('should call onReset callback when reset button is clicked', () => {
    const onReset = jest.fn();

    renderWithMantine(
      <GraphErrorBoundary onReset={onReset}>
        <ThrowError shouldThrow={true} />
      </GraphErrorBoundary>
    );

    const resetButton = screen.getByRole('button', { name: /reset graph/i });
    fireEvent.click(resetButton);

    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('should show error message in development mode', () => {
    const originalEnv = process.env.NODE_ENV;
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'development',
      configurable: true,
    });

    renderWithMantine(
      <GraphErrorBoundary>
        <ThrowError shouldThrow={true} />
      </GraphErrorBoundary>
    );

    expect(screen.getByText('Test error')).toBeInTheDocument();

    Object.defineProperty(process.env, 'NODE_ENV', {
      value: originalEnv,
      configurable: true,
    });
  });

  it('should not show error message in production mode', () => {
    const originalEnv = process.env.NODE_ENV;
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'production',
      configurable: true,
    });

    renderWithMantine(
      <GraphErrorBoundary>
        <ThrowError shouldThrow={true} />
      </GraphErrorBoundary>
    );

    expect(screen.queryByText('Test error')).not.toBeInTheDocument();
    expect(screen.getByText('Graph Visualization Error')).toBeInTheDocument();

    Object.defineProperty(process.env, 'NODE_ENV', {
      value: originalEnv,
      configurable: true,
    });
  });

  it('should log error to console when caught', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    renderWithMantine(
      <GraphErrorBoundary>
        <ThrowError shouldThrow={true} />
      </GraphErrorBoundary>
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[GRAPH-ERROR-BOUNDARY] Caught error:',
      expect.any(Error),
      expect.anything()
    );
  });
});
