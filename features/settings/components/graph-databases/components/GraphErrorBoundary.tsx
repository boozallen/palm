import React, { Component, ReactNode } from 'react';
import { Button, Stack, Text, Paper } from '@mantine/core';
import { IconRefresh } from '@tabler/icons-react';

interface Props {
  children: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class GraphErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[GRAPH-ERROR-BOUNDARY] Caught error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <Paper p='md' withBorder style={{ textAlign: 'center', margin: '20px' }}>
          <Stack spacing='md' align='center'>
            <Text size='lg' weight={600} color='red'>
              Graph Visualization Error
            </Text>
            <Text size='sm' color='dimmed'>
              Something went wrong with the graph visualization.
            </Text>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <Text size='xs' color='dimmed' style={{ fontFamily: 'monospace', maxWidth: 600 }}>
                {this.state.error.message}
              </Text>
            )}
            <Button
              leftIcon={<IconRefresh size={16} />}
              onClick={this.handleReset}
              variant='light'
            >
              Reset Graph
            </Button>
          </Stack>
        </Paper>
      );
    }

    return this.props.children;
  }
}
