import { Box } from '@mantine/core';
import { IconPointerFilled } from '@tabler/icons-react';

type FakeCursorProps = { x: number; y: number; clicking?: boolean };

export default function FakeCursor({ x, y, clicking = false }: FakeCursorProps) {
  return (
    <Box
      data-testid='fake-cursor'
      aria-hidden
      style={{
        transform: `translate(${x}px, ${y}px) scale(${clicking ? 0.8 : 1})`,
      }}
      sx={(theme) => ({
        position: 'absolute',
        top: 0,
        left: 0,
        color: theme.white,
        transition: 'transform 500ms ease',
        pointerEvents: 'none',
        zIndex: 5,
        filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))',
      })}
    >
      <IconPointerFilled size={18} />
    </Box>
  );
}
