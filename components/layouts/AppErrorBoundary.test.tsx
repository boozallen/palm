import React from 'react';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { AppErrorBoundary } from './AppErrorBoundary';
import { reportClientError } from '@/features/shared/api/report-client-error';

jest.mock('@/features/shared/api/report-client-error', () => ({
  reportClientError: jest.fn(),
}));

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

describe('AppErrorBoundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress console.error for these tests since we're intentionally throwing errors
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders children when there is no error', () => {
    renderWithMantine(
      <AppErrorBoundary>
        <ThrowError shouldThrow={false} />
      </AppErrorBoundary>
    );

    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  it('displays a fallback and a reload button when a child throws', () => {
    renderWithMantine(
      <AppErrorBoundary>
        <ThrowError shouldThrow={true} />
      </AppErrorBoundary>
    );

    expect(screen.getByText('Something Went Wrong')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reload page/i })).toBeInTheDocument();
  });

  it('reports the caught error to the frontend error-recording endpoint', () => {
    renderWithMantine(
      <AppErrorBoundary>
        <ThrowError shouldThrow={true} />
      </AppErrorBoundary>
    );

    expect(reportClientError).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'react-render',
      message: 'Test error',
    }));
  });
});
