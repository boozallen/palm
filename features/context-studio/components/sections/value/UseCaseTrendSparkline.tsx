import { Box, Text, useMantineTheme } from '@mantine/core';
import { useElementSize } from '@mantine/hooks';

import { UseCaseWeekPoint } from '@/features/context-studio/types/use-case-detail';
import { USE_CASE_COLORS } from '@/features/context-studio/types/value';
import { formatPercent } from '@/features/context-studio/utils/valueFormat';
import { UseCase } from '@/features/shared/types/use-case';

const SPARKLINE_HEIGHT = 32;
const MARKER_RADIUS = 4;
const SURFACE_RING_WIDTH = 2;
// Used until the container reports a width, and in jsdom, where the mocked
// ResizeObserver never fires. Only the x spacing depends on it.
const FALLBACK_PLOT_WIDTH = 320;

type UseCaseTrendSparklineProps = Readonly<{
  useCase: UseCase;
  weekly: UseCaseWeekPoint[];
}>;

export default function UseCaseTrendSparkline({ useCase, weekly }: UseCaseTrendSparklineProps) {
  const theme = useMantineTheme();
  const { ref, width } = useElementSize();
  const color = USE_CASE_COLORS[useCase];
  const validPoints = weekly.filter((point) => point.shareOfChatSpend !== null);

  if (validPoints.length <= 1) {
    return (
      <Box ref={ref} data-testid='use-case-trend-empty'>
        <Text size='xs' c='dimmed'>
          Not enough data for a trend
        </Text>
      </Box>
    );
  }

  const shares = validPoints.map((p) => p.shareOfChatSpend as number);
  const maxShare = Math.max(...shares);
  const minShare = Math.min(...shares);
  const firstShare = shares[0];
  const lastShare = shares[shares.length - 1];

  const direction = lastShare > firstShare ? 'up' : lastShare < firstShare ? 'down' : 'flat';
  const startDate = validPoints[0].weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endDate = validPoints[validPoints.length - 1].weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const ariaLabel = `Weekly share trend ${direction} from ${formatPercent(firstShare)} to ${formatPercent(lastShare)}, ${startDate} to ${endDate}`;

  const padding = MARKER_RADIUS + SURFACE_RING_WIDTH;
  const plotHeight = SPARKLINE_HEIGHT - 2 * padding;
  // The viewBox is measured in rendered pixels so one user unit is one pixel on
  // both axes. A fixed 100-unit box stretched to the drawer's width scaled x ~7x
  // and y not at all, which drew the round markers as wide ellipses that covered
  // the line between them.
  const plotWidth = (width || FALLBACK_PLOT_WIDTH) - 2 * padding;

  const points = validPoints.map((point, index) => {
    const share = point.shareOfChatSpend as number;
    const x = padding + (index / (validPoints.length - 1)) * plotWidth;
    const y = maxShare > minShare
      ? padding + plotHeight * (1 - (share - minShare) / (maxShare - minShare))
      : SPARKLINE_HEIGHT / 2;
    return { x, y, share };
  });

  const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <Box ref={ref}>
      <svg
        width='100%'
        height={SPARKLINE_HEIGHT}
        viewBox={`0 0 ${plotWidth + 2 * padding} ${SPARKLINE_HEIGHT}`}
        aria-label={ariaLabel}
      >
        <path
          d={pathData}
          fill='none'
          stroke={color}
          strokeWidth={2}
          strokeLinecap='round'
          strokeLinejoin='round'
          vectorEffect='non-scaling-stroke'
        />
        {points.map((point, index) => (
          <circle
            key={index}
            cx={point.x}
            cy={point.y}
            r={MARKER_RADIUS + SURFACE_RING_WIDTH}
            fill={theme.colors.dark[7]}
            vectorEffect='non-scaling-stroke'
            data-testid='use-case-trend-point'
          />
        ))}
        {points.map((point, index) => (
          <circle
            key={`marker-${index}`}
            cx={point.x}
            cy={point.y}
            r={MARKER_RADIUS}
            fill={color}
            vectorEffect='non-scaling-stroke'
          />
        ))}
      </svg>
      <Text size='xxs' c='dimmed' mt='xxs' data-testid='use-case-trend-caption'>
        Weekly share of categorized chat spend, {startDate} to {endDate}
      </Text>
    </Box>
  );
}
