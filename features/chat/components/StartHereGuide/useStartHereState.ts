import { useCallback, useEffect, useRef, useState } from 'react';

import { UiPreference } from '@/types/ui-preferences';

export default function useStartHereState({ enabled = true }: { enabled?: boolean } = {}) {
  const [hasSeen, setHasSeen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const hydrated = useRef(false);

  useEffect(() => {
    if (!enabled || hydrated.current) {
      return;
    }
    hydrated.current = true;
    const seen = localStorage.getItem(UiPreference.START_HERE_GUIDE_SEEN) === 'true';
    setHasSeen(seen);
    // First visit: auto-open once and mark seen so it doesn't reopen automatically.
    if (!seen) {
      setExpanded(true);
      setHasSeen(true);
      localStorage.setItem(UiPreference.START_HERE_GUIDE_SEEN, 'true');
    }
  }, [enabled]);

  const expand = useCallback(() => {
    setExpanded(true);
    setHasSeen(true);
    localStorage.setItem(UiPreference.START_HERE_GUIDE_SEEN, 'true');
  }, []);

  const collapse = useCallback(() => {
    setExpanded(false);
  }, []);

  return { hasSeen, expanded: enabled && expanded, expand, collapse };
}
