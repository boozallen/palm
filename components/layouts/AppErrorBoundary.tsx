import React, { Component, ReactNode } from 'react';
import { Button, Stack, Text, Paper } from '@mantine/core';
import { IconRefresh } from '@tabler/icons-react';
import { reportClientError } from '@/features/shared/api/report-client-error';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// App-wide fallback for render-phase errors. Reports to the same endpoint as
// GlobalErrorListener (window.onerror/unhandledrejection), which this
// boundary cannot catch on its own.
export class AppErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[APP-ERROR-BOUNDARY] Caught error:', error, errorInfo);
    reportClientError({
      kind: 'react-render',
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack ?? undefined,
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <Paper p='md' withBorder style={{ textAlign: 'center', margin: '20px' }}>
          <Stack spacing='md' align='center'>
            <Text size='lg' weight={600} color='red'>
              Something Went Wrong
            </Text>
            <Text size='sm' color='dimmed'>
              An unexpected error occurred. Reloading the page usually fixes this.
            </Text>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <Text size='xs' color='dimmed' style={{ fontFamily: 'monospace', maxWidth: 600 }}>
                {this.state.error.message}
              </Text>
            )}
            <Button
              leftIcon={<IconRefresh size={16} />}
              onClick={this.handleReload}
              variant='light'
            >
              Reload Page
            </Button>
          </Stack>
        </Paper>
      );
    }

    return this.props.children;
  }
}
