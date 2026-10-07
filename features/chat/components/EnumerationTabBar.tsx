import { ActionIcon, Group, ScrollArea, Text, Tooltip, UnstyledButton } from '@mantine/core';
import { IconX } from '@tabler/icons-react';
import { GraphSearchTab } from '@/features/chat/types/message';

interface EnumerationTabBarProps {
  tabs: GraphSearchTab[];
  activeTabId: string | null;
  onTabChange?: (tabId: string | null) => void;
  onTabClose?: (tabId: string) => void;
}

export default function EnumerationTabBar({
  tabs,
  activeTabId,
  onTabChange,
  onTabClose,
}: EnumerationTabBarProps) {
  return (
    <ScrollArea
      type='always'
      scrollbarSize={6}
      sx={{ flexShrink: 0 }}
    >
      <Group spacing={0} noWrap px='sm' py={4} sx={{ borderBottom: '1px solid var(--mantine-color-dark-4)' }}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const truncatedLabel = tab.label.length > 30
            ? `${tab.label.substring(0, 30)}...`
            : tab.label;

          return (
            <Tooltip key={tab.id} label={tab.label} position='top' openDelay={400} withinPortal>
              <UnstyledButton
                onClick={() => onTabChange?.(isActive ? null : tab.id)}
                px='xs'
                py={2}
                mr={4}
                sx={(theme) => ({
                  borderRadius: 4,
                  backgroundColor: isActive ? theme.colors.cyan[9] : 'transparent',
                  border: isActive
                    ? `1px solid ${theme.colors.cyan[7]}`
                    : '1px solid transparent',
                  '&:hover': {
                    backgroundColor: isActive ? theme.colors.cyan[9] : theme.colors.dark[5],
                  },
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  maxWidth: 280,
                  cursor: 'pointer',
                })}
              >
                <Text size={10} color={isActive ? 'cyan.2' : 'gray.4'} fw={isActive ? 600 : 400} lineClamp={1}>
                  {truncatedLabel}
                </Text>
                <Text size={10} color={isActive ? 'cyan.4' : 'gray.6'}>
                  ({tab.data.rowCount})
                </Text>

                {onTabClose && (
                  <ActionIcon
                    size={14}
                    variant='transparent'
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      onTabClose(tab.id);
                    }}
                    sx={(theme) => ({
                      color: isActive ? theme.colors.cyan[4] : theme.colors.gray[6],
                      '&:hover': { color: theme.colors.red[5] },
                    })}
                  >
                    <IconX size={10} />
                  </ActionIcon>
                )}
              </UnstyledButton>
            </Tooltip>
          );
        })}
      </Group>
    </ScrollArea>
  );
}
