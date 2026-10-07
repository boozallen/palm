import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { notifications } from '@mantine/notifications';

import CostSection from './CostSection';
import useGetUsageRecords from '@/features/context-studio/api/get-usage-records';
import { InitiatedBy } from '@/features/context-studio/types/cost';
import { TimeRange } from '@/features/context-studio/types/context-studio';

jest.mock('@mantine/notifications');
jest.mock('@/features/context-studio/api/get-usage-records');

// The studio's shared filters are still stubbed even though this section no
// longer renders them — that is what lets the assertions below prove the
// duplicate copies are gone rather than merely unresolvable.
jest.mock('@/features/context-studio/components/inputs/UserGroupInput', () => {
  return function UserGroupInput() {
    return <div data-testid='cost-user-group-input' />;
  };
});

jest.mock('@/features/context-studio/components/inputs/UserInput', () => {
  return function UserInput() {
    return <div data-testid='cost-user-input' />;
  };
});

jest.mock('@/features/context-studio/components/inputs/TimeRangeInput', () => {
  return function TimeRangeInput() {
    return <div data-testid='cost-time-range-input' />;
  };
});

jest.mock('./inputs/InitiatedByInput', () => {
  return function InitiatedByInput() {
    return <div data-testid='cost-initiated-by-input' />;
  };
});

jest.mock('./inputs/AiProviderInput', () => {
  return function AiProviderInput() {
    return <div data-testid='cost-ai-provider-input' />;
  };
});

jest.mock('./inputs/ModelInput', () => {
  return function ModelInput() {
    return <div data-testid='cost-model-input' />;
  };
});

jest.mock('./AiProviderUsageResults', () => {
  return function AiProviderUsageResults() {
    return <div data-testid='cost-usage-results' />;
  };
});

describe('CostSection', () => {
  const mockClick = jest.fn();

  // The values the shared filter bar owns. Passing non-defaults is what makes
  // the pass-through assertions capable of failing.
  const sharedFilters = {
    timeRange: TimeRange.Week,
    userGroupId: '9f1b7c2e-0000-4000-8000-000000000001',
    userId: '9f1b7c2e-0000-4000-8000-000000000002',
  };

  const renderSection = (enabled = true) =>
    render(<CostSection {...sharedFilters} enabled={enabled} />);

  beforeEach(() => {
    jest.clearAllMocks();

    (useGetUsageRecords as jest.Mock).mockReturnValue({
      data: {},
      isFetching: false,
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

  it('should render the cost-specific filters', () => {
    renderSection();

    expect(screen.getByTestId('cost-initiated-by-input')).toBeInTheDocument();
    expect(screen.getByTestId('cost-ai-provider-input')).toBeInTheDocument();
    expect(screen.getByTestId('cost-model-input')).toBeInTheDocument();
  });

  // Time range, group, and user come from the one filter bar above the tab
  // strip. Rendering them here too showed the user each control twice.
  it('should not repeat the filters the shared bar already owns', () => {
    renderSection();

    expect(screen.queryByTestId('cost-time-range-input')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cost-user-group-input')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cost-user-input')).not.toBeInTheDocument();
  });

  // Results follow the shared bar directly, like every other panel, so there is
  // nothing left for a Search button to trigger.
  it('should not render a Search button', () => {
    renderSection();

    expect(screen.queryByText('Search')).not.toBeInTheDocument();
  });

  it('should render AiProviderUsageResults', () => {
    renderSection();

    expect(screen.getByTestId('cost-usage-results')).toBeInTheDocument();
  });

  it('should query using the filters the shared bar supplies', () => {
    renderSection();

    expect(useGetUsageRecords).toHaveBeenCalledWith(
      InitiatedBy.Any,
      'all',
      'all',
      sharedFilters.timeRange,
      sharedFilters.userGroupId,
      sharedFilters.userId,
      true,
    );
  });

  // Mantine keeps hidden tab panels mounted, so the query needs its own gate or
  // opening the studio fetches cost data on every tab.
  it('should not fetch while its tab is closed', () => {
    renderSection(false);

    expect(useGetUsageRecords).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      false,
    );
  });

  // Without a Search button there is no submit handler left to catch this, so a
  // failed fetch would otherwise leave an empty table and no explanation.
  it('should display a toast when the fetch fails', async () => {
    (useGetUsageRecords as jest.Mock).mockReturnValue({
      data: undefined,
      isFetching: false,
      error: new Error('error message'),
    });

    renderSection();

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith(expect.objectContaining({
        id: 'cost-error',
        title: 'Unable to Fetch Cost Data',
      }));
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

    renderSection();

    await act(async () => {
      fireEvent.click(screen.getByText('Download'));
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/reports/provider-usage-records', expect.anything());
  });

  // The CSV has to cover the same window the table shows, so the download body
  // carries the shared bar's values and not this section's own defaults.
  it('should download using the filters the shared bar supplies', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['test data']),
      headers: {
        get: () => 'test_filename.csv',
      },
    });

    renderSection();

    await act(async () => {
      fireEvent.click(screen.getByText('Download'));
    });

    const [, request] = (global.fetch as jest.Mock).mock.calls[0];
    expect(JSON.parse(request.body)).toEqual({
      initiatedBy: InitiatedBy.Any,
      aiProvider: 'all',
      model: 'all',
      timeRange: sharedFilters.timeRange,
      userGroupId: sharedFilters.userGroupId,
      userId: sharedFilters.userId,
    });
  });

  it('should display toast if download fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'download error' }),
      headers: {
        get: jest.fn(),
      },
    });

    renderSection();

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
