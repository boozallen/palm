import { Badge, Group, Tooltip } from '@mantine/core';

type Collection = {
  id: string;
  name: string;
  color: string | null;
};

type CollectionBadgesProps = {
  collections?: Collection[];
  maxVisible?: number;
  showTooltips?: boolean;
  maxBadgeWidth?: string;
};

export default function CollectionBadges({
  collections = [],
  maxVisible = 3,
  showTooltips = false,
  maxBadgeWidth,
}: CollectionBadgesProps) {
  if (collections.length === 0) {
    return null;
  }

  const visibleCollections = collections.slice(0, maxVisible);
  const remainingCount = collections.length - maxVisible;

  const renderBadge = (collection: Collection) => {
    const badge = (
      <Badge
        key={collection.id}
        size='xs'
        variant='filled'
        color={collection.color || '#228BE6'}
        sx={{ cursor: 'default' }}
        style={maxBadgeWidth ? {
          maxWidth: maxBadgeWidth,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        } : undefined}
      >
        {collection.name}
      </Badge>
    );

    if (showTooltips) {
      return (
        <Tooltip key={collection.id} label={collection.name} withArrow position='top'>
          {badge}
        </Tooltip>
      );
    }

    return badge;
  };

  const renderRemainingBadge = () => {
    const badge = (
      <Badge size='xs' variant='outline' color='gray' sx={{ cursor: 'default' }}>
        +{remainingCount}
      </Badge>
    );

    if (showTooltips) {
      return (
        <Tooltip
          label={collections.slice(maxVisible).map((c) => c.name).join(', ')}
          withArrow
          position='top'
          multiline
        >
          {badge}
        </Tooltip>
      );
    }

    return badge;
  };

  return (
    <Group spacing={4}>
      {visibleCollections.map((collection) => renderBadge(collection))}
      {remainingCount > 0 && renderRemainingBadge()}
    </Group>
  );
}
