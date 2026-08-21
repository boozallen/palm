import { screen, fireEvent } from '@testing-library/react';
import { renderWrapper } from '@/test/test-utils';
import GraphElementDetail from './GraphElementDetail';
import { GraphNode, GraphEdge } from './GraphVisualization';

const nodes: GraphNode[] = [
  { id: 1, label: 'Alpha', labels: ['Entity'], properties: { name: 'Alpha', mentionCount: 5 } },
  { id: 2, label: 'Beta', labels: ['Concept'], properties: { name: 'Beta' } },
  {
    id: 3,
    label: 'Chunk 3',
    labels: ['Chunk'],
    properties: { documentId: 'doc-1', content: 'chunk text', summary: 'a summary' },
  },
];

describe('GraphElementDetail', () => {
  it('renders node labels and properties', () => {
    renderWrapper(
      <GraphElementDetail kind='node' node={nodes[0]} graphNodes={nodes} />,
    );

    expect(screen.getByText('Node Details')).toBeInTheDocument();
    expect(screen.getByText('Entity')).toBeInTheDocument();
    // Property key is upper-cased via tt='uppercase' (CSS only) — DOM text stays 'name'/value.
    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('shows View Source for a Chunk node and calls onViewSource', () => {
    const onViewSource = jest.fn();
    renderWrapper(
      <GraphElementDetail
        kind='node'
        node={nodes[2]}
        graphNodes={nodes}
        onViewSource={onViewSource}
      />,
    );

    const button = screen.getByText('View Source');
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(onViewSource).toHaveBeenCalledTimes(1);
  });

  it('does not show View Source for a non-Chunk node', () => {
    renderWrapper(
      <GraphElementDetail
        kind='node'
        node={nodes[0]}
        graphNodes={nodes}
        onViewSource={jest.fn()}
      />,
    );

    expect(screen.queryByText('View Source')).not.toBeInTheDocument();
  });

  it('renders edge type and resolves from/to to node labels', () => {
    const edge: GraphEdge = {
      from: 1,
      to: 2,
      label: 'RELATES_TO',
      type: 'RELATES_TO',
      properties: { since: '2021' },
    };

    renderWrapper(
      <GraphElementDetail kind='edge' edge={edge} graphNodes={nodes} />,
    );

    expect(screen.getByText('Edge Details')).toBeInTheDocument();
    expect(screen.getByText('RELATES_TO')).toBeInTheDocument();
    // from/to resolved to node labels, not raw ids
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('since')).toBeInTheDocument();
    expect(screen.getByText('2021')).toBeInTheDocument();
  });

  it('falls back to the raw id when an edge endpoint is not in graphNodes', () => {
    const edge: GraphEdge = {
      from: 1,
      to: 99,
      label: 'RELATES_TO',
      type: 'RELATES_TO',
      properties: {},
    };

    renderWrapper(
      <GraphElementDetail kind='edge' edge={edge} graphNodes={nodes} />,
    );

    expect(screen.getByText('99')).toBeInTheDocument();
  });

  it('calls onCollapse when the collapse button is clicked', () => {
    const onCollapse = jest.fn();
    renderWrapper(
      <GraphElementDetail kind='node' node={nodes[0]} graphNodes={nodes} onCollapse={onCollapse} />,
    );

    fireEvent.click(screen.getByLabelText('Collapse details'));
    expect(onCollapse).toHaveBeenCalledTimes(1);
  });

  it('omits the collapse control when onCollapse is not provided', () => {
    renderWrapper(
      <GraphElementDetail kind='node' node={nodes[0]} graphNodes={nodes} />,
    );

    expect(screen.queryByLabelText('Collapse details')).not.toBeInTheDocument();
  });

  it('renders a Pin button when onTogglePin is provided and calls it on click', () => {
    const onTogglePin = jest.fn();
    renderWrapper(
      <GraphElementDetail kind='node' node={nodes[0]} graphNodes={nodes} onTogglePin={onTogglePin} />,
    );

    fireEvent.click(screen.getByLabelText('Pin details'));
    expect(onTogglePin).toHaveBeenCalledTimes(1);
  });

  it('shows the Unpin affordance when pinned', () => {
    renderWrapper(
      <GraphElementDetail kind='node' node={nodes[0]} graphNodes={nodes} pinned onTogglePin={jest.fn()} />,
    );

    expect(screen.getByLabelText('Unpin details')).toBeInTheDocument();
    expect(screen.queryByLabelText('Pin details')).not.toBeInTheDocument();
  });

  it('pins an edge the same way (the control is element-agnostic)', () => {
    const onTogglePin = jest.fn();
    const edge: GraphEdge = { from: 1, to: 2, label: 'RELATES_TO', type: 'RELATES_TO', properties: {} };
    renderWrapper(
      <GraphElementDetail kind='edge' edge={edge} graphNodes={nodes} onTogglePin={onTogglePin} />,
    );

    fireEvent.click(screen.getByLabelText('Pin details'));
    expect(onTogglePin).toHaveBeenCalledTimes(1);
  });

  it('omits the pin control when onTogglePin is not provided', () => {
    renderWrapper(
      <GraphElementDetail kind='node' node={nodes[0]} graphNodes={nodes} />,
    );

    expect(screen.queryByLabelText('Pin details')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Unpin details')).not.toBeInTheDocument();
  });

  it('renders a "Select" toggle when onToggleSelected is provided and calls it on click', () => {
    const onToggleSelected = jest.fn();
    renderWrapper(
      <GraphElementDetail kind='node' node={nodes[0]} graphNodes={nodes} onToggleSelected={onToggleSelected} />,
    );

    // Unselected → the action label is "Select".
    fireEvent.click(screen.getByRole('button', { name: 'Select' }));
    expect(onToggleSelected).toHaveBeenCalledTimes(1);
  });

  it('shows "Deselect" when already selected, and toggles an edge the same way (element-agnostic)', () => {
    const onToggleSelected = jest.fn();
    const edge: GraphEdge = { from: 1, to: 2, label: 'RELATES_TO', type: 'RELATES_TO', properties: {} };
    renderWrapper(
      <GraphElementDetail kind='edge' edge={edge} graphNodes={nodes} selected onToggleSelected={onToggleSelected} />,
    );

    // Selected → the action label flips to "Deselect".
    fireEvent.click(screen.getByRole('button', { name: 'Deselect' }));
    expect(onToggleSelected).toHaveBeenCalledTimes(1);
  });

  it('omits the Select/Deselect toggle when onToggleSelected is not provided', () => {
    renderWrapper(
      <GraphElementDetail kind='node' node={nodes[0]} graphNodes={nodes} />,
    );

    expect(screen.queryByRole('button', { name: 'Select' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Deselect' })).not.toBeInTheDocument();
  });

  it('renders the document chip when documentInfo is provided', () => {
    renderWrapper(
      <GraphElementDetail
        kind='node'
        node={nodes[2]}
        graphNodes={nodes}
        documentInfo={{ name: 'My Document', color: '#fff', borderColor: '#000' }}
      />,
    );

    expect(screen.getByText('My Document')).toBeInTheDocument();
  });
});
