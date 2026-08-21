import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import GraphSearchTable from './GraphSearchTable';
import { GraphSearchResultData } from '@/features/chat/types/message';
import { renderWrapper } from '@/test/test-utils';

// Row-level nodeMapping (no colKey) → one checkbox per row + the header select-all.
const makeData = (): GraphSearchResultData => ({
  query: 'q',
  generatedCypher: '',
  rowCount: 3,
  rows: [{ name: 'Zebra' }, { name: 'Apple' }, { name: 'Mango' }],
  nodeMapping: [
    { rowIndex: 0, entityIds: ['z'] },
    { rowIndex: 1, entityIds: ['a'] },
    { rowIndex: 2, entityIds: ['m'] },
  ],
  kind: 'evidence',
});

const noop = () => {};

const visibleNames = () =>
  screen.getAllByText(/^(Zebra|Apple|Mango)$/).map((el) => el.textContent);

describe('GraphSearchTable — sort + Isolate (evidence opt-in)', () => {
  it('does not render sort affordances when sortable is false (enumeration default)', () => {
    const { container } = renderWrapper(
      <GraphSearchTable data={makeData()} selectedEntityIds={[]} onSelectionChange={noop} />,
    );
    // The sort header is an UnstyledButton wrapping the column title; with sortable off the title
    // is a plain Text, so no button carries the column name. (The "Add all" bulk button may render;
    // we only assert no SORT button exists.)
    expect(screen.queryByRole('button', { name: /Name/ })).not.toBeInTheDocument();
    container.querySelectorAll('button').forEach((b) => expect(b.textContent).toMatch(/add all/i));
  });

  it('sorts rows by column ascending then descending when sortable', async () => {
    const user = userEvent.setup();
    renderWrapper(
      <GraphSearchTable data={makeData()} selectedEntityIds={[]} onSelectionChange={noop} sortable />,
    );

    await user.click(screen.getByText('Name'));
    expect(visibleNames()).toEqual(['Apple', 'Mango', 'Zebra']);

    await user.click(screen.getByText('Name'));
    expect(visibleNames()).toEqual(['Zebra', 'Mango', 'Apple']);
  });

  it('keeps selection mapping intact through a sort (originalIndex preserved)', async () => {
    const user = userEvent.setup();
    const onSelectionChange = jest.fn();
    renderWrapper(
      <GraphSearchTable
        data={makeData()}
        selectedEntityIds={[]}
        onSelectionChange={onSelectionChange}
        sortable
      />,
    );

    await user.click(screen.getByText('Name')); // asc: Apple, Mango, Zebra
    // No header checkbox now; checkbox[0] = first data row = Apple → entityId 'a'.
    await user.click(screen.getAllByRole('checkbox')[0]);
    expect(onSelectionChange).toHaveBeenCalledWith(['a']);
  });

  it('Add all stays additive (adds filtered rows, keeps non-filtered selection)', async () => {
    const user = userEvent.setup();
    const onSelectionChange = jest.fn();
    renderWrapper(
      <GraphSearchTable
        data={makeData()}
        selectedEntityIds={['z']}
        onSelectionChange={onSelectionChange}
        sortable
      />,
    );

    await user.type(screen.getByPlaceholderText('Filter...'), 'ap'); // Apple only
    await user.click(screen.getByRole('button', { name: /add all/i }));

    expect(onSelectionChange).toHaveBeenCalledWith(['z', 'a']); // additive, not replace
  });
});

describe('GraphSearchTable — bulk add / remove from graph', () => {
  it('shows Add all (not Remove all) when nothing is selected', () => {
    renderWrapper(
      <GraphSearchTable data={makeData()} selectedEntityIds={[]} onSelectionChange={noop} sortable />,
    );
    expect(screen.getByRole('button', { name: /add all/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /remove all/i })).not.toBeInTheDocument();
  });

  it('adds every row from the empty state via Add all', async () => {
    const user = userEvent.setup();
    const onSelectionChange = jest.fn();
    renderWrapper(
      <GraphSearchTable data={makeData()} selectedEntityIds={[]} onSelectionChange={onSelectionChange} sortable />,
    );

    await user.click(screen.getByRole('button', { name: /add all/i }));
    expect(onSelectionChange).toHaveBeenCalledWith(['z', 'a', 'm']);
  });

  it('shows both Add all and Remove all for a partial selection; Add all adds the rest', async () => {
    const user = userEvent.setup();
    const onSelectionChange = jest.fn();
    renderWrapper(
      <GraphSearchTable
        data={makeData()}
        selectedEntityIds={['z']} // partial → both actions are meaningful
        onSelectionChange={onSelectionChange}
        sortable
      />,
    );

    expect(screen.getByRole('button', { name: /add all/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remove all/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /add all/i }));
    expect(onSelectionChange).toHaveBeenCalledWith(['z', 'a', 'm']);
  });

  it('hides Add all once everything is selected, and Remove all clears the graph', async () => {
    const user = userEvent.setup();
    const onSelectionChange = jest.fn();
    renderWrapper(
      <GraphSearchTable
        data={makeData()}
        selectedEntityIds={['z', 'a', 'm']} // all selected
        onSelectionChange={onSelectionChange}
        sortable
      />,
    );

    expect(screen.queryByRole('button', { name: /add all/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /remove all/i }));
    expect(onSelectionChange).toHaveBeenCalledWith([]);
  });

  it('Remove all only removes the filtered subset, leaving non-filtered selection intact', async () => {
    const user = userEvent.setup();
    const onSelectionChange = jest.fn();
    renderWrapper(
      <GraphSearchTable
        data={makeData()}
        selectedEntityIds={['z', 'a', 'm']}
        onSelectionChange={onSelectionChange}
        sortable
      />,
    );

    await user.type(screen.getByPlaceholderText('Filter...'), 'ap'); // Apple only → 'a'
    await user.click(screen.getByRole('button', { name: /remove all/i }));
    expect(onSelectionChange).toHaveBeenCalledWith(['z', 'm']);
  });

});

describe('GraphSearchTable — header status', () => {
  it('labels on-graph rows as "on graph", with no "selected" segment when the op-set is off', () => {
    renderWrapper(
      <GraphSearchTable data={makeData()} selectedEntityIds={['z', 'a', 'm']} onSelectionChange={noop} />,
    );
    expect(screen.getByText('3 on graph')).toBeInTheDocument();
    expect(screen.queryByText(/\d+ selected/)).not.toBeInTheDocument();
  });

  it('counts only the rows that are on the graph', () => {
    renderWrapper(
      <GraphSearchTable data={makeData()} selectedEntityIds={['z']} onSelectionChange={noop} />,
    );
    expect(screen.getByText('1 on graph')).toBeInTheDocument();
  });

  it('on-graph count is row-scoped — extra canvas membership does not inflate it', () => {
    // 'extra-canvas-node' is on the canvas (e.g. from an expansion) but isn't one of these 3 rows.
    renderWrapper(
      <GraphSearchTable
        data={makeData()}
        selectedEntityIds={['z', 'a', 'm', 'extra-canvas-node']}
        onSelectionChange={noop}
      />,
    );
    expect(screen.getByText('3 on graph')).toBeInTheDocument();
  });

  it('shows a row-scoped "selected" count when the op-set channel is wired', () => {
    renderWrapper(
      <GraphSearchTable
        data={makeData()}
        selectedEntityIds={['z', 'a', 'm']}
        onSelectionChange={noop}
        onSelectOnGraph={noop}
        opSelectedEntityIds={['z', 'a']} // 2 of the 3 on-graph rows are in the canvas op-set
      />,
    );
    expect(screen.getByText('3 on graph')).toBeInTheDocument();
    expect(screen.getByText('2 selected')).toBeInTheDocument();
  });
});

describe('GraphSearchTable — canvas selection (op-set channel)', () => {
  it('renders no selection actions when onSelectOnGraph is absent (membership-only table)', () => {
    renderWrapper(
      <GraphSearchTable data={makeData()} selectedEntityIds={['z', 'a', 'm']} onSelectionChange={noop} />,
    );
    expect(screen.queryByRole('button', { name: /^select all$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^deselect all$/i })).not.toBeInTheDocument();
  });

  it('Select all selects the on-graph rows into the op-set', async () => {
    const user = userEvent.setup();
    const onSelectOnGraph = jest.fn();
    renderWrapper(
      <GraphSearchTable
        data={makeData()}
        selectedEntityIds={['z', 'a', 'm']} // all on graph
        onSelectionChange={noop}
        onSelectOnGraph={onSelectOnGraph}
      />,
    );

    await user.click(screen.getByRole('button', { name: /^select all$/i }));
    expect(onSelectOnGraph).toHaveBeenCalledWith(['z', 'a', 'm']);
  });

  it('Select all scopes to the active column filter', async () => {
    const user = userEvent.setup();
    const onSelectOnGraph = jest.fn();
    renderWrapper(
      <GraphSearchTable
        data={makeData()}
        selectedEntityIds={['z', 'a', 'm']}
        onSelectionChange={noop}
        onSelectOnGraph={onSelectOnGraph}
      />,
    );

    await user.type(screen.getByPlaceholderText('Filter...'), 'ap'); // Apple only → 'a'
    await user.click(screen.getByRole('button', { name: /^select all$/i }));
    expect(onSelectOnGraph).toHaveBeenCalledWith(['a']);
  });

  it('offers no Select all for rows that are not on the graph', () => {
    renderWrapper(
      <GraphSearchTable
        data={makeData()}
        selectedEntityIds={[]} // nothing on graph → nothing the canvas can select
        onSelectionChange={noop}
        onSelectOnGraph={jest.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /^select all$/i })).not.toBeInTheDocument();
  });

  it('Clear toggles the op-selected rows back out', async () => {
    const user = userEvent.setup();
    const onSelectOnGraph = jest.fn();
    renderWrapper(
      <GraphSearchTable
        data={makeData()}
        selectedEntityIds={['z', 'a', 'm']}
        onSelectionChange={noop}
        onSelectOnGraph={onSelectOnGraph}
        opSelectedEntityIds={['z', 'a', 'm']} // all op-selected
      />,
    );

    await user.click(screen.getByRole('button', { name: /^deselect all$/i }));
    expect(onSelectOnGraph).toHaveBeenCalledWith(['z', 'a', 'm']);
  });

  it('hides Select all once every on-graph row is already op-selected, leaving Clear', () => {
    renderWrapper(
      <GraphSearchTable
        data={makeData()}
        selectedEntityIds={['z', 'a', 'm']}
        onSelectionChange={noop}
        onSelectOnGraph={noop}
        opSelectedEntityIds={['z', 'a', 'm']}
      />,
    );
    expect(screen.queryByRole('button', { name: /^select all$/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^deselect all$/i })).toBeInTheDocument();
  });

  it('row-body click sends the clicked row ids to onSelectOnGraph and leaves membership alone', async () => {
    const user = userEvent.setup();
    const onSelectOnGraph = jest.fn();
    const onSelectionChange = jest.fn();
    renderWrapper(
      <GraphSearchTable
        data={makeData()}
        selectedEntityIds={['a']} // Apple is on the graph (a member) → its row is op-selectable
        onSelectionChange={onSelectionChange}
        onSelectOnGraph={onSelectOnGraph}
      />,
    );

    await user.click(screen.getByText('Apple')); // click the row body, not the checkbox
    expect(onSelectOnGraph).toHaveBeenCalledWith(['a']);
    expect(onSelectionChange).not.toHaveBeenCalled();
  });

  it('marks rows whose nodes are in the operation-set with the left accent (opSelectedEntityIds)', () => {
    renderWrapper(
      <GraphSearchTable
        data={makeData()}
        selectedEntityIds={['a']}
        onSelectionChange={noop}
        onSelectOnGraph={noop}
        opSelectedEntityIds={['a']}
      />,
    );

    // The accent bar lives on the row's first cell (box-shadow on <tr> renders unreliably).
    const appleCell = screen.getByText('Apple').closest('tr')?.querySelector('td');
    expect(appleCell?.getAttribute('style') ?? '').toContain('inset');
    const zebraCell = screen.getByText('Zebra').closest('tr')?.querySelector('td');
    expect(zebraCell?.getAttribute('style') ?? '').not.toContain('inset');
  });
});
