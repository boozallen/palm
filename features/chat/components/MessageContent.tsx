import type { ReactNode } from 'react';
import type { Components } from 'react-markdown';

import Markdown from '@/components/content/Markdown';
import GraphCitationAnchor from '@/features/chat/components/GraphCitationAnchor';
import { remarkGraphCitations } from '@/features/chat/utils/remarkGraphCitations';
import type { HandleMap, GraphCitationTarget } from '@/features/chat/utils/graphCitationHelpers';

export type GraphCitationHandlers = {
  handleMap: HandleMap;
  onPin: (target: GraphCitationTarget | null) => void;
};

type MessageContentProps = {
  content: string;
  // When provided (new graph-evidence answers), the inline `[[E#]]/[[R#]]` markers in `content` are
  // rendered as interactive citation anchors that cross-highlight the cited graph element(s). Absent
  // for every other message → plain markdown, exactly as before.
  graphCitations?: GraphCitationHandlers;
};

export default function MessageContent({ content, graphCitations }: MessageContentProps) {
  if (!graphCitations) {
    return <Markdown value={content} />;
  }

  const { handleMap, onPin } = graphCitations;
  // react-markdown renders the `<graphcitation handle="…">` hast element (emitted by
  // remarkGraphCitations) through this lowercase component slot, passing `handle` as a prop.
  const extraComponents = {
    graphcitation: ({ handle, children }: { handle?: string; children?: ReactNode }) =>
      handle ? (
        <GraphCitationAnchor
          handle={handle}
          handleMap={handleMap}
          onPin={onPin}
        >
          {children}
        </GraphCitationAnchor>
      ) : null,
  } as unknown as Components;

  return (
    <Markdown
      value={content}
      extraRemarkPlugins={[remarkGraphCitations(handleMap)]}
      extraComponents={extraComponents}
    />
  );
}
