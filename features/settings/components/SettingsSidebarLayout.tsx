import { Box, Stack, Text, UnstyledButton } from '@mantine/core';
import { ReactNode } from 'react';

import { useTrackClientEvent } from '@/features/shared/hooks/useTrackClientEvent';

interface SidebarItem {
  value: string;
  label: string;
  enabled?: boolean;
}

interface SettingsSidebarLayoutProps {
  items: SidebarItem[];
  activeItem: string;
  onItemChange: (value: string) => void;
  children: ReactNode;
}

export default function SettingsSidebarLayout({
  items,
  activeItem,
  onItemChange,
  children,
}: SettingsSidebarLayoutProps) {
  const visibleItems = items.filter((item) => item.enabled !== false);
  const track = useTrackClientEvent();

  const handleItemChange = (item: SidebarItem) => {
    track.navigate(item.label, `/settings#${item.value}`);
    onItemChange(item.value);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 16,
        height: '100%',
        minHeight: 0,
      }}
    >
      <Box
        sx={(theme) => ({
          width: 200,
          flexShrink: 0,
          backgroundColor: theme.colors.dark[6],
          borderRadius: theme.radius.md,
          padding: 16,
          overflowY: 'auto',
        })}
      >
        <Stack spacing='sm'>
          {visibleItems.map((item) => {
            const isActive = activeItem === item.value;

            return (
              <UnstyledButton
                key={item.value}
                onClick={() => handleItemChange(item)}
                data-testid={`sidebar-${item.value}`}
                sx={(theme) => ({
                  padding: '10px 12px',
                  width: '100%',
                  borderRadius: theme.radius.sm,
                  backgroundColor: isActive
                    ? theme.colors.dark[5]
                    : 'transparent',
                  '&:hover': {
                    backgroundColor: theme.colors.dark[5],
                  },
                  transition: 'all 0.15s ease',
                })}
              >
                <Text
                  size='sm'
                  weight={isActive ? 600 : 400}
                  color={isActive ? 'cyan.4' : 'gray.5'}
                  sx={{ transition: 'all 0.15s ease' }}
                >
                  {item.label}
                </Text>
              </UnstyledButton>
            );
          })}
        </Stack>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0, minWidth: 0 }}>
        {children}
      </Box>
    </Box>
  );
}
