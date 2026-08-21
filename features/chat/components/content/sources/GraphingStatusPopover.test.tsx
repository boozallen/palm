import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { notifications } from '@mantine/notifications';

import GraphingStatusPopover from './GraphingStatusPopover';
import useCancelGraphBuild from '@/features/graph-database/api/cancel-graph-build';
import type { ActiveGraphBuildClient } from '@/features/graph-database/dal/getActiveGraphBuilds';
import { GraphBuildStatus } from '@/features/graph-database/types';

jest.mock('@mantine/notifications', () => ({
  notifications: {
    show: jest.fn(),
  },
}));

const mockInvalidateActiveGraphBuilds = jest.fn();
const mockInvalidateGraphedDocuments = jest.fn();
jest.mock('@/libs', () => ({
  trpc: {
    useUtils: jest.fn(() => ({
      graph: {
        getActiveGraphBuilds: { invalidate: mockInvalidateActiveGraphBuilds },
        getGraphedDocuments: { invalidate: mockInvalidateGraphedDocuments },
      },
    })),
  },
}));

const mockMutateAsync = jest.fn();
jest.mock('@/features/graph-database/api/cancel-graph-build', () => jest.fn());

const mockBuildInfo: ActiveGraphBuildClient = {
  graphId: 'graph-1',
  documentIds: ['doc-1'],
  status: GraphBuildStatus.Building,
  currentStep: 'Processing chunks',
  processedChunks: 10,
  totalChunks: 100,
  createdAt: '2023-01-01T00:00:00.000Z',
};

const renderWithMantine = (component: React.ReactElement) => {
  return render(<MantineProvider>{component}</MantineProvider>);
};

const mockUseCancelGraphBuild = useCancelGraphBuild as jest.Mock;

describe('GraphingStatusPopover', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseCancelGraphBuild.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    });
  });

  it('renders children when buildInfo is null', () => {
    renderWithMantine(
      <GraphingStatusPopover buildInfo={null} entityResolutionEnabled={false}>
        <div>Test Child</div>
      </GraphingStatusPopover>
    );

    expect(screen.getByText('Test Child')).toBeInTheDocument();
  });

  it('displays popover with 2 steps when entity resolution is disabled', async () => {
    const user = userEvent.setup();

    renderWithMantine(
      <GraphingStatusPopover buildInfo={mockBuildInfo} entityResolutionEnabled={false}>
        <button>Click Me</button>
      </GraphingStatusPopover>
    );

    const trigger = screen.getByRole('button', { name: 'Click Me' });
    await user.click(trigger);

    expect(await screen.findByText('Building Knowledge Graph')).toBeInTheDocument();
    expect(screen.getByText(/Currently on step 1 of 2/)).toBeInTheDocument();
    expect(screen.getByText('Step 1: Reading and processing content')).toBeInTheDocument();
    expect(screen.queryByText('Step 2: Entity resolution')).not.toBeInTheDocument();
    expect(screen.getByText('Step 2: Finalizing')).toBeInTheDocument();
  });

  it('displays popover with 3 steps when entity resolution is enabled', async () => {
    const user = userEvent.setup();

    renderWithMantine(
      <GraphingStatusPopover buildInfo={mockBuildInfo} entityResolutionEnabled={true}>
        <button>Click Me</button>
      </GraphingStatusPopover>
    );

    const trigger = screen.getByRole('button', { name: 'Click Me' });
    await user.click(trigger);

    expect(await screen.findByText('Building Knowledge Graph')).toBeInTheDocument();
    expect(screen.getByText(/Currently on step 1 of 3/)).toBeInTheDocument();
    expect(screen.getByText('Step 1: Reading and processing content')).toBeInTheDocument();
    expect(screen.getByText('Step 2: Entity resolution')).toBeInTheDocument();
    expect(screen.getByText('Step 3: Finalizing')).toBeInTheDocument();
  });

  it('highlights current step based on buildInfo currentStep', async () => {
    const user = userEvent.setup();
    const buildInfoStep2 = { ...mockBuildInfo, currentStep: 'Entity resolution in progress' };

    renderWithMantine(
      <GraphingStatusPopover buildInfo={buildInfoStep2} entityResolutionEnabled={true}>
        <button>Click Me</button>
      </GraphingStatusPopover>
    );

    const trigger = screen.getByRole('button', { name: 'Click Me' });
    await user.click(trigger);

    expect(await screen.findByText(/Currently on step 2 of 3/)).toBeInTheDocument();
  });

  it('shows final step as step 2 when entity resolution disabled and step is completed', async () => {
    const user = userEvent.setup();
    const completedBuildInfo = { ...mockBuildInfo, currentStep: 'Completed' };

    renderWithMantine(
      <GraphingStatusPopover buildInfo={completedBuildInfo} entityResolutionEnabled={false}>
        <button>Click Me</button>
      </GraphingStatusPopover>
    );

    const trigger = screen.getByRole('button', { name: 'Click Me' });
    await user.click(trigger);

    expect(await screen.findByText(/Currently on step 2 of 2/)).toBeInTheDocument();
  });

  it('shows final step as step 3 when entity resolution enabled and step is completed', async () => {
    const user = userEvent.setup();
    const completedBuildInfo = { ...mockBuildInfo, currentStep: 'Completed' };

    renderWithMantine(
      <GraphingStatusPopover buildInfo={completedBuildInfo} entityResolutionEnabled={true}>
        <button>Click Me</button>
      </GraphingStatusPopover>
    );

    const trigger = screen.getByRole('button', { name: 'Click Me' });
    await user.click(trigger);

    expect(await screen.findByText(/Currently on step 3 of 3/)).toBeInTheDocument();
  });

  it('displays time warning message', async () => {
    const user = userEvent.setup();

    renderWithMantine(
      <GraphingStatusPopover buildInfo={mockBuildInfo} entityResolutionEnabled={true}>
        <button>Click Me</button>
      </GraphingStatusPopover>
    );

    const trigger = screen.getByRole('button', { name: 'Click Me' });
    await user.click(trigger);

    expect(await screen.findByText(/This may take several hours/)).toBeInTheDocument();
  });

  it('displays explanation about locked files', async () => {
    const user = userEvent.setup();

    renderWithMantine(
      <GraphingStatusPopover buildInfo={mockBuildInfo} entityResolutionEnabled={true}>
        <button>Click Me</button>
      </GraphingStatusPopover>
    );

    const trigger = screen.getByRole('button', { name: 'Click Me' });
    await user.click(trigger);

    expect(await screen.findByText(/Files are locked to prevent conflicts/)).toBeInTheDocument();
  });

  it('displays detailed backend process explanations', async () => {
    const user = userEvent.setup();

    renderWithMantine(
      <GraphingStatusPopover buildInfo={mockBuildInfo} entityResolutionEnabled={true}>
        <button>Click Me</button>
      </GraphingStatusPopover>
    );

    const trigger = screen.getByRole('button', { name: 'Click Me' });
    await user.click(trigger);

    expect(await screen.findByText(/Document split into chunks and analyzed with AI/)).toBeInTheDocument();
    expect(screen.getByText(/Entities and relationships are extracted/)).toBeInTheDocument();
    expect(screen.getByText(/Database indexed for fast queries/)).toBeInTheDocument();
  });

  it('shows live chunk progress and current file during extraction', async () => {
    const user = userEvent.setup();
    const extractingBuildInfo: ActiveGraphBuildClient = {
      ...mockBuildInfo,
      currentStep: 'Extracting report.pdf',
      processedChunks: 124,
      totalChunks: 380,
    };

    renderWithMantine(
      <GraphingStatusPopover buildInfo={extractingBuildInfo} entityResolutionEnabled={false}>
        <button>Click Me</button>
      </GraphingStatusPopover>
    );

    await user.click(screen.getByRole('button', { name: 'Click Me' }));

    expect(await screen.findByText('124 / 380 chunks')).toBeInTheDocument();
    expect(screen.getByText('Now extracting: report.pdf')).toBeInTheDocument();
    expect(screen.getByText(/33% complete/)).toBeInTheDocument();
  });

  it('omits chunk progress and percentage outside the extraction step', async () => {
    const user = userEvent.setup();
    const resolvingBuildInfo: ActiveGraphBuildClient = {
      ...mockBuildInfo,
      currentStep: 'Entity resolution in progress',
    };

    renderWithMantine(
      <GraphingStatusPopover buildInfo={resolvingBuildInfo} entityResolutionEnabled={true}>
        <button>Click Me</button>
      </GraphingStatusPopover>
    );

    await user.click(screen.getByRole('button', { name: 'Click Me' }));

    await screen.findByText('Building Knowledge Graph');
    expect(screen.queryByText('10 / 100 chunks')).not.toBeInTheDocument();
    expect(screen.queryByText(/Now extracting:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/% complete/)).not.toBeInTheDocument();
  });

  describe('cancel button', () => {
    it('renders and calls cancelGraphBuild with the build graphId', async () => {
      mockMutateAsync.mockResolvedValue({ success: true, message: 'Cancelling build — it will stop at the next checkpoint. Your existing graph is preserved.', settled: false });
      const user = userEvent.setup();

      renderWithMantine(
        <GraphingStatusPopover buildInfo={mockBuildInfo} entityResolutionEnabled={false}>
          <button>Click Me</button>
        </GraphingStatusPopover>
      );

      await user.click(screen.getByRole('button', { name: 'Click Me' }));
      const cancelButton = await screen.findByRole('button', { name: 'Cancel build' });
      await user.click(cancelButton);

      expect(mockMutateAsync).toHaveBeenCalledWith({ graphId: 'graph-1' });
    });

    it('shows a blue notification and invalidates queries once the rollback has settled', async () => {
      mockMutateAsync.mockResolvedValue({ success: true, message: 'Build cancelled.', settled: true });
      const user = userEvent.setup();

      renderWithMantine(
        <GraphingStatusPopover buildInfo={mockBuildInfo} entityResolutionEnabled={false}>
          <button>Click Me</button>
        </GraphingStatusPopover>
      );

      await user.click(screen.getByRole('button', { name: 'Click Me' }));
      await user.click(await screen.findByRole('button', { name: 'Cancel build' }));

      await screen.findByText('Cancel build'); // ensure effects settled

      expect(notifications.show).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Build cancelled.', color: 'blue' })
      );
      expect(mockInvalidateActiveGraphBuilds).toHaveBeenCalled();
      expect(mockInvalidateGraphedDocuments).toHaveBeenCalled();
    });

    it('does NOT invalidate graphed-documents while the worker still has to settle the rollback (avoids racing the in-flight extraction)', async () => {
      mockMutateAsync.mockResolvedValue({ success: true, message: 'Cancelling build — it will stop at the next checkpoint. Your existing graph is preserved.', settled: false });
      const user = userEvent.setup();

      renderWithMantine(
        <GraphingStatusPopover buildInfo={mockBuildInfo} entityResolutionEnabled={false}>
          <button>Click Me</button>
        </GraphingStatusPopover>
      );

      await user.click(screen.getByRole('button', { name: 'Click Me' }));
      await user.click(await screen.findByRole('button', { name: 'Cancel build' }));

      await screen.findByText('Cancel build');

      expect(mockInvalidateActiveGraphBuilds).toHaveBeenCalled();
      expect(mockInvalidateGraphedDocuments).not.toHaveBeenCalled();
    });

    it('shows an orange notification, using the route message verbatim, when success is false', async () => {
      mockMutateAsync.mockResolvedValue({ success: false, message: 'Cancellation already in progress', settled: false });
      const user = userEvent.setup();

      renderWithMantine(
        <GraphingStatusPopover buildInfo={mockBuildInfo} entityResolutionEnabled={false}>
          <button>Click Me</button>
        </GraphingStatusPopover>
      );

      await user.click(screen.getByRole('button', { name: 'Click Me' }));
      await user.click(await screen.findByRole('button', { name: 'Cancel build' }));

      expect(notifications.show).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Cancellation already in progress', color: 'orange' })
      );
    });

    it('shows "Cancelling..." and disables the button while status is Cancelling', async () => {
      const cancellingBuildInfo: ActiveGraphBuildClient = { ...mockBuildInfo, status: GraphBuildStatus.Cancelling };
      const user = userEvent.setup();

      renderWithMantine(
        <GraphingStatusPopover buildInfo={cancellingBuildInfo} entityResolutionEnabled={false}>
          <button>Click Me</button>
        </GraphingStatusPopover>
      );

      await user.click(screen.getByRole('button', { name: 'Click Me' }));

      const cancelButton = await screen.findByRole('button', { name: 'Cancelling...' });
      expect(cancelButton).toBeDisabled();
    });
  });
});
