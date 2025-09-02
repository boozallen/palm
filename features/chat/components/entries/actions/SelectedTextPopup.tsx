import { Button, ThemeIcon, Popover } from '@mantine/core';
import { useRef } from 'react';
import { IconQuote } from '@tabler/icons-react';

import useSelectedTextPopup from '@/features/chat/hooks/useSelectedTextPopup';
import { useChat } from '@/features/chat/providers/ChatProvider';

interface SelectedTextPopupProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export default function SelectedTextPopup({
  containerRef,
}: SelectedTextPopupProps) {
  const targetRef = useRef<HTMLDivElement>(null);
  const { setSelectedText } = useChat();

  const {
    selectedText,
    closeSelectedTextPopup,
  } = useSelectedTextPopup({ containerRef, targetRef });

  const handleClick = () => {
    setSelectedText(selectedText);
    closeSelectedTextPopup();
  };

  return (
    <Popover
      opened={selectedText.length > 0}
      position='top'
      offset={0}
      withArrow
      middlewares={{ flip: true, shift: true }}
    >
      <Popover.Target>
        <div
          ref={targetRef}
          style={{ position: 'fixed' }}
        />
      </Popover.Target>
      <Popover.Dropdown
        p={0} 
        style={{ border: 'none', background: 'transparent' }}
      >
        <Button
          variant='filled'
          size='sm'
          radius='md'
          color='gray'
          onClick={handleClick}
          leftIcon={
            <ThemeIcon size='xs' variant='noHover'>
              <IconQuote />
            </ThemeIcon>
          }
        >
          Ask Palm
        </Button>
      </Popover.Dropdown>
    </Popover>
  );
}
