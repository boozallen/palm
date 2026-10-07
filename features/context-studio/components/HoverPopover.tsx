import { cloneElement, useState } from 'react';
import {
  Popover,
  type PopoverProps,
} from '@mantine/core';

export default function HoverPopover({
  target,
  children,
  position = 'bottom',
  width = 260,
}: {
  target: React.ReactElement<{ onMouseEnter?: () => void; onMouseLeave?: () => void }>;
  children: React.ReactNode;
  position?: PopoverProps['position'];
  width?: number;
}) {
  const [opened, setOpened] = useState(false);

  return (
    <Popover opened={opened} onChange={setOpened} position={position} withArrow withinPortal width={width} shadow='md'>
      <Popover.Target>
        {cloneElement(target, {
          onMouseEnter: () => setOpened(true),
          onMouseLeave: () => setOpened(false),
        })}
      </Popover.Target>
      <Popover.Dropdown data-testid='hover-popover-content'>{children}</Popover.Dropdown>
    </Popover>
  );
}
