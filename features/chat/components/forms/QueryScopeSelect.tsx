import { useMemo } from 'react';
import { Button, Menu, Text, Group } from '@mantine/core';
import { IconFileText, IconTable, IconTopologyRing, IconPointer } from '@tabler/icons-react';
import { useChat } from '@/features/chat/providers/ChatProvider';
import { QueryScope } from '@/features/chat/types/message';

const SCOPE_CONFIG = {
  [QueryScope.DOCUMENT]: {
    label: 'Document scope',
    icon: IconFileText,
    description: 'Query across all selected documents',
  },
  [QueryScope.TABLE]: {
    label: 'Table tab',
    icon: IconTable,
    description: 'Scope to active tab results',
  },
  [QueryScope.GRAPH]: {
    label: 'Graph',
    icon: IconTopologyRing,
    description: 'Scope to nodes displayed on graph',
  },
  [QueryScope.GRAPH_SELECTION]: {
    label: 'Graph selection',
    icon: IconPointer,
    description: 'Scope to selected nodes on graph',
  },
};

export default function QueryScopeSelect() {
  const {
    queryScope,
    setQueryScope,
    enumerationTabs,
    activeEnumerationTabId,
    graphCanvasSelectedEntityIds,
    graphDisplayedEntityIds,
  } = useChat();

  const activeTab = enumerationTabs.find(t => t.id === activeEnumerationTabId);

  const counts = useMemo(() => {
    const tableTabCount = activeTab
      ? activeTab.data.rowCount
      : 0;
    const graphCount = graphDisplayedEntityIds.length;
    const selectedCount = graphCanvasSelectedEntityIds.length;
    return { tableTabCount, graphCount, selectedCount };
  }, [activeTab, graphDisplayedEntityIds, graphCanvasSelectedEntityIds]);

  const countForMode = (mode: QueryScope): number | null => {
    switch (mode) {
      case QueryScope.TABLE: return counts.tableTabCount || null;
      case QueryScope.GRAPH: return counts.graphCount || null;
      case QueryScope.GRAPH_SELECTION: return counts.selectedCount || null;
      default: return null;
    }
  };

  // Only Document scope is supported for now — Table/Graph/Graph-selection scopes
  // aren't yet honored by the agentic chat path, so keep them disabled.
  const isDisabled = (mode: QueryScope): boolean => mode !== QueryScope.DOCUMENT;

  const currentConfig = SCOPE_CONFIG[queryScope];
  const CurrentIcon = currentConfig.icon;
  const currentCount = countForMode(queryScope);

  return (
    <Menu withinPortal position='top-start' shadow='md'>
      <Menu.Target>
        <Button
          variant='subtle'
          size='xs'
          compact
          pt='xs'
          pl='0'
          sx={(theme) => ({
            color: queryScope === QueryScope.DOCUMENT
              ? theme.colors.gray[5]
              : theme.colors.cyan[4],
            '&:hover': {
              backgroundColor: theme.colors.dark[5],
            },
          })}
          leftIcon={<CurrentIcon size={18} />}
        >
          <Text>
            {currentConfig.label}
            {currentCount !== null && ` (${currentCount})`}
          </Text>
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Query Scope</Menu.Label>
        {Object.entries(SCOPE_CONFIG).map(([mode, config]) => {
          const Icon = config.icon;
          const count = countForMode(mode as QueryScope);
          const isActive = mode === queryScope;
          const disabled = isDisabled(mode as QueryScope);

          return (
            <Menu.Item
              key={mode}
              icon={<Icon size={14} color={disabled ? 'gray' : undefined} />}
              disabled={disabled}
              onClick={() => setQueryScope(mode as QueryScope)}
              sx={(theme) => ({
                backgroundColor: isActive ? theme.colors.dark[5] : undefined,
              })}
            >
              <Group spacing={4}>
                <Text size='xs' fw={isActive ? 600 : 400}>{config.label}</Text>
                {count !== null && (
                  <Text size='xs' color='dimmed'>({count})</Text>
                )}
              </Group>
              <Text size={10} color='dimmed'>{config.description}</Text>
            </Menu.Item>
          );
        })}
      </Menu.Dropdown>
    </Menu>
  );
}
