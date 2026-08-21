"""Merge adjacent identically-formatted runs in word/document.xml.

Word fragments paragraph text across many <w:r> elements (revision ids,
spell-check markers, editing history), which makes find-and-replace on
word/document.xml unreliable — the string you're looking for is split
across runs. This coalesces adjacent runs whose formatting (<w:rPr>) is
identical and strips proofErr markers.

Usage:
    python merge_runs.py <unpacked_dir>   # modify word/document.xml in place
"""

import sys
import xml.dom.minidom
from pathlib import Path

WORDML_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
XML_SPACE = ' \t\r\n'


def _is_element(node, local: str) -> bool:
    name = node.localName or node.tagName
    return name == local or name.endswith(f':{local}')


def _get_children(parent, local: str) -> list:
    return [
        c for c in parent.childNodes
        if c.nodeType == c.ELEMENT_NODE and _is_element(c, local)
    ]


def _next_element_sibling(node):
    s = node.nextSibling
    while s:
        if s.nodeType == s.ELEMENT_NODE:
            return s
        s = s.nextSibling
    return None


def _rpr_xml(run) -> str:
    rpr = next(iter(_get_children(run, 'rPr')), None)
    return rpr.toxml() if rpr is not None else ''


def _can_merge(r1, r2) -> bool:
    return _rpr_xml(r1) == _rpr_xml(r2)


def _merge_into(target, source):
    for child in list(source.childNodes):
        if child.nodeType == child.ELEMENT_NODE and _is_element(child, 'rPr'):
            continue
        target.appendChild(child)


def _consolidate_text(run):
    for tag in ('t', 'delText'):
        elems = _get_children(run, tag)
        for i in range(len(elems) - 1, 0, -1):
            prev, curr = elems[i - 1], elems[i]
            prev_text = ''.join(
                c.data for c in prev.childNodes
                if c.nodeType in (c.TEXT_NODE, c.CDATA_SECTION_NODE)
            )
            curr_text = ''.join(
                c.data for c in curr.childNodes
                if c.nodeType in (c.TEXT_NODE, c.CDATA_SECTION_NODE)
            )
            preserve = (
                prev.getAttribute('xml:space') == 'preserve'
                or curr.getAttribute('xml:space') == 'preserve'
            )
            if not preserve:
                prev_text = prev_text.strip(XML_SPACE)
                curr_text = curr_text.strip(XML_SPACE)
            merged = prev_text + curr_text
            for c in list(prev.childNodes):
                if c.nodeType in (c.TEXT_NODE, c.CDATA_SECTION_NODE):
                    prev.removeChild(c)
            prev.appendChild(run.ownerDocument.createTextNode(merged))
            if merged != merged.strip(XML_SPACE) or preserve:
                prev.setAttribute('xml:space', 'preserve')
            elif prev.hasAttribute('xml:space'):
                prev.removeAttribute('xml:space')
            run.removeChild(curr)


def _strip_rsid(run):
    for attr in list(run.attributes.values()):
        if 'rsid' in attr.name.lower():
            run.removeAttribute(attr.name)


def _remove_elements(root, local: str):
    def traverse(node):
        if node.nodeType == node.ELEMENT_NODE and _is_element(node, local):
            node.parentNode.removeChild(node)
            return
        for child in list(node.childNodes):
            traverse(child)
    traverse(root)


def _is_run(node) -> bool:
    if node.nodeType != node.ELEMENT_NODE:
        return False
    name = node.localName or node.tagName
    return name == 'r' or name.endswith(':r')


def _merge_in_container(container) -> int:
    count = 0
    child = container.firstChild
    while child:
        if _is_run(child):
            _strip_rsid(child)
            while True:
                nxt = _next_element_sibling(child)
                if nxt and _is_run(nxt) and _can_merge(child, nxt):
                    _merge_into(child, nxt)
                    container.removeChild(nxt)
                    count += 1
                else:
                    break
            _consolidate_text(child)
        child = child.nextSibling
    return count


def _all_elements(root) -> list:
    results = []
    def traverse(node):
        if node.nodeType == node.ELEMENT_NODE:
            results.append(node)
        for child in node.childNodes:
            traverse(child)
    traverse(root)
    return results


def merge_runs(unpacked_dir: str) -> str:
    doc_xml = Path(unpacked_dir) / 'word' / 'document.xml'
    if not doc_xml.exists():
        return f'Error: {doc_xml} not found'
    try:
        dom = xml.dom.minidom.parseString(doc_xml.read_bytes())
        root = dom.documentElement
        _remove_elements(root, 'proofErr')
        containers = {
            e.parentNode
            for e in _all_elements(root)
            if _is_run(e)
        }
        count = sum(_merge_in_container(c) for c in containers)
        doc_xml.write_bytes(dom.toxml(encoding='UTF-8'))
        return f'Merged {count} runs in {doc_xml}'
    except Exception as e:
        return f'Error: {e}'


if __name__ == '__main__':
    if len(sys.argv) != 2:
        print(f'Usage: python {sys.argv[0]} <unpacked_dir>', file=sys.stderr)
        sys.exit(1)
    result = merge_runs(sys.argv[1])
    print(result)
    if result.startswith('Error'):
        sys.exit(1)
