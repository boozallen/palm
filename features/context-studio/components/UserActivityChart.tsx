import { Card, Title, Text, Box, Stack } from '@mantine/core';
import { useState } from 'react';

import { TimeRange } from '@/features/context-studio/types/context-studio';

type UserActivityChartProps = Readonly<{
  totalLoginsData: {
    date: string;
    loginCount: number;
  }[];
  newUsersData: {
    date: string;
    count: number;
  }[];
  noGroupUsersData: {
    date: string;
    loginCount: number;
  }[];
  timeRange: TimeRange;
  totalLogins: number;
  uniqueUsers: number;
  totalNewUsers: number;
  totalNoGroupUsers: number;
}>;

export default function UserActivityChart({
  totalLoginsData,
  newUsersData,
  noGroupUsersData,
  timeRange,
  totalLogins,
  uniqueUsers,
  totalNewUsers,
  totalNoGroupUsers,
}: UserActivityChartProps) {
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);

  if (!totalLoginsData || totalLoginsData.length === 0) {
    return (
      <Card shadow='sm' padding='lg' radius='md' withBorder h='100%'>
        <Title order={3} mb='md'>
          User Activity
        </Title>
        <Text color='dimmed' align='center' py='xl'>
          No login data available.
        </Text>
      </Card>
    );
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);

    switch (timeRange) {
      case TimeRange.Week:
        return date.toLocaleDateString('en-US', { weekday: 'short' });
      case TimeRange.Month:
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      case TimeRange.Year:
        return date.toLocaleDateString('en-US', { month: 'short' });
      case TimeRange.Forever:
        return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      default:
        return dateStr;
    }
  };

  const getReducedData = () => {
    const maxLabels = timeRange === TimeRange.Week ? 7 : timeRange === TimeRange.Month ? 10 : timeRange === TimeRange.Year ? 12 : 8;

    if (totalLoginsData.length <= maxLabels) {
      return totalLoginsData;
    }

    const step = Math.ceil(totalLoginsData.length / maxLabels);
    const reduced = [];

    for (let i = 0; i < totalLoginsData.length; i += step) {
      reduced.push(totalLoginsData[i]);
    }

    if (reduced[reduced.length - 1] !== totalLoginsData[totalLoginsData.length - 1]) {
      reduced.push(totalLoginsData[totalLoginsData.length - 1]);
    }

    return reduced;
  };

  const shouldShowLabel = (index: number) => {
    const totalBars = reducedData.length;
    if (totalBars <= 10) {
      return true;
    }
    if (totalBars <= 20) {
      return index % 2 === 0;
    }
    if (totalBars <= 40) {
      return index % 3 === 0;
    }
    return index % 5 === 0 || index === totalBars - 1;
  };

  const reducedData = getReducedData();
  const maxValue = Math.max(...reducedData.map((d) => d.loginCount), 10);

  const newUsersMap = new Map(newUsersData.map((d) => [d.date, d.count]));
  const noGroupUsersMap = new Map(noGroupUsersData.map((d) => [d.date, d.loginCount]));

  // Calculate Y-axis ticks
  const getYAxisTicks = () => {
    const numTicks = 5;
    const step = Math.ceil(maxValue / (numTicks - 1));
    const roundedStep = Math.pow(10, Math.floor(Math.log10(step))) * Math.ceil(step / Math.pow(10, Math.floor(Math.log10(step))));
    const ticks = [];
    for (let i = 0; i < numTicks; i++) {
      ticks.push(i * roundedStep);
    }
    return ticks;
  };

  const yAxisTicks = getYAxisTicks();
  const yAxisMax = yAxisTicks[yAxisTicks.length - 1];

  const getDateRangeLabel = () => {
    if (reducedData.length === 0) {
      return '';
    }
    const startDate = new Date(reducedData[0].date);

    const formatDateShort = (date: Date) => {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    return `Since ${formatDateShort(startDate)}`;
  };

  return (
    <Card shadow='sm' padding='xl' radius='md' withBorder h='100%'>
      <Stack spacing='lg'>
        <Box>
          <Title order={3} weight={600} mb={12} sx={{ fontSize: 20, color: '#f1f3f5' }}>
            User Activity
          </Title>
          <Box sx={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <Box>
              <Text size='sm' weight={500} mb={6} sx={{ color: '#c1c2c5', fontSize: 13 }}>
                Unique Users
              </Text>
              <Text size={32} weight={700} sx={{ lineHeight: 1, color: '#9775fa', letterSpacing: '-0.5px' }}>
                {uniqueUsers.toLocaleString()}
              </Text>
            </Box>
            <Box>
              <Text size='sm' weight={500} mb={6} sx={{ color: '#c1c2c5', fontSize: 13 }}>
                Login Events
              </Text>
              <Text size={32} weight={700} sx={{ lineHeight: 1, color: '#5292ff', letterSpacing: '-0.5px' }}>
                {totalLogins.toLocaleString()}
              </Text>
            </Box>
            <Box>
              <Text size='sm' weight={500} mb={6} sx={{ color: '#c1c2c5', fontSize: 13 }}>
                First-Time Users
              </Text>
              <Text size={32} weight={700} sx={{ lineHeight: 1, color: '#51cf66', letterSpacing: '-0.5px' }}>
                {totalNewUsers.toLocaleString()}
              </Text>
            </Box>
            <Box>
              <Text size='sm' weight={500} mb={6} sx={{ color: '#c1c2c5', fontSize: 13 }}>
                Not Yet in a User Group
              </Text>
              <Text size={32} weight={700} sx={{ lineHeight: 1, color: '#fa5252', letterSpacing: '-0.5px' }}>
                {totalNoGroupUsers.toLocaleString()}
              </Text>
            </Box>
          </Box>
          <Box sx={{ marginTop: 12 }}>
            <Text size='sm' sx={{ color: '#868e96', fontSize: 12 }}>
              {getDateRangeLabel()}
            </Text>
          </Box>
        </Box>

        <Box sx={{ position: 'relative', width: '100%', height: 360, marginTop: 8, paddingLeft: 48, paddingBottom: 32 }}>
          <svg
            width='100%'
            height='100%'
            viewBox='0 0 100 100'
            preserveAspectRatio='none'
            style={{
              overflow: 'visible',
              shapeRendering: 'crispEdges',
            }}
          >
            <defs>
              <linearGradient id='barGradient' x1='0%' y1='0%' x2='0%' y2='100%'>
                <stop offset='0%' style={{ stopColor: '#5292ff', stopOpacity: 1 }} />
                <stop offset='100%' style={{ stopColor: '#3373e0', stopOpacity: 1 }} />
              </linearGradient>
              <linearGradient id='barGradientHover' x1='0%' y1='0%' x2='0%' y2='100%'>
                <stop offset='0%' style={{ stopColor: '#6ba3ff', stopOpacity: 1 }} />
                <stop offset='100%' style={{ stopColor: '#4a8aff', stopOpacity: 1 }} />
              </linearGradient>
              <linearGradient id='newUserGradient' x1='0%' y1='0%' x2='0%' y2='100%'>
                <stop offset='0%' style={{ stopColor: '#51cf66', stopOpacity: 1 }} />
                <stop offset='100%' style={{ stopColor: '#37b24d', stopOpacity: 1 }} />
              </linearGradient>
              <linearGradient id='newUserGradientHover' x1='0%' y1='0%' x2='0%' y2='100%'>
                <stop offset='0%' style={{ stopColor: '#69db7c', stopOpacity: 1 }} />
                <stop offset='100%' style={{ stopColor: '#51cf66', stopOpacity: 1 }} />
              </linearGradient>
              <linearGradient id='noGroupGradient' x1='0%' y1='0%' x2='0%' y2='100%'>
                <stop offset='0%' style={{ stopColor: '#fa5252', stopOpacity: 0.85 }} />
                <stop offset='100%' style={{ stopColor: '#e03131', stopOpacity: 0.85 }} />
              </linearGradient>
              <linearGradient id='noGroupGradientHover' x1='0%' y1='0%' x2='0%' y2='100%'>
                <stop offset='0%' style={{ stopColor: '#ff6b6b', stopOpacity: 0.95 }} />
                <stop offset='100%' style={{ stopColor: '#fa5252', stopOpacity: 0.95 }} />
              </linearGradient>
              <filter id='shadow'>
                <feDropShadow dx='0' dy='2' stdDeviation='3' floodOpacity='0.3' />
              </filter>
            </defs>

            {/* Y-axis */}
            <line
              x1='0%'
              y1='10%'
              x2='0%'
              y2='85%'
              stroke='#495057'
              strokeWidth='0.2'
            />

            {/* Y-axis labels and grid lines */}
            {yAxisTicks.map((tick) => {
              const yPosition = 85 - ((tick / yAxisMax) * 75);
              return (
                <g key={tick}>
                  <line
                    x1='0%'
                    y1={`${yPosition}%`}
                    x2='100%'
                    y2={`${yPosition}%`}
                    stroke='#373A40'
                    strokeWidth='0.1'
                    strokeDasharray='2 2'
                    opacity='0.3'
                  />
                  <text
                    x='-2%'
                    y={`${yPosition}%`}
                    fill='#868e96'
                    fontSize='2.5'
                    textAnchor='end'
                    dominantBaseline='middle'
                    style={{ userSelect: 'none' }}
                  >
                    {tick}
                  </text>
                </g>
              );
            })}

            {/* X-axis */}
            <line
              x1='0%'
              y1='85%'
              x2='100%'
              y2='85%'
              stroke='#495057'
              strokeWidth='0.2'
            />

            {reducedData.map((item, index) => {
              const barWidth = 100 / reducedData.length;
              const barX = index * barWidth;
              const totalHeight = (item.loginCount / yAxisMax) * 75;
              const barY = 85 - totalHeight;
              const isHovered = hoveredBar === index;

              const newUsersCount = newUsersMap.get(item.date) || 0;
              const newUsersHeight = (newUsersCount / yAxisMax) * 75;
              const returningUsersHeight = totalHeight - newUsersHeight;

              const noGroupUsersCount = noGroupUsersMap.get(item.date) || 0;
              const noGroupUsersHeight = (noGroupUsersCount / yAxisMax) * 75;

              return (
                <g key={item.date}>
                  <rect
                    x={`${barX + barWidth * 0.2}%`}
                    y={`${barY}%`}
                    width={`${barWidth * 0.6}%`}
                    height={`${totalHeight}%`}
                    fill={isHovered ? 'url(#barGradientHover)' : 'url(#barGradient)'}
                    rx='1.2'
                    style={{
                      transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                      cursor: 'pointer',
                      filter: isHovered ? 'url(#shadow)' : 'none',
                    }}
                    onMouseEnter={() => setHoveredBar(index)}
                    onMouseLeave={() => setHoveredBar(null)}
                  />

                  {newUsersCount > 0 && (
                    <rect
                      x={`${barX + barWidth * 0.2}%`}
                      y={`${barY + returningUsersHeight}%`}
                      width={`${barWidth * 0.6}%`}
                      height={`${newUsersHeight}%`}
                      fill={isHovered ? 'url(#newUserGradientHover)' : 'url(#newUserGradient)'}
                      style={{
                        transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                        cursor: 'pointer',
                        filter: isHovered ? 'url(#shadow)' : 'none',
                      }}
                      onMouseEnter={() => setHoveredBar(index)}
                      onMouseLeave={() => setHoveredBar(null)}
                    />
                  )}

                  {noGroupUsersCount > 0 && (
                    <rect
                      x={`${barX + barWidth * 0.2}%`}
                      y={`${barY}%`}
                      width={`${barWidth * 0.6}%`}
                      height={`${noGroupUsersHeight}%`}
                      fill={isHovered ? 'url(#noGroupGradientHover)' : 'url(#noGroupGradient)'}
                      rx='1.2'
                      style={{
                        transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                        cursor: 'pointer',
                        filter: isHovered ? 'url(#shadow)' : 'none',
                        mixBlendMode: 'multiply',
                      }}
                      onMouseEnter={() => setHoveredBar(index)}
                      onMouseLeave={() => setHoveredBar(null)}
                    />
                  )}

                  {isHovered && (
                    <g style={{ pointerEvents: 'none' }}>
                      <rect
                        x={`${barX + barWidth * 0.5}%`}
                        y={`${Math.max(barY - 18, 2)}%`}
                        width='22'
                        height={newUsersCount > 0 || noGroupUsersCount > 0 ? (newUsersCount > 0 && noGroupUsersCount > 0 ? '14' : '11') : '8'}
                        rx='1.5'
                        fill='rgba(26, 27, 30, 0.98)'
                        style={{
                          transform: 'translate(-11, 0)',
                          filter: 'drop-shadow(0 1 3 rgba(0, 0, 0, 0.5))',
                        }}
                      />
                      <text
                        x={`${barX + barWidth * 0.5}%`}
                        y={`${Math.max(barY - 14, 6)}%`}
                        fill='#f1f3f5'
                        fontSize='3'
                        fontWeight='700'
                        textAnchor='middle'
                        style={{ userSelect: 'none' }}
                      >
                        {item.loginCount.toLocaleString()} total logins
                      </text>
                      {newUsersCount > 0 && (
                        <text
                          x={`${barX + barWidth * 0.5}%`}
                          y={`${Math.max(barY - 10, 10)}%`}
                          fill='#51cf66'
                          fontSize='2.5'
                          fontWeight='600'
                          textAnchor='middle'
                          style={{ userSelect: 'none' }}
                        >
                          {newUsersCount} first-time
                        </text>
                      )}
                      {noGroupUsersCount > 0 && (
                        <text
                          x={`${barX + barWidth * 0.5}%`}
                          y={`${Math.max(barY - (newUsersCount > 0 ? 6 : 10), newUsersCount > 0 ? 14 : 10)}%`}
                          fill='#fa5252'
                          fontSize='2.5'
                          fontWeight='600'
                          textAnchor='middle'
                          style={{ userSelect: 'none' }}
                        >
                          {noGroupUsersCount} not yet in user group
                        </text>
                      )}
                    </g>
                  )}

                  {shouldShowLabel(index) && (
                    <text
                      x={`${barX + barWidth * 0.5}%`}
                      y='92%'
                      fill={isHovered ? '#c1c2c5' : '#868e96'}
                      fontSize='2.5'
                      fontWeight={isHovered ? '600' : '400'}
                      textAnchor='middle'
                      style={{
                        transition: 'all 0.15s ease',
                        userSelect: 'none',
                      }}
                    >
                      {formatDate(item.date)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </Box>
      </Stack>
    </Card>
  );
}
