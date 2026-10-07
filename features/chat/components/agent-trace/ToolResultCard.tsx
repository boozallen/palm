import { Box, Text, Stack, Anchor, Group, Image, ThemeIcon, List, Spoiler, Avatar, HoverCard } from '@mantine/core';

import { getFileTypeConfig } from '@/features/chat/utils/chatHelperFunctions';
import { ToolResult } from '@/features/chat/types/agent-trace';
import { useTrackClientEvent } from '@/features/shared/hooks/useTrackClientEvent';

type ToolResultCardProps = Readonly<{
  results: ToolResult[];
  isSearch?: boolean;
}>;

const MAX_DISPLAYED_SOURCE_ICONS = 3;

// Non-interactive icon + filename, used to show a single source/file inline
// on the collapsed tool call row instead of requiring an expand click.
export function InlineFileName({ title }: Readonly<{ title: string }>) {
  const { color, icon: Icon } = getFileTypeConfig(title);
  return (
    <Group spacing={6} noWrap style={{ minWidth: 0, overflow: 'hidden' }}>
      <ThemeIcon size={14} c={color} variant='transparent' style={{ pointerEvents: 'none', flexShrink: 0 }}>
        <Icon size={14} stroke={2} />
      </ThemeIcon>
      <Text size='xs' c='gray.4' style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {title}
      </Text>
    </Group>
  );
}

// Overlapping file-type icons (same treatment as the recent-chat artifact icons)
// for showing multiple sources inline without an expand step.
export function InlineFileGroup({ titles }: Readonly<{ titles: string[] }>) {
  const displayed = titles.slice(0, MAX_DISPLAYED_SOURCE_ICONS);
  const remaining = titles.length - displayed.length;

  return (
    <Avatar.Group spacing={4}>
      {displayed.map((title, index) => {
        const { color, icon: Icon } = getFileTypeConfig(title);
        return (
          <HoverCard key={index} shadow='md' position='bottom-start' withinPortal>
            <HoverCard.Target>
              <Avatar variant='transparent' radius='xl' size='xs'>
                <ThemeIcon size={11} c={color} variant='transparent'>
                  <Icon size={11} stroke={2} />
                </ThemeIcon>
              </Avatar>
            </HoverCard.Target>
            <HoverCard.Dropdown>
              <Text size='xs' color='gray.7'>{title}</Text>
            </HoverCard.Dropdown>
          </HoverCard>
        );
      })}
      {remaining > 0 && (
        <Avatar data-testid='inline-file-group-overflow' variant='transparent' radius='xl' size='xs'>
          <Text size={9} color='gray.4'>+{remaining}</Text>
        </Avatar>
      )}
    </Avatar.Group>
  );
}

export default function ToolResultCard({ results, isSearch = false }: ToolResultCardProps) {
  const displayResults = results;
  const track = useTrackClientEvent();

  if (isSearch) {
    return (
      <List size='xs' sx={{ listStyleType: 'disc', paddingLeft: '24px !important', overflow: 'hidden' }}>
        {displayResults.map((result, index) => (
          <List.Item key={index} sx={(t) => ({ color: t.colors.gray[4] })}>
            <Text size='xs' c='gray.4' span style={{ wordBreak: 'break-word' }}>
              {result.url ? (
                <Anchor
                  href={result.url}
                  target='_blank'
                  rel='noopener noreferrer'
                  size='xs'
                  onClick={() => track.externalLink(result.title ?? result.url!, result.url)}
                >
                  &ldquo;{result.title}&rdquo;
                </Anchor>
              ) : (
                <>&ldquo;{result.title}&rdquo;</>
              )}
            </Text>
            {result.subtitle && (
              <List size='xs' spacing={0} sx={{ listStyleType: 'circle', paddingLeft: 4 }}>
                <List.Item sx={(t) => ({ color: t.colors.gray[6] })}>
                  <Spoiler
                    maxHeight={18}
                    showLabel='Show more'
                    hideLabel='Hide'
                    styles={(t) => ({
                      control: { fontSize: t.fontSizes.xs, color: t.colors.blue[4] },
                    })}
                  >
                    <Text size='xs' c='gray.6' style={{ wordBreak: 'break-word' }}>{result.subtitle}</Text>
                  </Spoiler>
                </List.Item>
              </List>
            )}
          </List.Item>
        ))}
      </List>
    );
  }

  return (
    <Stack spacing='xs'>
      {displayResults.map((result, index) => (
        <Box
          key={index}
          p='xs'
          sx={(theme) => ({
            backgroundColor: theme.colors.dark[6],
            borderRadius: 4,
          })}
        >
          <Group spacing='xs' noWrap>
            {result.faviconUrl && (
              <Image
                src={result.faviconUrl}
                alt=''
                width={16}
                height={16}
                fit='contain'
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            )}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              {result.url ? (
                <Anchor
                  href={result.url}
                  target='_blank'
                  rel='noopener noreferrer'
                  size='sm'
                  c='gray.4'
                  onClick={() => track.externalLink(result.title ?? result.url!, result.url)}
                  sx={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    display: 'block',
                  }}
                >
                  {result.title}
                </Anchor>
              ) : (
                <Text
                  size='sm'
                  c='gray.4'
                  sx={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {result.title}
                </Text>
              )}
              {result.subtitle && (
                <Text size='xs' c='gray.6' lineClamp={2}>
                  {result.subtitle}
                </Text>
              )}
              {result.domain && (
                <Text size='xs' c='gray.6'>
                  {result.domain}
                </Text>
              )}
              {result.identifier && (
                <Text size='xs' c='gray.6' ff='monospace'>
                  {result.identifier}
                </Text>
              )}
            </Box>
          </Group>
        </Box>
      ))}
    </Stack>
  );
}
