import { KeyboardEvent, type ReactNode } from 'react';

import { resolveCitationTarget, type HandleMap, type GraphCitationTarget } from '@/features/chat/utils/graphCitationHelpers';

type GraphCitationAnchorProps = Readonly<{
  handle: string;
  handleMap: HandleMap;
  onPin: (target: GraphCitationTarget | null) => void;
  // The cited entity text when the agent wrapped it in the handle (`[[E#:name]]`). Present → render
  // that phrase as a dotted-underline link; absent → render the legacy floating dot.
  children?: ReactNode;
}>;

/**
 * The inline marker react-markdown renders in place of an `[[E#]]/[[R#]]/[[Q#]]` citation. Clicking
 * it pins the cited node/edge on the graph canvas IDENTICALLY to left-clicking that element on the
 * canvas (Enter/Space is the keyboard equivalent). It resolves the handle to its single UUID-space
 * target once and hands it up; the canvas owns the UUID→rendered-element mapping. (No hover behavior:
 * a faithful hover would require driving vis-network's internal hover state, so the marker is pin-only
 * — pinning is the part that maps cleanly onto the canvas's existing behavior.)
 *
 * Two visuals, one behavior: when `children` (a cited entity span) is present the marker is the cited
 * text styled as a teal dotted-underline link; otherwise it's the floating teal dot. Both pin the same
 * target on click/Enter.
 */
export default function GraphCitationAnchor({
  handle,
  handleMap,
  onPin,
  children,
}: GraphCitationAnchorProps) {
  const target = resolveCitationTarget(handle, handleMap);

  // A plain click pins; click-dragging across the phrase still selects/copies text (a drag doesn't
  // fire click), so the cited text stays readable/copyable.
  const handleClick = () => {
    onPin(target);
  };
  const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onPin(target);
    }
  };

  // Span variant: render the cited entity text itself as the marker (a subtle teal dotted underline).
  // A plain click pins; drag-selecting the phrase still copies its text (a drag doesn't fire click).
  const hasSpan =
    children != null && children !== '' && !(Array.isArray(children) && children.length === 0);
  if (hasSpan) {
    return (
      <span
        role='button'
        tabIndex={0}
        aria-label={`Graph evidence citation ${handle}`}
        title='Click to pin this graph evidence'
        data-graph-citation={handle}
        className='graph-citation-anchor graph-citation-anchor--span'
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        style={{
          cursor: 'pointer',
          // Color the cited phrase itself teal so each graph-evidence entity visibly stands out from
          // the muted body text (longhand text-decoration props render more reliably than the shorthand).
          color: '#3CC9C9',
          fontWeight: 500,
          textDecorationLine: 'underline',
          textDecorationStyle: 'dotted',
          textDecorationColor: '#3CC9C9',
          textUnderlineOffset: '2px',
        }}
      >
        {children}
      </span>
    );
  }

  return (
    <sup
      role='button'
      tabIndex={0}
      aria-label={`Graph evidence citation ${handle}`}
      title='Click to pin this graph evidence'
      data-graph-citation={handle}
      className='graph-citation-anchor'
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      style={{
        cursor: 'pointer',
        color: '#3CC9C9',
        fontSize: '1em',
        lineHeight: 0,
        margin: '0 1px',
        userSelect: 'none',
      }}
    >
      ●
    </sup>
  );
}
