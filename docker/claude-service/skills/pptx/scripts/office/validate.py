"""
Validate a .pptx file for structural correctness.

Checks:
- Valid ZIP archive
- Required parts exist ([Content_Types].xml, ppt/presentation.xml)
- All slides referenced in sldIdLst exist on disk
- All slide relationships resolve to existing parts
- No corrupt slide XML (parseable by defusedxml)

Usage:
    python validate.py <path.pptx> [--original <template.pptx>]
"""

import posixpath
import re
import sys
import tempfile
import zipfile
from pathlib import Path

import defusedxml.minidom
from defusedxml import ElementTree
from defusedxml.common import DefusedXmlException

sys.path.insert(0, str(Path(__file__).parent))
from helpers import SLIDE_REL_TYPE, opc_target, safe_extract


def validate_pptx(pptx_path: Path, original_path: Path | None = None) -> dict:
    """Validate a .pptx and return {valid: bool, errors: [...], warnings: [...], slide_count: int}."""
    errors = []
    warnings = []

    if not pptx_path.exists():
        return {'valid': False, 'errors': [f'File not found: {pptx_path}'], 'warnings': [], 'slide_count': 0}

    try:
        with zipfile.ZipFile(pptx_path, 'r') as zf:
            names = set(zf.namelist())
    except zipfile.BadZipFile as e:
        return {'valid': False, 'errors': [f'Not a valid ZIP: {e}'], 'warnings': [], 'slide_count': 0}

    if '[Content_Types].xml' not in names:
        errors.append('Missing [Content_Types].xml')

    if 'ppt/presentation.xml' not in names:
        errors.append('Missing ppt/presentation.xml')
        return {'valid': len(errors) == 0, 'errors': errors, 'warnings': warnings, 'slide_count': 0}

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        try:
            with zipfile.ZipFile(pptx_path, 'r') as zf:
                safe_extract(zf, tmp_path)
        except (ValueError, OSError) as e:
            errors.append(f'Extraction failed: {e}')
            return {'valid': False, 'errors': errors, 'warnings': warnings, 'slide_count': 0}

        pres_path = tmp_path / 'ppt' / 'presentation.xml'
        pres_rels_path = tmp_path / 'ppt' / '_rels' / 'presentation.xml.rels'

        try:
            pres_content = pres_path.read_text(encoding='utf-8')
        except Exception as e:
            errors.append(f'Cannot read presentation.xml: {e}')
            return {'valid': False, 'errors': errors, 'warnings': warnings, 'slide_count': 0}

        referenced_rids = re.findall(r'<p:sldId[^>]*r:id="([^"]+)"', pres_content)
        slide_count = len(referenced_rids)

        if slide_count == 0:
            errors.append('No slides in <p:sldIdLst>')

        if pres_rels_path.exists():
            try:
                rels_dom = defusedxml.minidom.parse(str(pres_rels_path))
            except (DefusedXmlException, Exception) as e:
                errors.append(f'Cannot parse presentation.xml.rels: {e}')
                return {'valid': False, 'errors': errors, 'warnings': warnings, 'slide_count': slide_count}

            rid_to_part = {}
            for rel in rels_dom.getElementsByTagName('Relationship'):
                if rel.getAttribute('Type') == SLIDE_REL_TYPE:
                    part = opc_target(
                        rel.getAttribute('Target'),
                        'ppt/presentation.xml',
                        rel.getAttribute('TargetMode'),
                    )
                    if part is not None:
                        rid_to_part[rel.getAttribute('Id')] = part

            for rid in referenced_rids:
                if rid not in rid_to_part:
                    errors.append(f'Slide rId "{rid}" not found in presentation.xml.rels')
                    continue
                part = rid_to_part[rid]
                slide_file = tmp_path / part
                if not slide_file.exists():
                    errors.append(f'Slide file missing: {part} (referenced by {rid})')
                else:
                    try:
                        ElementTree.parse(str(slide_file))
                    except (ElementTree.ParseError, DefusedXmlException) as e:
                        errors.append(f'Corrupt slide XML in {part}: {e}')
        else:
            errors.append('Missing ppt/_rels/presentation.xml.rels')

        slides_dir = tmp_path / 'ppt' / 'slides'
        if slides_dir.exists():
            for slide_file in sorted(slides_dir.glob('slide*.xml')):
                try:
                    ElementTree.parse(str(slide_file))
                except (ElementTree.ParseError, DefusedXmlException) as e:
                    slide_name = slide_file.name
                    err_msg = f'Corrupt slide XML: ppt/slides/{slide_name}: {e}'
                    if err_msg not in errors:
                        errors.append(err_msg)

    if original_path:
        warnings.append(f'Baseline comparison against {original_path.name} not yet implemented')

    return {
        'valid': len(errors) == 0,
        'errors': errors,
        'warnings': warnings,
        'slide_count': slide_count,
    }


def main():
    import argparse

    parser = argparse.ArgumentParser(description='Validate a .pptx file')
    parser.add_argument('path', help='Path to .pptx file')
    parser.add_argument('--original', default=None, help='Original template for baseline comparison')
    args = parser.parse_args()

    pptx_path = Path(args.path)
    original = Path(args.original) if args.original else None

    result = validate_pptx(pptx_path, original)

    if result['errors']:
        print(f'FAILED — {len(result["errors"])} error(s):')
        for err in result['errors']:
            print(f'  ✗ {err}')
    else:
        print(f'PASSED — {result["slide_count"]} slide(s), no structural errors')

    if result['warnings']:
        for w in result['warnings']:
            print(f'  ⚠ {w}')

    sys.exit(0 if result['valid'] else 1)


if __name__ == '__main__':
    main()
