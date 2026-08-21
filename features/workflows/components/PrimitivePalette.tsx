/**
 * Primitive Palette - Sidebar showing available primitives to drag onto canvas
 */

import { Stack, Card, Text, Group, ThemeIcon, Box, Badge, ActionIcon, Tooltip } from '@mantine/core';
import {
  IconTool,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
} from '@tabler/icons-react';

import { UiPreference } from '@/types/ui-preferences';
import { useState, useEffect } from 'react';
import { NODE_REGISTRY } from '@/features/workflows/utils/node-registry';

export default function PrimitivePalette() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const savedState = localStorage.getItem(UiPreference.WORKFLOW_NODES_CONTAINER_COLLAPSED);
    if (savedState === 'true') {
      setIsCollapsed(true);
    }
  }, []);

  const handleToggleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem(UiPreference.WORKFLOW_NODES_CONTAINER_COLLAPSED, newState.toString());
  };

  const onDragStart = (event: React.DragEvent<HTMLDivElement>, type: string, label: string, enabled: boolean) => {
    if (!enabled) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.setData('application/reactflow', type);
    event.dataTransfer.effectAllowed = 'move';

    // Create a clean ghost image so the drag preview doesn't appear tiny/offset
    const ghost = document.createElement('div');
    ghost.textContent = label;
    ghost.style.cssText =
      'position:fixed;top:-200px;left:-200px;padding:8px 14px;background:#1a1b1e;border:1px solid #373A40;border-radius:6px;font-size:14px;font-weight:600;color:#C1C2C5;white-space:nowrap;';
    document.body.appendChild(ghost);
    event.dataTransfer.setDragImage(ghost, ghost.offsetWidth / 2, ghost.offsetHeight / 2);
    setTimeout(() => document.body.removeChild(ghost), 0);
  };

  const primitives = Object.values(NODE_REGISTRY).sort((a, b) => {
    if (a.enabled === b.enabled) { return 0; }
    return a.enabled ? -1 : 1;
  });

  return (
    <Box
      w={isCollapsed ? 64 : 260}
      p='md'
      bg='dark.6'
      style={{
        height: '100%',
        overflowY: 'auto',
      }}
    >
      <Stack spacing='md'>
        <Group
          position={isCollapsed ? 'center' : 'apart'}
          align='center'
        >
          {!isCollapsed && (
            <Text
              size='sm'
              weight={700}
              transform='uppercase'
              c='white'
              style={{
                letterSpacing: '1px',
                fontSize: '13px',
              }}
            >
              <Group spacing='sm' style={{ display: 'inline-flex' }}>
                <IconTool size={14} />
                <span>Nodes</span>
              </Group>
            </Text>
          )}
          <ActionIcon
            variant='subtle'
            size='sm'
            c='gray.4'
            onClick={handleToggleCollapse}
            title={isCollapsed ? 'Expand AI nodes panel' : 'Collapse AI nodes panel'}
            sx={(theme) => ({
              '&:hover': {
                backgroundColor: theme.colors.dark[5],
                color: theme.colors.gray[2],
              },
            })}
          >
            {isCollapsed ?
              <IconLayoutSidebarLeftExpand stroke={1.5} size={16} />
            :
              <IconLayoutSidebarLeftCollapse stroke={1.5} size={16} />
            }
          </ActionIcon>
        </Group>

        {!isCollapsed ? (
          primitives.map((def) => {
            const IconComponent = def.icon;
            return (
              <Card
                key={def.type}
                p='sm'
                bg={def.enabled ? 'dark.4' : 'dark.8'}
                style={{
                  cursor: def.enabled ? 'grab' : 'default',
                  opacity: def.enabled ? 1 : 0.4,
                }}
                sx={(theme) => ({
                  '&:hover': def.enabled ? {
                    backgroundColor: theme.colors.dark[5],
                  } : {},
                })}
                draggable={def.enabled}
                onDragStart={(e: React.DragEvent<HTMLDivElement>) => onDragStart(e, def.type, def.label, def.enabled)}
              >
                <Group spacing='sm' noWrap>
                  <ThemeIcon
                    size={32}
                    radius='md'
                    bg='transparent'
                    c='gray.3'
                  >
                    <IconComponent size={20} />
                  </ThemeIcon>
                  <Box style={{ flex: 1, minWidth: 0 }}>
                    <Group spacing={6} noWrap>
                      <Text size='sm' weight={600} c='gray.1'>
                        {def.label}
                      </Text>
                      {!def.enabled && (
                        <Badge size='xs' variant='outline' color='gray'>
                          Soon
                        </Badge>
                      )}
                    </Group>
                    <Text size='xs' color='dimmed' lineClamp={2}>
                      {def.description}
                    </Text>
                  </Box>
                </Group>
              </Card>
            );
          })
        ) : (
          <Stack spacing='md' align='center'>
            {primitives.map((def) => {
              const IconComponent = def.icon;
              return (
                <Tooltip
                  key={def.type}
                  label={def.enabled ? def.label : `${def.label} (Coming Soon)`}
                  position='right'
                >
                  <ThemeIcon
                    size={40}
                    radius='md'
                    bg={def.enabled ? 'dark.4' : 'dark.8'}
                    c='gray.3'
                    style={{
                      cursor: def.enabled ? 'grab' : 'default',
                      opacity: def.enabled ? 1 : 0.4,
                    }}
                    sx={(theme) => ({
                      '&:hover': def.enabled ? {
                        backgroundColor: theme.colors.dark[5],
                      } : {},
                    })}
                    draggable={def.enabled}
                    onDragStart={(e: React.DragEvent<HTMLDivElement>) => onDragStart(e, def.type, def.label, def.enabled)}
                  >
                    <IconComponent size={20} />
                  </ThemeIcon>
                </Tooltip>
              );
            })}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
