import { Badge, createStyles } from '@mantine/core';

const useStyles = createStyles((theme) => ({
  badge: {
    color: theme.colors.dark[8],
    padding: `${theme.spacing.xs} 12px`,
  },
}));

type TagBadgesProps = {
  tags: string[]
};

// Tag badges for the provided tags, currently all orange but color will eventually be dependent on content.
// To adjust positioning, wrap in a <Group> and use its parameters.
export default function TagBadges({ tags }: TagBadgesProps) {
  const { classes } = useStyles();
  return (
    <>
      {tags.map((tag) => (
        <Badge
          className={classes.badge}
          fz='xs'
          key={tag}
          radius='36px'
          color='orange'
          variant='filled'
        >
          {tag}
        </Badge >
      ))
      }
    </>
  );
}
