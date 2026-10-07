import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import GraphCitationAnchor from './GraphCitationAnchor';
import type { HandleMap } from '@/features/chat/utils/graphCitationHelpers';

const handleMap: HandleMap = {
  E1: 'node-1',
  R1: { src: 'node-1', relType: 'AGENCY_FIT', tgt: 'node-2' },
};

function setup(handle: string) {
  const onPin = jest.fn();
  render(<GraphCitationAnchor handle={handle} handleMap={handleMap} onPin={onPin} />);
  const anchor = screen.getByRole('button', { name: new RegExp(handle) });
  return { anchor, onPin };
}

describe('GraphCitationAnchor', () => {
  it('renders a clean marker, not the raw [[handle]]', () => {
    const { anchor } = setup('E1');
    expect(anchor).toBeInTheDocument();
    expect(anchor.textContent).not.toContain('[[E1]]');
    expect(anchor).toHaveAttribute('data-graph-citation', 'E1');
  });

  it('pins the cited node on click (E# → node target)', () => {
    const { anchor, onPin } = setup('E1');
    fireEvent.click(anchor);
    expect(onPin).toHaveBeenCalledWith({ nodeUuid: 'node-1' });
  });

  it('pins the cited relationship on click (R# → edge target)', () => {
    const { anchor, onPin } = setup('R1');
    fireEvent.click(anchor);
    expect(onPin).toHaveBeenCalledWith({
      edge: { src: 'node-1', relType: 'AGENCY_FIT', tgt: 'node-2' },
    });
  });

  it('pins via keyboard (Enter) as the accessible equivalent of click', async () => {
    const user = userEvent.setup();
    const { anchor, onPin } = setup('E1');
    anchor.focus();
    await user.keyboard('{Enter}');
    expect(onPin).toHaveBeenCalledWith({ nodeUuid: 'node-1' });
  });

  it('renders the cited text as an underlined span link and pins the node on click', () => {
    const onPin = jest.fn();
    render(
      <GraphCitationAnchor handle='E1' handleMap={handleMap} onPin={onPin}>
        Acme Corp
      </GraphCitationAnchor>,
    );
    const anchor = screen.getByRole('button', { name: /E1/ });
    // The cited entity name is the marker itself (not a floating dot).
    expect(anchor).toHaveTextContent('Acme Corp');
    expect(anchor).toHaveClass('graph-citation-anchor', 'graph-citation-anchor--span');
    // Click pins identically to the dot.
    fireEvent.click(anchor);
    expect(onPin).toHaveBeenCalledWith({ nodeUuid: 'node-1' });
  });
});
