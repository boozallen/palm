import { Card, createStyles, Stack, Text, useMantineTheme, ThemeIcon } from '@mantine/core';
import { useRouter } from 'next/router';
import { KeyboardEvent, MouseEvent } from 'react';
import { IconPlus } from '@tabler/icons-react';

const useStyles = createStyles((theme) => ({
  card: {
    minHeight: '188px',
    display: 'flex',
    flexGrow: 1,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    border: `2px dashed ${theme.colors.dark[4]}`,
    background: 'transparent',
    ':hover': {
      background: theme.colors.dark[5],
      cursor: 'pointer',
      borderColor: theme.colors.blue[6],
    },
    ':focus-visible': {
      borderColor: theme.colors.blue[6],
      borderWidth: '2px',
    },
  },
}));

export function EmptyWorkflowCard() {
  const theme = useMantineTheme();
  const router = useRouter();
  const { classes } = useStyles();

  const handleCardOnClick = (event: MouseEvent<HTMLDivElement, MouseEvent>) => {
    router.push('/workflows/create');
    event.stopPropagation();
  };

  const handleCardKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter') {
      router.push('/workflows/create');
      event.stopPropagation();
    }
  };

  return (
    <Card
      className={classes.card}
      aria-label='Create new workflow'
      tabIndex={0}
      shadow='sm'
      p='none'
      radius='6px'
      withBorder={false}
      onClick={handleCardOnClick}
      onKeyDown={handleCardKeyDown}
    >
      <Stack spacing='md' align='center'>
        <ThemeIcon size='xl' radius='xl' variant='light' color='blue'>
          <IconPlus size={32} />
        </ThemeIcon>
        <Text color='gray.6' size='md' weight={500}>
          Create Workflow
        </Text>
      </Stack>
    </Card>
  );
}
