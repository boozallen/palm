import { Card, Grid, Skeleton } from '@mantine/core';
import { IconMessageCircle } from '@tabler/icons-react';
import { ChatStats } from '@/features/context-studio/types/context-studio';

type StatCardProps = Readonly<{
  title: string;
  value: number;
  icon: React.ReactNode;
  subtitle?: string;
  onClick?: () => void;
}>;

function StatCard({ title, value, icon, subtitle, onClick }: StatCardProps) {
  return (
    <Card
      shadow='sm'
      padding='lg'
      radius='md'
      withBorder
      onClick={onClick}
      sx={(theme) => ({
        background: theme.colorScheme === 'dark'
          ? `linear-gradient(135deg, ${theme.colors.dark[7]} 0%, ${theme.colors.dark[6]} 100%)`
          : `linear-gradient(135deg, ${theme.white} 0%, ${theme.colors.gray[0]} 100%)`,
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        cursor: onClick ? 'pointer' : 'default',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: theme.shadows.md,
        },
      })}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ fontWeight: 500, fontSize: '14px', color: 'var(--mantine-color-dimmed)' }}>
          {title}
        </div>
        <div
          style={{
            color: 'var(--mantine-color-cyan-6)',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {icon}
        </div>
      </div>
      <div style={{ marginBottom: '12px', fontSize: '30px', fontWeight: 700, color: 'var(--mantine-color-cyan-7)' }}>
        {value.toLocaleString()}
      </div>
      {subtitle && (
        <div style={{ fontSize: '12px', color: 'var(--mantine-color-dimmed)' }}>
          {subtitle}
        </div>
      )}
    </Card>
  );
}

type ChatStatsCardProps = Readonly<{
  chatStats: ChatStats | undefined;
  chatStatsLoading: boolean;
}>;

export default function ChatStatsCard({
  chatStats,
  chatStatsLoading,
}: ChatStatsCardProps) {
  if (!chatStatsLoading && !chatStats) {
    return null;
  }

  return (
    <Grid.Col span={4}>
      {chatStatsLoading ? (
        <Card shadow='sm' padding='lg' radius='md' withBorder>
          <Skeleton height={100} />
        </Card>
      ) : chatStats ? (
        <StatCard
          title='Chat Conversations'
          value={chatStats.total}
          icon={<IconMessageCircle size={24} />}
          subtitle={`${chatStats.withPrompt} used prompts · ${chatStats.withAgent} used agents · ${chatStats.withUploadedSources} cited documents · ${chatStats.withKnowledgeBaseSources} used knowledge base citations`}
        />
      ) : null}
    </Grid.Col>
  );
}
