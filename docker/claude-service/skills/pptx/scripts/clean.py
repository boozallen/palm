"""Remove unreferenced files from an unpacked PPTX directory.

Usage: python clean.py <unpacked_dir>

Removes:
- Orphaned slides (not in sldIdLst) and their relationships
- Orphaned .rels files for deleted resources
- Unreferenced media, embeddings, charts, diagrams
- Content-Type overrides for deleted files
"""

import posixpath
import re
import sys
from pathlib import Path

import defusedxml.minidom

sys.path.insert(0, str(Path(__file__).parent))
from office.helpers import SLIDE_REL_TYPE, opc_target, rels_source_part


def _slide_rids(pres_rels_path: Path, unpacked_dir: Path) -> dict[str, str]:
    source_part = rels_source_part(pres_rels_path, unpacked_dir)
    rels_dom = defusedxml.minidom.parse(str(pres_rels_path))

    rids: dict[str, str] = {}
    for rel in rels_dom.getElementsByTagName('Relationship'):
        if rel.getAttribute('Type') != SLIDE_REL_TYPE:
            continue
        part = opc_target(
            rel.getAttribute('Target'), source_part, rel.getAttribute('TargetMode')
        )
        if part is not None:
            rids[rel.getAttribute('Id')] = part
    return rids


def get_slides_in_sldidlst(unpacked_dir: Path) -> set[str]:
    pres_path = unpacked_dir / 'ppt' / 'presentation.xml'
    pres_rels_path = unpacked_dir / 'ppt' / '_rels' / 'presentation.xml.rels'

    if not pres_path.exists() or not pres_rels_path.exists():
        return set()

    rid_to_slide = _slide_rids(pres_rels_path, unpacked_dir)
    pres_content = pres_path.read_text(encoding='utf-8')
    referenced_rids = set(re.findall(r'<p:sldId[^>]*r:id="([^"]+)"', pres_content))

    return {
        posixpath.basename(rid_to_slide[rid])
        for rid in referenced_rids
        if rid in rid_to_slide
    }


def remove_orphaned_slides(unpacked_dir: Path) -> list[str]:
    slides_dir = unpacked_dir / 'ppt' / 'slides'
    slides_rels_dir = slides_dir / '_rels'
    pres_rels_path = unpacked_dir / 'ppt' / '_rels' / 'presentation.xml.rels'

    if not slides_dir.exists():
        return []

    referenced_slides = get_slides_in_sldidlst(unpacked_dir)
    on_disk = sorted(slides_dir.glob('slide*.xml'))

    if on_disk and not any(s.name in referenced_slides for s in on_disk):
        raise ValueError(
            f'None of the {len(on_disk)} slide(s) on disk match sldIdLst — refusing to delete all'
        )

    removed = []
    for slide_file in on_disk:
        if slide_file.name not in referenced_slides:
            rel_path = slide_file.relative_to(unpacked_dir)
            slide_file.unlink()
            removed.append(str(rel_path))

            rels_file = slides_rels_dir / f'{slide_file.name}.rels'
            if rels_file.exists():
                rels_file.unlink()
                removed.append(str(rels_file.relative_to(unpacked_dir)))

    if removed and pres_rels_path.exists():
        rels_dom = defusedxml.minidom.parse(str(pres_rels_path))
        source_part = rels_source_part(pres_rels_path, unpacked_dir)
        changed = False

        for rel in list(rels_dom.getElementsByTagName('Relationship')):
            if rel.getAttribute('Type') != SLIDE_REL_TYPE:
                continue
            part = opc_target(
                rel.getAttribute('Target'), source_part, rel.getAttribute('TargetMode')
            )
            if part is None:
                continue
            if posixpath.basename(part) not in referenced_slides:
                if rel.parentNode:
                    rel.parentNode.removeChild(rel)
                    changed = True

        if changed:
            with open(pres_rels_path, 'wb') as f:
                f.write(rels_dom.toxml(encoding='utf-8'))

    return removed


def get_referenced_files(unpacked_dir: Path) -> set:
    referenced = set()
    for rels_file in sorted(unpacked_dir.rglob('*.rels')):
        source_part = rels_source_part(rels_file, unpacked_dir)
        dom = defusedxml.minidom.parse(str(rels_file))
        for rel in dom.getElementsByTagName('Relationship'):
            part = opc_target(
                rel.getAttribute('Target'), source_part, rel.getAttribute('TargetMode')
            )
            if part is not None:
                referenced.add(Path(part))
    return referenced


def remove_orphaned_files(unpacked_dir: Path, referenced: set) -> list[str]:
    resource_dirs = ['media', 'embeddings', 'charts', 'diagrams', 'tags', 'drawings', 'ink']
    removed = []

    for dir_name in resource_dirs:
        dir_path = unpacked_dir / 'ppt' / dir_name
        if not dir_path.exists():
            continue
        for file_path in dir_path.glob('*'):
            if not file_path.is_file():
                continue
            rel_path = file_path.relative_to(unpacked_dir)
            if rel_path not in referenced:
                file_path.unlink()
                removed.append(str(rel_path))

    return removed


def update_content_types(unpacked_dir: Path, removed_files: list[str]) -> None:
    ct_path = unpacked_dir / '[Content_Types].xml'
    if not ct_path.exists():
        return

    dom = defusedxml.minidom.parse(str(ct_path))
    changed = False

    for override in list(dom.getElementsByTagName('Override')):
        part_name = override.getAttribute('PartName').lstrip('/')
        if part_name in removed_files:
            if override.parentNode:
                override.parentNode.removeChild(override)
                changed = True

    if changed:
        with open(ct_path, 'wb') as f:
            f.write(dom.toxml(encoding='utf-8'))


def clean_unused_files(unpacked_dir: Path) -> list[str]:
    all_removed = []

    slides_removed = remove_orphaned_slides(unpacked_dir)
    all_removed.extend(slides_removed)

    while True:
        referenced = get_referenced_files(unpacked_dir)
        removed_files = remove_orphaned_files(unpacked_dir, referenced)
        if not removed_files:
            break
        all_removed.extend(removed_files)

    if all_removed:
        update_content_types(unpacked_dir, all_removed)

    return all_removed


if __name__ == '__main__':
    if len(sys.argv) != 2:
        print('Usage: python clean.py <unpacked_dir>', file=sys.stderr)
        sys.exit(1)

    unpacked_dir = Path(sys.argv[1])
    if not unpacked_dir.exists():
        print(f'Error: {unpacked_dir} not found', file=sys.stderr)
        sys.exit(1)

    try:
        removed = clean_unused_files(unpacked_dir)
    except ValueError as e:
        print(f'Error: {e}', file=sys.stderr)
        sys.exit(1)

    if removed:
        print(f'Removed {len(removed)} unreferenced files:')
        for f in removed:
            print(f'  {f}')
    else:
        print('No unreferenced files found')
