import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { notifications } from '@mantine/notifications';

import Analytics from './Analytics';
import useGetUsageRecords from '@/features/settings/api/analytics/get-usage-records';

jest.mock('@mantine/notifications');
jest.mock('@/features/settings/api/analytics/get-usage-records');
jest.mock('./inputs/InitiatedByInput', () => {
  return function InitiatedByInput() {
    return <div>InitiatedByInput</div>;
  };
});

jest.mock('./inputs/AiProviderInput', () => {
  return function AiProviderInput() {
    return <div>AiProviderInput</div>;
  };
});

jest.mock('./inputs/ModelInput', () => {
  return function ModelInput() {
    return <div>ModelInput</div>;
  };
});

jest.mock('./inputs/TimeInput', () => {
  return function TimeInput() {
    return <div>TimeInput</div>;
  };
});

jest.mock('./AiProviderUsageResults', () => {
  return function AiProviderUsageResults() {
    return <div>AiProviderUsageResults</div>;
  };
});

describe('Analytics', () => {
  const refetch = jest.fn();
  const mockClick = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useGetUsageRecords as jest.Mock).mockReturnValue({
      data: {},
      isFetching: false,
      refetch: refetch,
      error: null,
    });
    
    global.URL.createObjectURL = jest.fn();
    global.fetch = jest.fn();
    
    const originalAppendChild = document.body.appendChild;
    jest.spyOn(document.body, 'appendChild').mockImplementation((node: Node) => {
      if (node instanceof HTMLAnchorElement) {
        if (node.click) {
          node.click = () => {
            mockClick();
          };
        }
        return node;
      }
      return originalAppendChild.call(document.body, node);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should render filters and button', () => {
    render(<Analytics />);

    expect(screen.getByText('InitiatedByInput')).toBeInTheDocument();
    expect(screen.getByText('AiProviderInput')).toBeInTheDocument();
    expect(screen.getByText('ModelInput')).toBeInTheDocument();
    expect(screen.getByText('TimeInput')).toBeInTheDocument();
    expect(screen.getByText('Search')).toBeInTheDocument();
  });

  it('should render AiProviderUsageResults', () => {
    render(<Analytics />);

    expect(screen.getByText('AiProviderUsageResults')).toBeInTheDocument();
  });

  it('should call refetch on submit', async () => {
    render(<Analytics />);

    await act(async () => {
      fireEvent.submit(screen.getByText('Search'));
    });

    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('should display toast if refetch fails', async () => {
    refetch.mockRejectedValue(new Error('error message'));

    render(<Analytics />);

    await act(async () => {
      fireEvent.submit(screen.getByText('Search'));
    });

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalled();
    });
  });

  it('should handle download button click', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['test data']),
      headers: {
        get: () => 'test_filename.csv',
      },
    });

    render(<Analytics />);

    await act(async () => {
      fireEvent.click(screen.getByText('Download'));
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/reports/provider-usage-records', expect.anything());
  });

  it('should display toast if download fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'download error' }),
      headers: {
        get: jest.fn(),
      },
    });

    render(<Analytics />);

    await act(async () => {
      fireEvent.click(screen.getByText('Download'));
    });

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith(expect.objectContaining({
        id: 'download-error',
        title: 'Download Failed',
        message: 'download error',
        autoClose: false,
        withCloseButton: true,
        icon: expect.anything(),
        variant: 'failed_operation',
      }));
    });
  });
});
