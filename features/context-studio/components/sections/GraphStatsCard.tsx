import { Anchor, Card, Grid, Skeleton } from '@mantine/core';
import { IconNetwork } from '@tabler/icons-react';
import Link from 'next/link';
import { GraphStats } from '@/features/context-studio/types/context-studio';

type StatCardProps = Readonly<{
  title: string;
  value: number;
  icon: React.ReactNode;
  subtitle?: string;
  link?: { href: string; label: string };
}>;

function StatCard({ title, value, icon, subtitle, link }: StatCardProps) {
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
      {link && (
        <Anchor href={link.href} component={Link} size='xs' mt={8} sx={{ display: 'inline-block' }}>
          {link.label}
        </Anchor>
      )}
    </Card>
  );
}

type GraphStatsCardProps = Readonly<{
  graphStats: GraphStats | undefined;
  graphStatsLoading: boolean;
}>;

export default function GraphStatsCard({
  graphStats,
  graphStatsLoading,
}: GraphStatsCardProps) {
  if (!graphStatsLoading && !graphStats) {
    return null;
  }

  return (
    <Grid.Col span={4}>
      {graphStatsLoading ? (
        <Card shadow='sm' padding='lg' radius='md' withBorder>
          <Skeleton height={100} />
        </Card>
      ) : graphStats ? (
        <StatCard
          title='Knowledge Graph'
          value={graphStats.entities}
          icon={<IconNetwork size={24} />}
          subtitle={`${graphStats.entities} entities, ${graphStats.concepts} concepts, ${graphStats.graphsBuilt} graphs built`}
          link={{ href: '/settings/databases/neo4j', label: 'For detailed breakdown, visit the Neo4j knowledge graph →' }}
        />
      ) : null}
    </Grid.Col>
  );
}
