"""Create thumbnail grids from PowerPoint presentation slides.

Labels each thumbnail with its XML filename. Used for template layout discovery.

Usage:
    python thumbnail.py input.pptx [output_prefix]

Examples:
    python thumbnail.py template.pptx template-layouts
    # Creates: template-layouts.jpg
"""

import argparse
import posixpath
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

import defusedxml.minidom
from defusedxml import ElementTree
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).parent))
from office.helpers import SLIDE_REL_TYPE, opc_target
from office.soffice import run_soffice

THUMBNAIL_WIDTH = 300
CONVERSION_DPI = 100
MAX_COLS = 6
DEFAULT_COLS = 3
JPEG_QUALITY = 95
GRID_PADDING = 20
BORDER_WIDTH = 2
FONT_SIZE_RATIO = 0.10
LABEL_PADDING_RATIO = 0.4


def main():
    parser = argparse.ArgumentParser(description='Create thumbnail grids from PowerPoint slides.')
    parser.add_argument('input', help='Input PowerPoint file (.pptx)')
    parser.add_argument(
        'output_prefix', nargs='?', default='thumbnails',
        help='Output prefix for image files (default: thumbnails)',
    )
    parser.add_argument('--cols', type=int, default=DEFAULT_COLS, help=f'Columns (default: {DEFAULT_COLS})')
    args = parser.parse_args()

    cols = min(args.cols, MAX_COLS)
    input_path = Path(args.input)

    if not input_path.exists() or input_path.suffix.lower() not in ('.pptx', '.potx'):
        print(f'Error: Invalid PowerPoint file: {args.input}', file=sys.stderr)
        sys.exit(1)

    output_path = Path(f'{args.output_prefix}.jpg')

    try:
        slide_info = get_slide_info(input_path)

        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            visible_images = convert_to_images(input_path, temp_path)

            if not visible_images and not slide_info:
                print('Error: No slides found', file=sys.stderr)
                sys.exit(1)

            slides = build_slide_list(slide_info, visible_images)
            grid_files = create_grids(slides, cols, THUMBNAIL_WIDTH, output_path)

            print(f'Created {len(grid_files)} grid(s):')
            for grid_file in grid_files:
                print(f'  {grid_file}')

    except Exception as e:
        print(f'Error: {e}', file=sys.stderr)
        sys.exit(1)


def get_slide_info(pptx_path: Path) -> list[dict]:
    with zipfile.ZipFile(pptx_path, 'r') as zf:
        rels_content = zf.read('ppt/_rels/presentation.xml.rels').decode('utf-8')
        rels_dom = defusedxml.minidom.parseString(rels_content)

        rid_to_part = {}
        for rel in rels_dom.getElementsByTagName('Relationship'):
            if rel.getAttribute('Type') != SLIDE_REL_TYPE:
                continue
            part = opc_target(
                rel.getAttribute('Target'),
                'ppt/presentation.xml',
                rel.getAttribute('TargetMode'),
            )
            if part is not None:
                rid_to_part[rel.getAttribute('Id')] = part

        pres_content = zf.read('ppt/presentation.xml').decode('utf-8')
        pres_dom = defusedxml.minidom.parseString(pres_content)

        present = set(zf.namelist())

        slides = []
        for sld_id in pres_dom.getElementsByTagName('p:sldId'):
            part = rid_to_part.get(sld_id.getAttribute('r:id'))
            if part is not None and part in present:
                hidden = _is_hidden(zf, part)
                slides.append({'name': posixpath.basename(part), 'hidden': hidden})

        return slides


def _is_hidden(zf: zipfile.ZipFile, part: str) -> bool:
    try:
        with zf.open(part) as f:
            for _, root in ElementTree.iterparse(f, events=('start',)):
                return root.get('show') in ('0', 'false')
    except (KeyError, ElementTree.ParseError):
        return False
    return False


def build_slide_list(slide_info: list[dict], visible_images: list[Path]) -> list[tuple[Path, str]]:
    slides = []
    visible_idx = 0
    for info in slide_info:
        if info['hidden']:
            continue
        if visible_idx < len(visible_images):
            slides.append((visible_images[visible_idx], info['name']))
            visible_idx += 1
    return slides


def convert_to_images(pptx_path: Path, temp_dir: Path) -> list[Path]:
    pdf_path = temp_dir / f'{pptx_path.stem}.pdf'

    result = run_soffice(
        ['--headless', '--convert-to', 'pdf', '--outdir', str(temp_dir), str(pptx_path)],
        capture_output=True, text=True,
    )
    if result.returncode != 0 or not pdf_path.exists():
        detail = (result.stderr or result.stdout or '').strip()
        raise RuntimeError(f'PDF conversion failed: {detail}' if detail else 'PDF conversion failed')

    result = subprocess.run(
        ['pdftoppm', '-jpeg', '-r', str(CONVERSION_DPI), str(pdf_path), str(temp_dir / 'slide')],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        raise RuntimeError('Image conversion failed')

    return sorted(temp_dir.glob('slide-*.jpg'))


def create_grids(
    slides: list[tuple[Path, str]], cols: int, width: int, output_path: Path,
) -> list[str]:
    max_per_grid = cols * (cols + 1)
    grid_files = []

    for chunk_idx, start_idx in enumerate(range(0, len(slides), max_per_grid)):
        end_idx = min(start_idx + max_per_grid, len(slides))
        chunk_slides = slides[start_idx:end_idx]
        grid = create_grid(chunk_slides, cols, width)

        if len(slides) <= max_per_grid:
            grid_filename = output_path
        else:
            stem = output_path.stem
            suffix = output_path.suffix
            grid_filename = output_path.parent / f'{stem}-{chunk_idx + 1}{suffix}'

        grid_filename.parent.mkdir(parents=True, exist_ok=True)
        grid.save(str(grid_filename), quality=JPEG_QUALITY)
        grid_files.append(str(grid_filename))

    return grid_files


def create_grid(slides: list[tuple[Path, str]], cols: int, width: int) -> Image.Image:
    font_size = int(width * FONT_SIZE_RATIO)
    label_padding = int(font_size * LABEL_PADDING_RATIO)

    with Image.open(slides[0][0]) as img:
        aspect = img.height / img.width
    height = int(width * aspect)

    rows = (len(slides) + cols - 1) // cols
    grid_w = cols * width + (cols + 1) * GRID_PADDING
    grid_h = rows * (height + font_size + label_padding * 2) + (rows + 1) * GRID_PADDING

    grid = Image.new('RGB', (grid_w, grid_h), 'white')
    draw = ImageDraw.Draw(grid)

    try:
        font = ImageFont.load_default(size=font_size)
    except Exception:
        font = ImageFont.load_default()

    for i, (img_path, slide_name) in enumerate(slides):
        row, col = i // cols, i % cols
        x = col * width + (col + 1) * GRID_PADDING
        y_base = row * (height + font_size + label_padding * 2) + (row + 1) * GRID_PADDING

        bbox = draw.textbbox((0, 0), slide_name, font=font)
        text_w = bbox[2] - bbox[0]
        draw.text(
            (x + (width - text_w) // 2, y_base + label_padding),
            slide_name, fill='black', font=font,
        )

        y_thumbnail = y_base + label_padding + font_size + label_padding

        with Image.open(img_path) as img:
            img.thumbnail((width, height), Image.Resampling.LANCZOS)
            w, h = img.size
            tx = x + (width - w) // 2
            ty = y_thumbnail + (height - h) // 2
            grid.paste(img, (tx, ty))

            if BORDER_WIDTH > 0:
                draw.rectangle(
                    [(tx - BORDER_WIDTH, ty - BORDER_WIDTH),
                     (tx + w + BORDER_WIDTH - 1, ty + h + BORDER_WIDTH - 1)],
                    outline='gray', width=BORDER_WIDTH,
                )

    return grid


if __name__ == '__main__':
    main()
