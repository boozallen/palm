import { Group, Skeleton, Stack, Text, useMantineTheme } from '@mantine/core';

import { UseCaseTheme, UseCaseThemes } from '@/features/context-studio/types/use-case-detail';
import { formatCount } from '@/features/context-studio/utils/valueFormat';
import { formatCurrencyNumberForAnalytics } from '@/features/shared/utils';

// The figures are ours, the grouping is the model's.

type UseCaseThemesBlockProps = Readonly<{
  themes: UseCaseThemes | null | undefined;
  loading: boolean;
  failed: boolean;
}>;

export default function UseCaseThemesBlock({ themes, loading, failed }: UseCaseThemesBlockProps) {
  const theme = useMantineTheme();

  if (loading) {
    return (
      <Stack spacing='xs' data-testid='use-case-themes-loading'>
        <Text size='sm' weight={theme.other.fontWeights.medium} c='gray.4' mb='xxs'>
          What they were working on
        </Text>
        <Skeleton height={20} width='80%' />
        <Skeleton height={20} width='75%' />
        <Skeleton height={20} width='70%' />
      </Stack>
    );
  }

  if (failed || themes === null || themes === undefined) {
    return (
      <Stack spacing='xs'>
        <Text size='sm' weight={theme.other.fontWeights.medium} c='gray.4' mb='xxs'>
          What they were working on
        </Text>
        <Text size='xs' c='dimmed' data-testid='use-case-themes-unavailable'>
          themes unavailable for this period
        </Text>
      </Stack>
    );
  }

  const { themes: themeList, remainder, coveredChats, analyzedChats, truncated } = themes;

  const numericStyle = {
    fontFamily: theme.fontFamilyMonospace,
    textAlign: 'right' as const,
  };

  return (
    <Stack spacing='xs'>
      <Text size='sm' weight={theme.other.fontWeights.medium} c='gray.4' mb='xxs'>
        What they were working on
      </Text>
      {themeList.map((themeItem: UseCaseTheme, index: number) => (
        <Group key={index} position='apart' spacing='sm' data-testid='use-case-theme-row'>
          <Text size='sm' c='gray.1'>
            {themeItem.name}
          </Text>
          {/* Themes name a single pursuit now, so one-chat themes are routine and
              "1 chats" would be the most-read text in the block. */}
          <Text size='sm' c='gray.1' style={numericStyle}>
            {formatCount(themeItem.chats)} {themeItem.chats === 1 ? 'chat' : 'chats'} ·{' '}
            {formatCurrencyNumberForAnalytics(themeItem.cost)}
          </Text>
        </Group>
      ))}
      {remainder !== null && (
        // Dimmed and last because it names no pursuit, but present so the theme
        // dollars add up to the category total above them.
        <Group position='apart' spacing='sm' data-testid='use-case-themes-remainder'>
          <Text size='sm' c='dimmed'>
            Other pursuits
          </Text>
          <Text size='sm' c='dimmed' style={numericStyle}>
            {formatCount(remainder.chats)} {remainder.chats === 1 ? 'chat' : 'chats'} ·{' '}
            {formatCurrencyNumberForAnalytics(remainder.cost)}
          </Text>
        </Group>
      )}
      <Text size='xxs' c='dimmed' mt='xxs' data-testid='use-case-themes-coverage'>
        themes cover {formatCount(coveredChats)} of the {formatCount(analyzedChats)} chats analyzed
        {truncated && (
          <Text
            component='span'
            size='xxs'
            c='dimmed'
            data-testid='use-case-themes-truncated'
          >
            {' · more chats in this category than were analyzed'}
          </Text>
        )}
      </Text>
    </Stack>
  );
}
