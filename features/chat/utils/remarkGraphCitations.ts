import type { Root, Text } from 'mdast';

import type { HandleMap } from '@/features/chat/utils/graphCitationHelpers';

/**
 * remark transformer that turns the agent's inline graph-citation markers — `[[E#]]`, `[[R#]]`,
 * `[[Q#]]`, still present in the evidence entry's `citedText` — into interactive `graphcitation`
 * anchors, so the rendered answer can cross-highlight the cited node(s)/edge(s) on the graph canvas.
 *
 * Only markers the `handleMap` can resolve become anchors; unknown/garbled handles are STRIPPED
 * (mirrors the write-time `STRIP_RE` in graphCitationHelpers), never rendered raw and never
 * fabricated. The custom node uses the `data.hName`/`data.hProperties` convention so
 * `mdast-util-to-hast` emits a real `<graphcitation handle="…">` hast element that react-markdown
 * renders via the matching (lowercase) `components.graphcitation` entry — no raw HTML, no XSS surface.
 */

// Capturing form — drives the split. Group 1 is the handle; group 2 the OPTIONAL cited text span an
// entity handle may carry inline (`[[E4:Comprehensive Fleet Management]]`). Kept in lockstep with the
// write-time CITATION_RE in graphCitationHelpers.
const CITATION_RE = /\[\[(E\d+|R\d+|Q\d+)(?::([^\][]+))?\]\]/g;
// Lockstep with the write-time MALFORMED_CITATION_STRIP_RE: any `[[…]]` left in a text segment after
// the valid handles are split out is a malformed citation (a range `[[R1-R20]]` or list) — strip it
// so it never renders as raw text.
const MALFORMED_CITATION_STRIP_RE = /[ \t]?\[\[[^\][]*\]\]/g;

// Custom inline mdast node. mdast-util-to-hast turns a node carrying `data.hName` into a hast element
// of that tag with `data.hProperties` as attributes, and renders any `children` inside it. A span
// citation wraps the cited entity text as a child Text node (→ `<graphcitation>name</graphcitation>`);
// a handle-only citation has no children (→ a self-closing dot).
type GraphCitationNode = {
  type: 'graphCitation';
  children?: Text[];
  data: { hName: 'graphcitation'; hProperties: { handle: string } };
};

type CitationChild = Text | GraphCitationNode;
type ParentNode = { children?: CitationChild[] };

function makeText(value: string): Text {
  return { type: 'text', value };
}

function makeCitation(handle: string, span?: string): GraphCitationNode {
  const node: GraphCitationNode = {
    type: 'graphCitation',
    data: { hName: 'graphcitation', hProperties: { handle } },
  };
  if (span !== undefined) {
    node.children = [makeText(span)];
  }
  return node;
}

export function remarkGraphCitations(handleMap: HandleMap | null | undefined) {
  const map = handleMap ?? {};

  function splitTextNode(value: string): CitationChild[] {
    const out: CitationChild[] = [];
    const re = new RegExp(CITATION_RE.source, 'g');
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(value)) !== null) {
      const handle = match[1];
      const span = match[2]; // optional cited text — present => span link, absent => dot
      const known = map[handle] !== undefined;
      // A span link renders the cited entity text inline as prose, so keep the preceding space; a dot
      // (or a dropped/unknown marker) eats one trailing space/tab so the dot hugs the preceding word
      // like a superscript and a removed marker doesn't leave a double space.
      const renderAsLink = known && span !== undefined;
      const rawLead = value.slice(lastIndex, match.index).replace(MALFORMED_CITATION_STRIP_RE, '');
      const lead = renderAsLink ? rawLead : rawLead.replace(/[ \t]$/, '');
      if (lead) {
        out.push(makeText(lead));
      }
      if (known) {
        out.push(makeCitation(handle, span));
      }
      lastIndex = match.index + match[0].length;
    }
    const tail = value.slice(lastIndex).replace(MALFORMED_CITATION_STRIP_RE, '');
    if (tail) {
      out.push(makeText(tail));
    }
    return out;
  }

  function walk(node: ParentNode): void {
    if (!Array.isArray(node.children)) {
      return;
    }
    const next: CitationChild[] = [];
    for (const child of node.children) {
      if (child.type === 'text' && typeof child.value === 'string' && child.value.includes('[[')) {
        next.push(...splitTextNode(child.value));
      } else {
        walk(child as ParentNode);
        next.push(child);
      }
    }
    node.children = next;
  }

  // unified attaches each plugin by CALLING it (the processor as `this`); the returned function is
  // the transformer that receives the mdast tree. So bake the handle map into this closure, then
  // hand back the transformer.
  return function attacher() {
    return function transformer(tree: Root): void {
      walk(tree as unknown as ParentNode);
    };
  };
}
