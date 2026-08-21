import { toHast } from 'mdast-util-to-hast';
import type { Root } from 'mdast';
import type { Element, Root as HastRoot, Text as HastText } from 'hast';

import { remarkGraphCitations } from './remarkGraphCitations';
import type { HandleMap } from './graphCitationHelpers';

// NOTE: react-markdown and `unified` are Jest-mocked in this repo, so the full plugin→render path
// cannot be exercised here. Instead we drive the transformer directly and convert the mutated mdast
// tree through the REAL `mdast-util-to-hast` (allow-listed in transformIgnorePatterns) — proving the
// custom node turns into a `<graphcitation handle="…">` hast element, which is exactly what
// react-markdown renders via its `components.graphcitation` entry at runtime.

const handleMap: HandleMap = {
  E1: 'node-1',
  E2: 'node-2',
  R1: { src: 'node-1', relType: 'AGENCY_FIT', tgt: 'node-2' },
  Q0: 0,
};

/** A root → paragraph → single text node, the shape remark produces for one line of prose. */
function paragraph(text: string): Root {
  return {
    type: 'root',
    children: [{ type: 'paragraph', children: [{ type: 'text', value: text }] }],
  };
}

/** Run the plugin's transformer over a tree in place, then return its hast conversion. */
function transform(tree: Root, map: HandleMap | null | undefined): HastRoot {
  const transformer = remarkGraphCitations(map)();
  transformer(tree);
  return toHast(tree) as HastRoot;
}

/** Collect every `graphcitation` element from a hast tree. */
function citationElements(node: HastRoot | Element): Element[] {
  const found: Element[] = [];
  const visit = (n: any): void => {
    if (n?.type === 'element' && n.tagName === 'graphcitation') {
      found.push(n);
    }
    if (Array.isArray(n?.children)) {
      n.children.forEach(visit);
    }
  };
  visit(node);
  return found;
}

/** Flatten all hast text into a single string. */
function textContent(node: HastRoot | Element): string {
  let out = '';
  const visit = (n: any): void => {
    if (n?.type === 'text') {
      out += (n as HastText).value;
    }
    if (Array.isArray(n?.children)) {
      n.children.forEach(visit);
    }
  };
  visit(node);
  return out;
}

describe('remarkGraphCitations', () => {
  it('turns a known [[E#]] marker into a <graphcitation> element carrying the handle', () => {
    const hast = transform(paragraph('Foo [[E1]] bar'), handleMap);
    const anchors = citationElements(hast);
    expect(anchors).toHaveLength(1);
    expect(anchors[0].tagName).toBe('graphcitation');
    expect(anchors[0].properties).toMatchObject({ handle: 'E1' });
    // The surrounding prose is preserved (the marker itself is replaced, not the words).
    expect(textContent(hast)).toContain('Foo');
    expect(textContent(hast)).toContain('bar');
    // The raw marker text never survives.
    expect(textContent(hast)).not.toContain('[[E1]]');
  });

  it('wraps the cited span text inside the <graphcitation> element (span variant)', () => {
    const hast = transform(paragraph('Foo [[E1:Acme Corp]] bar'), handleMap);
    const anchors = citationElements(hast);
    expect(anchors).toHaveLength(1);
    expect(anchors[0].properties).toMatchObject({ handle: 'E1' });
    // The cited text becomes a CHILD of the element (the link's visible text).
    expect(textContent(anchors[0])).toBe('Acme Corp');
    // The surrounding prose survives and the raw marker never does.
    expect(textContent(hast)).toContain('Foo');
    expect(textContent(hast)).toContain('bar');
    expect(textContent(hast)).not.toContain('[[');
    // The preceding space is kept for a span (the cited text flows as normal prose).
    expect(textContent(hast)).toContain('Foo Acme Corp');
  });

  it('emits a self-closing <graphcitation> (no child text) for a handle-only dot marker', () => {
    const hast = transform(paragraph('Foo [[E1]] bar'), handleMap);
    const anchors = citationElements(hast);
    expect(anchors).toHaveLength(1);
    expect(anchors[0].properties).toMatchObject({ handle: 'E1' });
    // No span → no child text on the element (react-markdown renders the dot).
    expect(textContent(anchors[0])).toBe('');
  });

  it('drops a span marker on an UNKNOWN handle entirely — no element, no raw span text', () => {
    const hast = transform(paragraph('A claim about [[E9:Mystery Co]] here.'), handleMap);
    expect(citationElements(hast)).toHaveLength(0);
    expect(textContent(hast)).not.toContain('[[');
    expect(textContent(hast)).not.toContain('Mystery Co');
    expect(textContent(hast)).toContain('A claim about');
    expect(textContent(hast)).toContain('here.');
  });

  it('turns a known [[R#]] marker into an anchor too', () => {
    const anchors = citationElements(transform(paragraph('Linked via [[R1]].'), handleMap));
    expect(anchors).toHaveLength(1);
    expect(anchors[0].properties).toMatchObject({ handle: 'R1' });
  });

  it('strips an unknown handle entirely — no anchor, no raw marker', () => {
    const hast = transform(paragraph('Mystery [[E9]] vanishes.'), handleMap);
    expect(citationElements(hast)).toHaveLength(0);
    expect(textContent(hast)).not.toContain('[[E9]]');
    expect(textContent(hast)).toContain('Mystery');
    expect(textContent(hast)).toContain('vanishes.');
  });

  it('strips a malformed range/list marker — no anchor, no raw text leak', () => {
    const hast = transform(paragraph('Through MENTIONS relationships [[R1-R20]] here.'), handleMap);
    expect(citationElements(hast)).toHaveLength(0);
    expect(textContent(hast)).not.toContain('[[');
    expect(textContent(hast)).not.toContain('R1-R20');
    expect(textContent(hast)).toContain('Through MENTIONS relationships');
    expect(textContent(hast)).toContain('here.');
  });

  it('handles multiple markers (known + unknown) in one paragraph', () => {
    const hast = transform(
      paragraph('Node [[E1]] links to [[E2]] but [[E7]] is gone.'),
      handleMap,
    );
    const anchors = citationElements(hast);
    expect(anchors.map((a) => a.properties?.handle)).toEqual(['E1', 'E2']);
    expect(textContent(hast)).not.toContain('[[');
  });

  it('leaves a paragraph with no markers untouched', () => {
    const hast = transform(paragraph('A plain answer.'), handleMap);
    expect(citationElements(hast)).toHaveLength(0);
    expect(textContent(hast)).toBe('A plain answer.');
  });

  it('strips every marker when the handle map is empty/nullish (graceful, no anchors)', () => {
    const hast = transform(paragraph('Old answer [[E1]] [[R1]].'), null);
    expect(citationElements(hast)).toHaveLength(0);
    expect(textContent(hast)).not.toContain('[[');
  });

  it('recurses into nested inline nodes (e.g. emphasis) to rewrite markers', () => {
    const tree: Root = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            { type: 'emphasis', children: [{ type: 'text', value: 'see [[E1]] here' }] },
          ],
        },
      ],
    };
    const hast = transform(tree, handleMap);
    expect(citationElements(hast)).toHaveLength(1);
  });
});
