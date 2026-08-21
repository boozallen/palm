import React from 'react';
import { Box, Group, Paper, Text, useMantineTheme } from '@mantine/core';

// The card shell shared by the three behavior views: accent glyph + title on
// the left, a mono "how to read this" hint on the right — load-bearing, since
// it's what makes these dense views scannable without a legend.

type StatProps = {
  value: number | undefined;
  label: string;
  loading: boolean;
  // A failed query has no value, and coercing that to 0 would assert something
  // false about the data — show the same placeholder as loading instead.
  failed?: boolean;
};

export function StudioStat({ value, label, loading, failed = false }: StatProps) {
  const theme = useMantineTheme();
  return (
    <Text
      component='span'
      sx={{
        fontFamily: theme.fontFamilyMonospace,
        fontSize: 12.5,
        whiteSpace: 'nowrap',
      }}
    >
      <Text
        component='span'
        weight={600}
        color={failed ? 'dark.3' : 'cyan.4'}
        sx={{ fontSize: 'inherit', fontFamily: 'inherit' }}
      >
        {loading || failed ? '–' : (value ?? 0).toLocaleString()}
      </Text>
      <Text component='span' ml={6} color='dark.3' sx={{ fontSize: 'inherit', fontFamily: 'inherit' }}>
        {label}
      </Text>
    </Text>
  );
}

type StudioPanelProps = {
  icon: React.ReactNode;
  title: string;
  hint: string;
  stats: StatProps[];
  children: React.ReactNode;
};

export default function StudioPanel({ icon, title, hint, stats, children }: StudioPanelProps) {
  const theme = useMantineTheme();

  return (
    <Paper
      radius={14}
      bg='dark.7'
      sx={{
        border: `1px solid ${theme.colors.dark[6]}`,
        padding: '18px 20px 22px',
      }}
    >
      <Group position='apart' align='baseline' spacing='sm' sx={{ flexWrap: 'wrap' }}>
        <Group spacing={9} align='center' noWrap>
          <Box c='cyan.4' sx={{ display: 'flex', alignItems: 'center' }}>{icon}</Box>
          <Text weight={600} sx={{ fontSize: 15, letterSpacing: 0.2 }}>
            {title}
          </Text>
        </Group>
        <Text
          color='dark.3'
          sx={{
            fontSize: 11.5,
            fontFamily: theme.fontFamilyMonospace,
          }}
        >
          {hint}
        </Text>
      </Group>

      {stats.length > 0 && (
        <Group spacing={16} mt={8}>
          {stats.map((stat) => (
            <StudioStat key={stat.label} {...stat} />
          ))}
        </Group>
      )}

      <Box mt={16}>{children}</Box>
    </Paper>
  );
}
