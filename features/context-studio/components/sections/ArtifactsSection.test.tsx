import { render, screen } from '@testing-library/react';
import { Grid } from '@mantine/core';
import ArtifactsSection from './ArtifactsSection';
import { ArtifactStats } from '@/features/context-studio/types/context-studio';

describe('ArtifactsSection', () => {
  const mockArtifactStats: ArtifactStats = {
    total: 100,
    chat: 80,
    workflow: 20,
    byType: [
      { type: 'tsx', count: 40 },
      { type: 'ts', count: 30 },
      { type: 'json', count: 30 },
    ],
    chatArtifacts: {
      total: 80,
      byType: [
        { type: 'tsx', count: 40 },
        { type: 'ts', count: 30 },
        { type: 'json', count: 10 },
      ],
      byCreationMethod: {
        modelOnly: {
          total: 60,
          byModel: [
            { modelId: 'model-1', modelName: 'GPT-4', count: 35 },
            { modelId: 'model-2', modelName: 'Claude Sonnet', count: 15 },
            { modelId: 'model-3', modelName: 'Claude Opus', count: 10 },
          ],
        },
        agentProvider: {
          total: 20,
          byAgentProvider: [
            { agentProviderId: 'agent-1', agentProviderName: 'Agent Provider 1', count: 12 },
            { agentProviderId: 'agent-2', agentProviderName: 'Agent Provider 2', count: 8 },
          ],
        },
      },
    },
    workflowArtifacts: {
      total: 20,
      byType: [
        { type: 'json', count: 20 },
      ],
    },
  };

  const renderWithGrid = (artifactStats: ArtifactStats | undefined, artifactStatsLoading: boolean) => {
    return render(
      <Grid>
        <ArtifactsSection
          artifactStats={artifactStats}
          artifactStatsLoading={artifactStatsLoading}
        />
      </Grid>
    );
  };

  describe('Loading state', () => {
    it('should render skeleton when loading', () => {
      renderWithGrid(undefined, true);

      expect(screen.getByText('Artifacts')).toBeInTheDocument();
      // Skeletons don't have test IDs in Mantine, so just check the section exists
      expect(screen.queryByText('Chat')).not.toBeInTheDocument();
    });
  });

  describe('No data state', () => {
    it('should render null when not loading and no data', () => {
      const { container } = render(
        <Grid>
          <ArtifactsSection
            artifactStats={undefined}
            artifactStatsLoading={false}
          />
        </Grid>
      );

      // Grid will still exist but ArtifactsSection returns null
      expect(screen.queryByText('Artifacts')).not.toBeInTheDocument();
    });
  });

  describe('Data display', () => {
    it('should render artifacts section title', () => {
      renderWithGrid(mockArtifactStats, false);

      expect(screen.getByText('Artifacts')).toBeInTheDocument();
    });

    it('should render total artifacts count', () => {
      renderWithGrid(mockArtifactStats, false);

      expect(screen.getByText('Total Artifacts')).toBeInTheDocument();
      expect(screen.getByText('100')).toBeInTheDocument();
    });

    it('should render chat artifacts section', () => {
      renderWithGrid(mockArtifactStats, false);

      expect(screen.getByText('Chat')).toBeInTheDocument();
      expect(screen.getByText('80')).toBeInTheDocument();
    });

    it('should render workflow artifacts count', () => {
      renderWithGrid(mockArtifactStats, false);

      expect(screen.getByText('Workflows')).toBeInTheDocument();
      const counts = screen.getAllByText('20');
      expect(counts.length).toBeGreaterThan(0);
    });

    it('should render LLM model only section', () => {
      renderWithGrid(mockArtifactStats, false);

      expect(screen.getByText('LLM Model Only')).toBeInTheDocument();
      expect(screen.getByText('60')).toBeInTheDocument();
    });

    it('should render top 3 models', () => {
      renderWithGrid(mockArtifactStats, false);

      expect(screen.getByText('GPT-4')).toBeInTheDocument();
      expect(screen.getByText('35')).toBeInTheDocument();
      expect(screen.getByText('Claude Sonnet')).toBeInTheDocument();
      expect(screen.getByText('15')).toBeInTheDocument();
      expect(screen.getByText('Claude Opus')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
    });

    it('should render agent provider section', () => {
      renderWithGrid(mockArtifactStats, false);

      expect(screen.getByText('Agent Provider')).toBeInTheDocument();
      const counts = screen.getAllByText('20');
      expect(counts.length).toBeGreaterThan(0);
    });

    it('should render agent providers', () => {
      renderWithGrid(mockArtifactStats, false);

      expect(screen.getByText('Agent Provider 1')).toBeInTheDocument();
      expect(screen.getByText('12')).toBeInTheDocument();
      expect(screen.getByText('Agent Provider 2')).toBeInTheDocument();
      expect(screen.getByText('8')).toBeInTheDocument();
    });
  });

  describe('Truncation behavior', () => {
    it('should show "+X more" text when more than 3 models', () => {
      const statsWithManyModels: ArtifactStats = {
        ...mockArtifactStats,
        chatArtifacts: {
          ...mockArtifactStats.chatArtifacts,
          byCreationMethod: {
            ...mockArtifactStats.chatArtifacts.byCreationMethod,
            modelOnly: {
              total: 100,
              byModel: [
                { modelId: 'model-1', modelName: 'Model 1', count: 30 },
                { modelId: 'model-2', modelName: 'Model 2', count: 25 },
                { modelId: 'model-3', modelName: 'Model 3', count: 20 },
                { modelId: 'model-4', modelName: 'Model 4', count: 15 },
                { modelId: 'model-5', modelName: 'Model 5', count: 10 },
              ],
            },
          },
        },
      };

      renderWithGrid(statsWithManyModels, false);

      expect(screen.getByText('+2 more')).toBeInTheDocument();
    });

    it('should show "+X more" text when more than 3 agent providers', () => {
      const statsWithManyProviders: ArtifactStats = {
        ...mockArtifactStats,
        chatArtifacts: {
          ...mockArtifactStats.chatArtifacts,
          byCreationMethod: {
            ...mockArtifactStats.chatArtifacts.byCreationMethod,
            agentProvider: {
              total: 100,
              byAgentProvider: [
                { agentProviderId: 'agent-1', agentProviderName: 'Provider 1', count: 30 },
                { agentProviderId: 'agent-2', agentProviderName: 'Provider 2', count: 25 },
                { agentProviderId: 'agent-3', agentProviderName: 'Provider 3', count: 20 },
                { agentProviderId: 'agent-4', agentProviderName: 'Provider 4', count: 15 },
              ],
            },
          },
        },
      };

      renderWithGrid(statsWithManyProviders, false);

      expect(screen.getByText('+1 more')).toBeInTheDocument();
    });

    it('should not show "+X more" text when 3 or fewer models', () => {
      renderWithGrid(mockArtifactStats, false);

      const moreText = screen.queryByText(/\+\d+ more/);
      expect(moreText).not.toBeInTheDocument();
    });
  });

  describe('Number formatting', () => {
    it('should format large numbers with commas', () => {
      const statsWithLargeNumbers: ArtifactStats = {
        ...mockArtifactStats,
        total: 1234567,
        chat: 1000000,
        workflow: 234567,
        chatArtifacts: {
          total: 1000000,
          byType: [],
          byCreationMethod: {
            modelOnly: {
              total: 800000,
              byModel: [],
            },
            agentProvider: {
              total: 200000,
              byAgentProvider: [],
            },
          },
        },
      };

      renderWithGrid(statsWithLargeNumbers, false);

      expect(screen.getByText('1,234,567')).toBeInTheDocument();
      expect(screen.getByText('1,000,000')).toBeInTheDocument();
      expect(screen.getByText('234,567')).toBeInTheDocument();
    });
  });

  describe('Empty data scenarios', () => {
    it('should handle zero artifacts gracefully', () => {
      const emptyStats: ArtifactStats = {
        total: 0,
        chat: 0,
        workflow: 0,
        byType: [],
        chatArtifacts: {
          total: 0,
          byType: [],
          byCreationMethod: {
            modelOnly: {
              total: 0,
              byModel: [],
            },
            agentProvider: {
              total: 0,
              byAgentProvider: [],
            },
          },
        },
        workflowArtifacts: {
          total: 0,
          byType: [],
        },
      };

      renderWithGrid(emptyStats, false);

      expect(screen.getByText('Total Artifacts')).toBeInTheDocument();
      expect(screen.getAllByText('0').length).toBeGreaterThan(0);
    });

    it('should handle empty model arrays', () => {
      const statsWithNoModels: ArtifactStats = {
        ...mockArtifactStats,
        chatArtifacts: {
          total: 80,
          byType: [],
          byCreationMethod: {
            modelOnly: {
              total: 0,
              byModel: [],
            },
            agentProvider: {
              total: 80,
              byAgentProvider: [
                { agentProviderId: 'agent-1', agentProviderName: 'Provider 1', count: 80 },
              ],
            },
          },
        },
      };

      renderWithGrid(statsWithNoModels, false);

      expect(screen.getByText('Provider 1')).toBeInTheDocument();
      expect(screen.queryByText('GPT-4')).not.toBeInTheDocument();
    });
  });
});
