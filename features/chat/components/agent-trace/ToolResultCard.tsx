import { Box, Text, Stack, Anchor, Group, Image, ThemeIcon, List, Spoiler } from '@mantine/core';

import { getFileTypeConfig } from '@/features/chat/utils/chatHelperFunctions';
import { ToolResult } from '@/features/chat/types/agent-trace';
import { useTrackClientEvent } from '@/features/shared/hooks/useTrackClientEvent';

type ToolResultCardProps = Readonly<{
  results: ToolResult[];
  asList?: boolean;
  isSearch?: boolean;
}>;

export default function ToolResultCard({ results, asList = false, isSearch = false }: ToolResultCardProps) {
  const displayResults = results;
  const track = useTrackClientEvent();

  if (asList) {
    return (
      <Stack spacing={4} pl='lg'>
        {displayResults.map((result, index) => {
          const { color, icon: Icon } = getFileTypeConfig(result.title ?? '');
          return (
            <Group key={index} spacing={6} noWrap>
              <ThemeIcon size={14} c={color} variant='transparent' style={{ pointerEvents: 'none', flexShrink: 0 }}>
                <Icon size={14} stroke={2} />
              </ThemeIcon>
              <Text size='xs' c='gray.4' style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {result.title}
              </Text>
            </Group>
          );
        })}
      </Stack>
    );
  }

  if (isSearch) {
    return (
      <List size='xs' sx={{ listStyleType: 'disc', paddingLeft: '24px !important', overflow: 'hidden' }}>
        {displayResults.map((result, index) => (
          <List.Item key={index} sx={(t) => ({ color: t.colors.gray[4] })}>
            <Text size='xs' c='gray.3' span style={{ wordBreak: 'break-word' }}>
              {result.url ? (
                <Anchor
                  href={result.url}
                  target='_blank'
                  rel='noopener noreferrer'
                  size='xs'
                  onClick={() => track.externalLink(result.title ?? result.url!, result.url)}
                >
                  <em>&ldquo;{result.title}&rdquo;</em>
                </Anchor>
              ) : (
                <em>&ldquo;{result.title}&rdquo;</em>
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
                    <Text size='xs' c='dimmed' style={{ wordBreak: 'break-word' }}>{result.subtitle}</Text>
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
                <Text size='xs' c='dimmed' lineClamp={2}>
                  {result.subtitle}
                </Text>
              )}
              {result.domain && (
                <Text size='xs' c='dimmed'>
                  {result.domain}
                </Text>
              )}
              {result.identifier && (
                <Text size='xs' c='dimmed' ff='monospace'>
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
