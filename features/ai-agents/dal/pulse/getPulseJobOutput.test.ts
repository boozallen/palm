import getPulseJobOutput from '@/features/ai-agents/dal/pulse/getPulseJobOutput';
import db from '@/server/db';

jest.mock('@/server/db', () => ({
  __esModule: true,
  default: { agentPulseJob: { findFirst: jest.fn() } },
}));

jest.mock('@/server/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('@/features/shared/errors/prismaErrors', () => ({
  handlePrismaError: jest.fn(() => 'Database error'),
}));

const mockFindFirst = db.agentPulseJob.findFirst as jest.Mock;

describe('getPulseJobOutput', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reads only the requested output, for the requesting user and agent', async () => {
    mockFindFirst.mockResolvedValue({ resultsDashboardHtml: '<html>dashboard</html>' });

    await getPulseJobOutput('job-1', 'user-1', 'agent-1', 'dashboard');

    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { id: 'job-1', aiAgentId: 'agent-1', userId: 'user-1' },
      select: { resultsDashboardHtml: true, slidesHtml: false, executiveSummaryPdf: false },
    });
  });

  it('returns the results dashboard', async () => {
    mockFindFirst.mockResolvedValue({ resultsDashboardHtml: '<html>dashboard</html>' });

    await expect(getPulseJobOutput('job-1', 'user-1', 'agent-1', 'dashboard')).resolves.toBe('<html>dashboard</html>');
  });

  it('returns the slides', async () => {
    mockFindFirst.mockResolvedValue({ slidesHtml: '<html>slides</html>' });

    await expect(getPulseJobOutput('job-1', 'user-1', 'agent-1', 'slides')).resolves.toBe('<html>slides</html>');
  });

  it('returns the executive summary as PDF bytes', async () => {
    mockFindFirst.mockResolvedValue({ executiveSummaryPdf: new Uint8Array([37, 80, 68, 70]) });

    const pdf = await getPulseJobOutput('job-1', 'user-1', 'agent-1', 'pdf');

    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect((pdf as Buffer).toString()).toBe('%PDF');
  });

  it('returns nothing for another user\'s run', async () => {
    mockFindFirst.mockResolvedValue(null);

    await expect(getPulseJobOutput('job-1', 'user-2', 'agent-1', 'dashboard')).resolves.toBeNull();
  });

  it('returns nothing for a run belonging to another agent', async () => {
    mockFindFirst.mockResolvedValue(null);

    await expect(getPulseJobOutput('job-1', 'user-1', 'agent-2', 'dashboard')).resolves.toBeNull();
    expect(mockFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'job-1', aiAgentId: 'agent-2', userId: 'user-1' },
    }));
  });

  it('returns nothing when the output was not generated', async () => {
    mockFindFirst.mockResolvedValue({ executiveSummaryPdf: null });

    await expect(getPulseJobOutput('job-1', 'user-1', 'agent-1', 'pdf')).resolves.toBeNull();
  });

  it('reports a read failure without exposing database details', async () => {
    mockFindFirst.mockRejectedValue(new Error('connection refused on 10.0.0.4'));

    await expect(getPulseJobOutput('job-1', 'user-1', 'agent-1', 'slides')).rejects.toThrow(
      /^Failed to load the PULSE results output$/,
    );
  });
});
