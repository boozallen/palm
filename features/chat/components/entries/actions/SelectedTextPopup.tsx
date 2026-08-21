import { Button, ThemeIcon, Popover } from '@mantine/core';
import { useCallback, useEffect, useRef } from 'react';
import { IconQuote } from '@tabler/icons-react';

import useSelectedTextPopup from '@/features/chat/hooks/useSelectedTextPopup';
import { useChat } from '@/features/chat/providers/ChatProvider';
import { useTrackClientEvent } from '@/features/shared/hooks/useTrackClientEvent';

// How long a selection must hold still before it is audited. A drag reports a
// growing selection the whole way across a paragraph, so recording each report
// would write several partial records for one highlight.
const AUDIT_SETTLE_MS = 700;

interface SelectedTextPopupProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  messageId?: string;
}

export default function SelectedTextPopup({
  containerRef,
  messageId,
}: SelectedTextPopupProps) {
  const targetRef = useRef<HTMLDivElement>(null);
  const { setSelectedText, chatId } = useChat();
  const track = useTrackClientEvent();

  // The selection waiting to be audited, and the timer that will audit it.
  const pendingSelectionRef = useRef('');
  const settleTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Held in a ref so the selection listener isn't re-armed every render: the
  // hook re-registers its DOM listeners whenever these callbacks change, and
  // useTrackClientEvent returns a fresh object each time.
  const recordRef = useRef<(length: number) => void>(() => {});
  recordRef.current = (length: number) => {
    // Length only, never the text: the selection is model output the user is
    // reading, and the audit trail is not the place to keep response content.
    track.highlightResponseText(length, messageId, chatId);
  };

  const flushPendingHighlight = useCallback(() => {
    clearTimeout(settleTimeoutRef.current);
    const pending = pendingSelectionRef.current;
    if (!pending) {
      return;
    }
    pendingSelectionRef.current = '';
    recordRef.current(pending.length);
  }, []);

  const queueHighlight = useCallback((text: string) => {
    pendingSelectionRef.current = text;
    clearTimeout(settleTimeoutRef.current);
    settleTimeoutRef.current = setTimeout(flushPendingHighlight, AUDIT_SETTLE_MS);
  }, [flushPendingHighlight]);

  // The selection ending is the gesture completing, so flush rather than drop:
  // clicking "Ask Palm" clears the selection, and that is the highlight most
  // worth having a record of.
  const {
    selectedText,
    closeSelectedTextPopup,
  } = useSelectedTextPopup({
    containerRef,
    targetRef,
    onSelectionChange: queueHighlight,
    onSelectionClear: flushPendingHighlight,
  });

  useEffect(() => () => clearTimeout(settleTimeoutRef.current), []);

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
