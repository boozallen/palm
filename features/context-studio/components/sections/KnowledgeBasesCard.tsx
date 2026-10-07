import { Card, Grid, Skeleton } from '@mantine/core';
import { IconDatabase } from '@tabler/icons-react';
import { KnowledgeBaseStats } from '@/features/context-studio/types/context-studio';

type StatCardProps = Readonly<{
  title: string;
  value: number;
  icon: React.ReactNode;
  subtitle?: string;
}>;

function StatCard({ title, value, icon, subtitle }: StatCardProps) {
  return (
    <Card
      shadow='sm'
      padding='lg'
      radius='md'
      withBorder
      sx={(theme) => ({
        background: theme.colorScheme === 'dark'
          ? `linear-gradient(135deg, ${theme.colors.dark[7]} 0%, ${theme.colors.dark[6]} 100%)`
          : `linear-gradient(135deg, ${theme.white} 0%, ${theme.colors.gray[0]} 100%)`,
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
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

type KnowledgeBasesCardProps = Readonly<{
  knowledgeBaseStats: KnowledgeBaseStats | undefined;
  knowledgeBaseStatsLoading: boolean;
}>;

export default function KnowledgeBasesCard({
  knowledgeBaseStats,
  knowledgeBaseStatsLoading,
}: KnowledgeBasesCardProps) {
  if (!knowledgeBaseStatsLoading && !knowledgeBaseStats) {
    return null;
  }

  return (
    <Grid.Col span={4}>
      {knowledgeBaseStatsLoading ? (
        <Card shadow='sm' padding='lg' radius='md' withBorder>
          <Skeleton height={100} />
        </Card>
      ) : knowledgeBaseStats ? (
        <StatCard
          title='Knowledge Bases'
          value={knowledgeBaseStats.total}
          icon={<IconDatabase size={24} />}
        />
      ) : null}
    </Grid.Col>
  );
}
