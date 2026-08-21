"""
Slide factory — all visual decisions are here. Agent provides text only.
"""

import base64
import io
import os

import httpx
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.oxml.ns import qn
from lxml import etree

# ── Template brand colors ─────────────────────────────────────────────────────────
TEAL     = RGBColor(0x23, 0xD2, 0xD7)
FUCHSIA  = RGBColor(0xE5, 0x5E, 0xD6)
GREEN    = RGBColor(0xBA, 0xD6, 0x3A)
DTEAL    = RGBColor(0x00, 0x83, 0x8F)
MTEAL    = RGBColor(0x00, 0xA5, 0xB5)
BLACK    = RGBColor(0x00, 0x00, 0x00)
DGRAY    = RGBColor(0x46, 0x46, 0x46)
LGRAY    = RGBColor(0xE8, 0xE8, 0xE8)
WHITE    = RGBColor(0xFF, 0xFF, 0xFF)
DPURPLE  = RGBColor(0x6B, 0x21, 0xA8)
DARK_BG  = RGBColor(0x0d, 0x11, 0x17)   # brand-tokens --dark-bg

# ── Palettes ──────────────────────────────────────────────────────────────────

_TEMPLATE_PAL = {
    'accent':        TEAL,
    'accent2':       FUCHSIA,
    'accent3':       GREEN,
    'card1':         DTEAL,
    'card2':         DARK_BG,
    'card3':         DTEAL,
    'hacc':          [TEAL, FUCHSIA, GREEN],
    'dark_bg1':      '00838F',
    'dark_bg2':      '0d1117',
    'body_on_dark':  LGRAY,
    'section_label': DGRAY,
    'stat_circle':   DTEAL,
    'quote_box':     RGBColor(0x0d, 0x11, 0x17),
    'quote_border':  TEAL,
    'process_card':  DTEAL,
    'font':          'Inter',
}

_c = lambda h: RGBColor(int(h[0:2],16), int(h[2:4],16), int(h[4:6],16))

# Unbranded palette — corporate-minimal: navy header, electric blue accent, white cards
_PLAIN_PAL = {
    'accent':        _c('2563EB'),
    'accent2':       _c('059669'),
    'accent3':       _c('1D4ED8'),
    'card1':         _c('1E293B'),   # dark navy — header bar + dark impact slides
    'card2':         _c('0F172A'),
    'card3':         _c('1E293B'),
    'hacc':          [_c('2563EB'), _c('059669'), _c('1D4ED8')],
    'dark_bg1':      '1E293B',
    'dark_bg2':      '0F172A',
    'body_on_dark':  _c('E2E8F0'),
    'section_label': _c('64748B'),   # muted gray — breadcrumb on white background
    'stat_circle':   _c('1E293B'),
    'quote_box':     _c('0F172A'),
    'quote_border':  _c('2563EB'),
    'process_card':  _c('1E293B'),
    'font':          'Inter',
}


def _pal(prs):
    return _TEMPLATE_PAL if _is_artifact_template_set(prs) else _PLAIN_PAL

DARK = BLACK
FONT = 'Inter'

# Template logo block in master: [0,0,0.832,0.708] — header bar must start at or below 0.71"
_HEADER_Y     = 0.71   # top of colored header bar
_HEADER_H     = 0.92   # height of header bar
_TITLE_Y      = 0.75   # title text y (inside header bar)
_CONTENT_TOP  = 1.72   # where content starts
_CONTENT_H    = 5.0    # max card height — footer lives at 6.951", so 1.72+5.0=6.72 clears it

_ASSETS = os.path.join(os.path.dirname(__file__), 'assets')
_ICONS  = os.path.join(_ASSETS, 'icons')

ICONS = {
    'ai':            'icon_ai.png',
    'analytics':     'icon_analytics.png',
    'calendar':      'icon_calendar.png',
    'collaboration': 'icon_collaboration.png',
    'innovation':    'icon_innovation.png',
    'intelligence':  'icon_intelligence.png',
    'leadership':    'icon_leadership.png',
    'organization':  'icon_organization.png',
    'performance':   'icon_performance.png',
    'process':       'icon_process.png',
    'progress':      'icon_progress.png',
    'quality':       'icon_quality.png',
}


# ── Primitives ────────────────────────────────────────────────────────────────

def _remove_placeholders(slide):
    spTree = slide.shapes._spTree
    for ph in list(slide.placeholders):
        sp = ph._element
        if sp in spTree:
            spTree.remove(sp)


def _white_bg(slide):
    slide.background.fill.solid()
    slide.background.fill.fore_color.rgb = WHITE


def _dark_bg(slide):
    slide.background.fill.solid()
    slide.background.fill.fore_color.rgb = BLACK




def _set_fill(shape, color):
    if color is None:
        shape.fill.background()
    else:
        shape.fill.solid()
        shape.fill.fore_color.rgb = color


def _set_line(shape, color, line_w_pt=0):
    if color is None:
        shape.line.fill.background()
    else:
        shape.line.color.rgb = color
        if line_w_pt:
            shape.line.width = Pt(line_w_pt)


def _rect(slide, l, t, w, h, color, send_back=False):
    shape = slide.shapes.add_shape(1, Inches(l), Inches(t), Inches(w), Inches(h))
    _set_fill(shape, color)
    shape.line.fill.background()
    if send_back:
        spTree = slide.shapes._spTree
        sp_el = shape._element
        spTree.remove(sp_el)
        spTree.insert(2, sp_el)
    return shape


def _rrect(slide, l, t, w, h, color, line_color=None, line_w_pt=0):
    shape = slide.shapes.add_shape(5, Inches(l), Inches(t), Inches(w), Inches(h))
    _set_fill(shape, color)
    _set_line(shape, line_color, line_w_pt)
    return shape


def _circle(slide, cx, cy, d, color, line_color=None, line_w_pt=2.0):
    shape = slide.shapes.add_shape(9, Inches(cx - d/2), Inches(cy - d/2), Inches(d), Inches(d))
    _set_fill(shape, color)
    _set_line(shape, line_color, line_w_pt)
    return shape


def _gradient_rect(slide, l, t, w, h, hex1, hex2, angle=5400000):
    shape = slide.shapes.add_shape(
        1, Inches(l), Inches(t), Inches(w), Inches(h))
    shape.line.fill.background()
    spPr = shape._element.find(qn('p:spPr'))
    for old in spPr.findall(qn('a:solidFill')) + spPr.findall(qn('a:gradFill')):
        spPr.remove(old)
    xml = (
        f'<a:gradFill xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" rotWithShape="1">'
        f'<a:gsLst>'
        f'<a:gs pos="0"><a:srgbClr val="{hex1}"/></a:gs>'
        f'<a:gs pos="100000"><a:srgbClr val="{hex2}"/></a:gs>'
        f'</a:gsLst>'
        f'<a:lin ang="{angle}" scaled="0"/>'
        f'</a:gradFill>'
    )
    spPr.append(etree.fromstring(xml))
    return shape


def _tb(slide, l, t, w, h, text, size, color,
        bold=False, italic=False, align=PP_ALIGN.LEFT):
    box = slide.shapes.add_textbox(
        Inches(l), Inches(t), Inches(w), Inches(h))
    tf = box.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.alignment = align
    run = p.add_run()
    run.text = text
    run.font.name = FONT
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.italic = italic
    run.font.color.rgb = color
    return box


def _bullets_tb(slide, l, t, w, h, bullets, size, color, bullet_char='›', space_before_pt=6):
    box = slide.shapes.add_textbox(
        Inches(l), Inches(t), Inches(w), Inches(h))
    tf = box.text_frame
    tf.word_wrap = True
    # Shrink text to fit if content overflows the fixed-height box
    bodyPr = tf._txBody.find(qn('a:bodyPr'))
    if bodyPr is not None:
        for child in list(bodyPr):
            if child.tag in (qn('a:noAutofit'), qn('a:spAutoFit'), qn('a:normAutofit')):
                bodyPr.remove(child)
        etree.SubElement(bodyPr, qn('a:normAutofit'))
    for i, b in enumerate(bullets):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = PP_ALIGN.LEFT
        # Add space before each bullet (except first)
        if i > 0 and space_before_pt > 0:
            pPr = p._p.get_or_add_pPr()
            spcBef = etree.SubElement(pPr, qn('a:spcBef'))
            spcPts = etree.SubElement(spcBef, qn('a:spcPts'))
            spcPts.set('val', str(int(space_before_pt * 100)))
        run = p.add_run()
        run.text = (f'{bullet_char}  {b}') if bullet_char else b
        run.font.name = FONT
        run.font.size = Pt(size)
        run.font.color.rgb = color
    return box


def _chrome(slide, section, accent=TEAL, prs=None):
    _white_bg(slide)
    _remove_placeholders(slide)
    if prs is None or _is_artifact_template_set(prs):
        # Template-branded: breadcrumb + teal gradient header bar
        _tb(slide, 0.85, 0.20, 12.0, 0.35, section.upper(), 10, DGRAY, bold=True)
        _gradient_rect(slide, 0, _HEADER_Y, 13.33, _HEADER_H, '00838F', '0d1117', angle=5400000)
        _rect(slide, 0, _HEADER_Y + _HEADER_H, 13.33, 0.04, accent)
    else:
        # Plain: white bg, solid navy header bar, accent underline, gray section label
        p = _pal(prs)
        _rect(slide, 0, _HEADER_Y, 13.33, _HEADER_H, p['card1'])
        _rect(slide, 0, _HEADER_Y + _HEADER_H, 13.33, 0.05, p['accent'])
        _tb(slide, 0.5, 0.20, 12.0, 0.35, section.upper(), 9, p['section_label'], bold=True)


def _card_text(slide, l, t, w, h, heading, bullets,
               heading_color=WHITE, body_color=LGRAY,
               heading_size=17, body_size=13, icon_space=0.0):
    """Write heading + bullets into a box (call after drawing the card shape).
    icon_space: extra vertical offset at top when an icon is present."""
    body_top = t + 0.20 + icon_space
    if heading:
        _tb(slide, l + 0.22, t + 0.18 + icon_space, w - 0.44, 0.56,
            heading, heading_size, heading_color, bold=True)
        acc = heading_color if heading_color not in (WHITE, LGRAY) else TEAL
        _rect(slide, l + 0.22, t + 0.78 + icon_space, w - 0.44, 0.04, acc)
        body_top = t + 0.90 + icon_space
    if bullets:
        remaining = h - (body_top - t) - 0.12
        _bullets_tb(slide, l + 0.22, body_top, w - 0.44, remaining,
                    bullets, body_size, body_color)


def _dark_card(slide, l, t, w, h, heading, bullets,
               bg=DTEAL, heading_color=WHITE, body_color=LGRAY,
               heading_size=17, body_size=13, icon_space=0.0):
    _rrect(slide, l, t, w, h, bg)
    _card_text(slide, l, t, w, h, heading, bullets, heading_color, body_color,
               heading_size=heading_size, body_size=body_size, icon_space=icon_space)


def _white_card(slide, l, t, w, h, heading, bullets, accent=TEAL):
    _rrect(slide, l, t, w, h, WHITE, line_color=LGRAY, line_w_pt=1.0)
    _rect(slide, l, t, w, 0.08, accent)
    _card_text(slide, l, t, w, h, heading, bullets,
               heading_color=BLACK, body_color=DGRAY,
               heading_size=17, body_size=13)


# ── Assigned-template helpers ──────────────────────────────────────────────────────

def _layout_ph_geometry(slide, ph_idx):
    """Return (left, top, width, height) for a placeholder by reading the layout,
    since assigned-template content slide placeholders inherit position from the layout, not the slide sp."""
    for lph in slide.slide_layout.placeholders:
        if lph.placeholder_format.idx == ph_idx:
            return lph.left, lph.top, lph.width, lph.height
    # fallback to master
    for mph in slide.slide_layout.slide_master.placeholders:
        if mph.placeholder_format.idx == ph_idx:
            return mph.left, mph.top, mph.width, mph.height
    return None, None, None, None


def _get_layout(prs, master_idx, layout_name):
    """Return the named layout from the given master index."""
    master = prs.slide_masters[master_idx]
    for layout in master.slide_layouts:
        if layout.name == layout_name:
            return layout
    raise ValueError(f'Layout {layout_name!r} not found in master {master_idx}')


def _no_autofit(tf):
    """Turn off PowerPoint's auto-shrink on a text frame so font size is respected."""
    from pptx.oxml.ns import qn
    bodyPr = tf._txBody.find(qn('a:bodyPr'))
    if bodyPr is not None:
        bodyPr.attrib.pop('autofit', None)
        for child in list(bodyPr):
            if child.tag in (qn('a:normAutofit'), qn('a:spAutoFit')):
                bodyPr.remove(child)
        no_fit = etree.SubElement(bodyPr, qn('a:noAutofit'))  # noqa: F841


def _fill_ph(slide, idx, text):
    """Fill a single placeholder (by idx) with plain text. No-op if not present."""
    try:
        ph = slide.placeholders[idx]
    except KeyError:
        return
    tf = ph.text_frame
    _no_autofit(tf)
    tf.clear()
    if text:
        p = tf.paragraphs[0]
        run = p.add_run()
        run.text = text


def _fill_ph_lines(slide, idx, lines):
    """Fill a placeholder (by idx) with multiple paragraphs, one per line."""
    try:
        ph = slide.placeholders[idx]
    except KeyError:
        return
    tf = ph.text_frame
    _no_autofit(tf)
    tf.clear()
    for i, line in enumerate(lines):
        para = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        run = para.add_run()
        run.text = str(line)


def _remove_picture_placeholders(slide):
    """Remove any picture-type placeholders so 'Insert Picture' prompts never show."""
    from pptx.enum.shapes import PP_PLACEHOLDER
    spTree = slide.shapes._spTree
    for ph in list(slide.placeholders):
        if ph.placeholder_format.type == PP_PLACEHOLDER.PICTURE:
            sp = ph._element
            if sp in spTree:
                spTree.remove(sp)


# ── HTML preview generation ───────────────────────────────────────────────────

import html as _html_mod
# ── Public API ────────────────────────────────────────────────────────────────

def script_from_slide_json(setup_code: str, slides: list, output_path: str) -> str:
    """Reconstruct an executable Python script from a slide JSON list.

    Handles three formats:
    - Plain factory:  [{"fn": "title_slide", "args": {...}}, ...]
    - Template phs (legacy): [{"layout": "...", "phs": {"0": "...", "14": [...]}}, ...]
    - Template pattern:  [{"layout": "Content - Blank", "title": "...", "pattern": "two-panel", ...}, ...]
                        or [{"layout": "Title Slide - Texture 1", "phs": {...}}, ...]
    For template pattern slides the LLM re-executes its own drawing code, so we emit a comment
    with the slide JSON and a note to regenerate — the edit flow asks the LLM to rewrite
    only the changed slide's drawing code from the pattern description.
    """
    import json as _json
    lines = [setup_code.rstrip()]
    for i, slide in enumerate(slides):
        if 'fn' in slide:
            # Plain factory function
            fn = slide.get('fn', '')
            args = slide.get('args', {})
            arg_str = ', '.join(f'{k}={_json.dumps(v)}' for k, v in args.items())
            lines.append(f'{fn}(prs, {arg_str})')
        elif 'layout' in slide:
            layout_name = slide['layout']
            if 'phs' in slide and 'pattern' not in slide:
                # Template phs format (Title Slide, Divider, or legacy content)
                lines.append(f's{i} = prs.slides.add_slide(_layout({_json.dumps(layout_name)}))')
                phs = slide.get('phs', {})
                for idx_str, value in phs.items():
                    if isinstance(value, list):
                        lines.append(f'_bullets(s{i}, {idx_str}, {_json.dumps(value)})')
                    else:
                        lines.append(f'_text(s{i}, {idx_str}, {_json.dumps(str(value))})')
            elif 'code' in slide:
                # Verbatim python block
                lines.append(f's{i} = prs.slides.add_slide(_layout({_json.dumps(layout_name)}))')
                lines.append(slide['code'])
            else:
                # Template pattern format — emit a comment so the LLM knows what to draw
                lines.append(f'# SLIDE {i}: {_json.dumps(slide)}')
                lines.append(f's{i} = prs.slides.add_slide(_layout({_json.dumps(layout_name)}))')
                title_text = slide.get('title', '')
                breadcrumb = slide.get('breadcrumb', '')
                if title_text:
                    lines.append(f'title(s{i}, {_json.dumps(title_text)})')
                if breadcrumb:
                    lines.append(f'tb(s{i}, 1.0, 0.38, 6.0, 0.28, {_json.dumps(breadcrumb)}, 8, TEAL, bold=True)')
                lines.append(f'# TODO: draw pattern {_json.dumps(slide.get("pattern",""))} content here')
    lines.append(f'prs.save({_json.dumps(output_path)})')
    lines.append(f'print("DONE: {output_path}")')
    return '\n'.join(lines)


def _normalise_potx(source) -> io.BytesIO:
    """Patch [Content_Types].xml so python-pptx accepts .potx files."""
    import zipfile
    buf = io.BytesIO(source.read() if hasattr(source, 'read') else source)
    with zipfile.ZipFile(buf, 'r') as zin:
        names = zin.namelist()
        files = {n: zin.read(n) for n in names}
    ct = files.get('[Content_Types].xml', b'')
    patched = ct.replace(
        b'presentationml.template.main+xml',
        b'presentationml.presentation.main+xml',
    )
    if patched == ct:
        buf.seek(0)
        return buf
    files['[Content_Types].xml'] = patched
    out = io.BytesIO()
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as zout:
        for name in names:
            zout.writestr(name, files[name])
    out.seek(0)
    return out


def _load_template_from_source(path):
    if isinstance(path, io.BytesIO):
        path = _normalise_potx(path)
    prs = Presentation(path)
    prs._artifact_template_set = True
    # Remove any sample slides baked into the template file
    ns = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
    xml_slides = prs.slides._sldIdLst
    for sldId in list(xml_slides):
        rId = sldId.get(f'{{{ns}}}id')
        xml_slides.remove(sldId)
        if rId:
            prs.part.drop_rel(rId)
    return prs


def load_plain_template(style='corporate-minimal'):
    """Return a blank 16:9 presentation with no branding."""
    prs = Presentation()
    prs.slide_width  = Inches(13.33)
    prs.slide_height = Inches(7.5)
    prs._artifact_template_set = False
    prs._style = style
    return prs


def load_group_template(user_id: str, base_url: str, api_key: str):
    """Fetch the user's group-assigned pptx template from the Next.js API.
    Falls back to load_plain_template() when no template is assigned."""
    import sys
    _log_path = '/tmp/slide_factory_debug.log'
    def _dbg(msg):
        with open(_log_path, 'a') as f:
            f.write(msg + '\n')
        print(msg, file=sys.stderr, flush=True)
    try:
        _dbg(f'[SLIDE-FACTORY] load_group_template user_id={user_id!r}')
        resp = httpx.post(
            f'{base_url}/v1/templates/resolve',
            headers={'Authorization': f'Bearer {api_key}'},
            json={'userId': user_id, 'fileExtension': 'pptx'},
            timeout=10,
        )
        _dbg(f'[SLIDE-FACTORY] resolve status={resp.status_code} body={resp.text[:200]}')
        if resp.status_code == 404:
            _dbg('[SLIDE-FACTORY] no template assigned, using plain')
            return load_plain_template()
        resp.raise_for_status()
        file_bytes = base64.b64decode(resp.json()['fileData'])
        _dbg(f'[SLIDE-FACTORY] loaded group template bytes={len(file_bytes)}')
        return _load_template_from_source(io.BytesIO(file_bytes))
    except Exception as exc:
        _dbg(f'[SLIDE-FACTORY] load_group_template failed ({exc}), using plain')
        return load_plain_template()


def _is_artifact_template_set(prs):
    return getattr(prs, '_artifact_template_set', False)


def _blank_slide(prs, content=False):
    """Add a blank slide.
    content=True: use master 1 on the assigned template (carries logo + footer).
    Otherwise use master 0 (title master or plain template master).
    """
    # Assigned template has 5 masters; master 1 has the logo/footer for content slides.
    if content and len(prs.slide_masters) > 1:
        master = prs.slide_masters[1]
    else:
        master = prs.slide_masters[0]
    blank_layout = None
    for layout in master.slide_layouts:
        name = layout.name.lower()
        if name in ('blank', 'blank slide') or name.endswith('blank'):
            blank_layout = layout
            break
    return prs.slides.add_slide(blank_layout or master.slide_layouts[0])


def title_slide(prs, title, subtitle='', tagline=''):
    """Cover — always first slide."""
    if _is_artifact_template_set(prs):
        layout = _get_layout(prs, 0, 'Title Slide - Texture 1')
        slide = prs.slides.add_slide(layout)
        _fill_ph(slide, 0, title)
        _fill_ph(slide, 1, subtitle)
        _fill_ph(slide, 11, tagline)
        return slide

    # no-template: original shape-drawing path
    slide = _blank_slide(prs)
    _remove_placeholders(slide)
    p = _pal(prs)
    _rect(slide, -0.01, 0, 6.7, 7.52, p['card1'], send_back=True)
    _gradient_rect(slide, 6.7, 0, 6.63, 7.52,
                   p['dark_bg1'], p['dark_bg2'], angle=0)
    _rect(slide, 0, 3.65, 13.33, 0.06, p['accent'])
    title_color, sub_color, tag_color = WHITE, p['body_on_dark'], p['accent']
    title_x, title_y, title_w = 0.55, 1.5, 5.7
    _tb(slide, title_x, title_y, title_w, 2.0, title, 40, title_color, bold=True)
    if subtitle:
        _tb(slide, title_x, title_y + 2.1, title_w, 0.8, subtitle, 20, sub_color)
    if tagline:
        _tb(slide, title_x, 6.70, title_w, 0.5, tagline, 13, tag_color)
    return slide


def divider_slide(prs, title, subtitle=''):
    """Section break — renders as a bold section transition, not a title slide."""
    if _is_artifact_template_set(prs):
        layout = _get_layout(prs, 1, 'Content - Blank')
        slide = prs.slides.add_slide(layout)
        _tb(slide, 1.0, 1.85, 11.33, 1.8, title, 40, BLACK, bold=True)
        if subtitle:
            _template_hline(slide, 1.0, 3.75, 4.0, color=TEAL, w_pt=1.5)
            _tb(slide, 1.0, 3.95, 9.0, 0.8, subtitle, 16, DGRAY, italic=True)
        return slide

    # no-template: original shape-drawing path
    p = _pal(prs)
    slide = _blank_slide(prs)
    _remove_placeholders(slide)
    _dark_bg(slide)
    _gradient_rect(slide, 0, 0, 13.33, 7.52, p['dark_bg1'], p['dark_bg2'], angle=5400000)
    _rect(slide, 0, 0, 13.33, 0.08, p['accent'])
    _circle(slide, 10.5, 3.75, 5.0, None, line_color=p['card1'], line_w_pt=2.0)
    _circle(slide, 10.5, 3.75, 3.5, None, line_color=p['accent'], line_w_pt=1.0)
    _tb(slide, 1.0, 2.2, 8.5, 2.2, title.upper(), 48, WHITE, bold=True)
    if subtitle:
        _rect(slide, 1.0, 4.55, 2.0, 0.06, p['accent'])
        _tb(slide, 1.0, 4.75, 8.5, 0.7, subtitle, 22, p['accent'])
    return slide


def agenda_slide(prs, section, title, items, summary=''):
    """Agenda slide — up to 4 numbered agenda items.
    items: list of up to 4 strings. summary: optional left-panel text.
    Template only: uses Summary - Agenda layout with numbered items 01-04."""
    if _is_artifact_template_set(prs):
        layout = _get_layout(prs, 2, 'Summary - Agenda')
        slide = prs.slides.add_slide(layout)
        _fill_ph(slide, 13, section.upper())
        _fill_ph(slide, 0, title)
        if summary:
            _fill_ph(slide, 14, summary)
        item_ph_map = [(1, 17), (15, 18), (16, 19), (20, 21)]
        for i, item in enumerate(items[:4]):
            text_idx, _num_idx = item_ph_map[i]
            _fill_ph(slide, text_idx, item)
        return slide

    # no-template: fall back to bullets_slide style
    return bullets_slide(prs, section, title, items)


def exec_summary_slide(prs, section, title, stats, milestones):
    """Executive summary with key stats and milestones.
    stats: list of up to 4 dicts {value, description}.
    milestones: list of strings for the milestones column.
    Template only: uses Summary - Exec layout."""
    if _is_artifact_template_set(prs):
        layout = _get_layout(prs, 2, 'Summary - Exec')
        slide = prs.slides.add_slide(layout)
        _fill_ph(slide, 14, section.upper())
        _fill_ph(slide, 0, title)
        # Fill header labels to suppress dashed hint boxes
        _fill_ph(slide, 15, 'Key Facts')
        _fill_ph(slide, 16, 'Key Milestones')
        stat_map = [(17, 18), (19, 20), (21, 22), (23, 24)]
        for i, stat in enumerate(stats[:4]):
            val_idx, desc_idx = stat_map[i]
            _fill_ph(slide, val_idx, stat.get('value', ''))
            _fill_ph(slide, desc_idx, stat.get('description', ''))
        _fill_ph_lines(slide, 12, milestones)
        return slide

    # no-template: fall back to bullets_slide
    lines = [f"{s['value']} — {s['description']}" for s in stats] + milestones
    return bullets_slide(prs, section, title, lines)


def _template_content_slide(prs, layout_name, master_idx=1):
    """Add a template content slide and return it — logo/footer come from the master."""
    layout = _get_layout(prs, master_idx, layout_name)
    return prs.slides.add_slide(layout)


def _template_hline(slide, x, y, length, color=DTEAL, w_pt=0.75):
    """Draw a thin horizontal accent line — template brand visual divider."""
    from pptx.util import Emu
    conn = slide.shapes.add_connector(1, Inches(x), Inches(y), Inches(x + length), Inches(y))
    conn.line.color.rgb = color
    conn.line.width = Pt(w_pt)


def _template_vline(slide, x, y, length, color=LGRAY, w_pt=0.75):
    """Draw a thin vertical line — template brand column divider."""
    conn = slide.shapes.add_connector(1, Inches(x), Inches(y), Inches(x), Inches(y + length))
    conn.line.color.rgb = color
    conn.line.width = Pt(w_pt)


def _template_intro(slide, text, y=1.79, x=1.0, w=11.5):
    """14pt italic intro paragraph — template brand standard below title."""
    _tb(slide, x, y, w, 0.75, text, 14, BLACK, italic=True)


def _template_section_header(slide, text, x, y, w=5.0):
    """10pt bold section header — labels a content column."""
    _tb(slide, x, y, w, 0.28, text.upper(), 10, BLACK, bold=True)


def _template_body_text(slide, bullets, x, y, w, h, size=11):
    """Body bullet list at 11pt — template brand body style."""
    _bullets_tb(slide, x, y, w, h, bullets, size, DGRAY, bullet_char='›', space_before_pt=5)


def _template_teal_bar(slide, x, y, w=11.5):
    """Thin teal accent line under the title."""
    _template_hline(slide, x, y, w, color=TEAL, w_pt=1.5)


def bullets_slide(prs, section, title, bullets, accent=None):
    """Single-column bulleted list. bullets: 4–7 strings."""
    if _is_artifact_template_set(prs):
        layout = _get_layout(prs, 1, 'Content - One Column')
        slide = prs.slides.add_slide(layout)
        _fill_ph(slide, 13, section.upper())
        _fill_ph(slide, 0, title)
        _fill_ph(slide, 14, ' ')
        _template_teal_bar(slide, 1.0, 1.65)
        _template_body_text(slide, bullets, 1.0, 1.79, 11.5, 4.8, size=12)
        return slide

    # no-template: white background, navy header, white content card
    p = _pal(prs)
    acc = accent if accent is not None else p['accent']
    slide = _blank_slide(prs, content=True)
    _chrome(slide, section, acc, prs=prs)
    _tb(slide, 0.5, _TITLE_Y, 12.33, 0.80, title, 30, WHITE, bold=True)
    _white_card(slide, 0.5, _CONTENT_TOP, 12.33, _CONTENT_H, '', bullets, acc)
    return slide


def comparison_slide(prs, section, title,
                     left_heading, left_bullets,
                     right_heading, right_bullets,
                     left_accent=None, right_accent=None):
    """Two columns: left card1, right card2. Use for before/after, two options."""
    if _is_artifact_template_set(prs):
        layout = _get_layout(prs, 1, 'Content - Two Column')
        slide = prs.slides.add_slide(layout)
        _fill_ph(slide, 13, section.upper())
        _fill_ph(slide, 0, title)
        # Suppress placeholder hint text — we draw content ourselves
        _fill_ph(slide, 14, ' ')
        _fill_ph(slide, 15, ' ')
        # Teal accent bar under title
        _template_teal_bar(slide, 1.0, 1.65)
        # Vertical column divider

        # Left column
        if left_heading:
            _template_section_header(slide, left_heading, 1.0, 1.79, 5.7)
            _template_hline(slide, 1.0, 2.10, 1.5, color=TEAL, w_pt=0.75)
            _template_body_text(slide, left_bullets, 1.0, 2.20, 5.7, 4.3)
        else:
            _template_body_text(slide, left_bullets, 1.0, 1.79, 5.7, 4.8)
        # Right column
        if right_heading:
            _template_section_header(slide, right_heading, 7.2, 1.79, 5.7)
            _template_hline(slide, 7.2, 2.10, 1.5, color=TEAL, w_pt=0.75)
            _template_body_text(slide, right_bullets, 7.2, 2.20, 5.7, 4.3)
        else:
            _template_body_text(slide, right_bullets, 7.2, 1.79, 5.7, 4.8)
        return slide

    # no-template: two white cards side by side
    p = _pal(prs)
    la = left_accent  if left_accent  is not None else p['accent']
    ra = right_accent if right_accent is not None else p['accent2']
    slide = _blank_slide(prs, content=True)
    _chrome(slide, section, la, prs=prs)
    _tb(slide, 0.5, _TITLE_Y, 12.33, 0.80, title, 30, WHITE, bold=True)
    _white_card(slide, 0.5,  _CONTENT_TOP, 6.1, _CONTENT_H, left_heading,  left_bullets,  la)
    _white_card(slide, 6.73, _CONTENT_TOP, 6.1, _CONTENT_H, right_heading, right_bullets, ra)
    return slide


def three_card_slide(prs, section, title, cards, accent=None):
    """Three rounded cards. cards: 3 dicts {heading, bullets}."""
    if _is_artifact_template_set(prs):
        layout = _get_layout(prs, 1, 'Content - Three Column')
        slide = prs.slides.add_slide(layout)
        _fill_ph(slide, 13, section.upper())
        _fill_ph(slide, 0, title)
        # Suppress placeholder hint text — we draw content ourselves
        for idx in [12, 1, 14]:
            _fill_ph(slide, idx, ' ')
        _template_teal_bar(slide, 1.0, 1.65)
        col_x = [0.97, 4.94, 8.91]
        col_w = 3.66
        for i, card in enumerate(cards[:3]):
            cx = col_x[i]
            heading = card.get('heading', '')
            bullets = card.get('bullets', [])
            if heading:
                _template_section_header(slide, heading, cx, 1.79, col_w)
                _template_hline(slide, cx, 2.10, 1.5, color=TEAL, w_pt=0.75)
                _template_body_text(slide, bullets, cx, 2.20, col_w, 4.3)
            else:
                _template_body_text(slide, bullets, cx, 1.79, col_w, 4.8)
        return slide

    # no-template: three white cards
    p = _pal(prs)
    acc = accent if accent is not None else p['accent']
    slide = _blank_slide(prs, content=True)
    _chrome(slide, section, acc, prs=prs)
    _tb(slide, 0.5, _TITLE_Y, 12.33, 0.80, title, 30, WHITE, bold=True)

    accents = p['hacc']
    card_w  = 3.98
    gap     = 0.245

    for i, card in enumerate(cards[:3]):
        l = 0.5 + i * (card_w + gap)
        _white_card(slide, l, _CONTENT_TOP, card_w, _CONTENT_H,
                    card.get('heading', ''), card.get('bullets', []), accents[i])
    return slide


def gradient_slide(prs, section, title, cards):
    """Three dark cards with accent gradient header. Use ONCE per deck."""
    if _is_artifact_template_set(prs):
        # Summary - Priority: numbered panels, visually distinct from three_card_slide
        layout = _get_layout(prs, 2, 'Summary - Priority')
        slide = prs.slides.add_slide(layout)
        _fill_ph(slide, 14, section.upper())
        _fill_ph(slide, 0, title)
        # Three panels — each has a number, heading, and up to 3 detail lines
        card_phs = [
            (24, 21, [18, 27, 28]),
            (25, 22, [19, 29, 30]),
            (26, 23, [20, 31, 32]),
        ]
        for i, card in enumerate(cards[:3]):
            num_idx, heading_idx, detail_idxs = card_phs[i]
            _fill_ph(slide, num_idx, f'0{i + 1}')
            _fill_ph(slide, heading_idx, card.get('heading', ''))
            bullets = card.get('bullets', [])
            for j, detail_idx in enumerate(detail_idxs):
                _fill_ph(slide, detail_idx, bullets[j] if j < len(bullets) else ' ')
        return slide

    # no-template: original shape-drawing path
    p = _pal(prs)
    slide = _blank_slide(prs, content=True)
    _white_bg(slide)
    _remove_placeholders(slide)
    _gradient_rect(slide, 0, _HEADER_Y, 13.33, _HEADER_H,
                   p['dark_bg1'], p['dark_bg2'], angle=5400000)
    _rect(slide, 0, _HEADER_Y + _HEADER_H, 13.33, 0.04, p['accent'])
    _tb(slide, 0.85, 0.20, 12.0, 0.35, section.upper(), 10, p['section_label'], bold=True)
    _tb(slide, 0.5, _TITLE_Y, 12.33, 0.80, title, 30, WHITE, bold=True)

    bgs  = [p['card1'], p['card2'], p['card3']]
    hacc = [WHITE, p['accent2'], WHITE]
    card_w = 3.98
    gap    = 0.245

    for i, card in enumerate(cards[:3]):
        l = 0.5 + i * (card_w + gap)
        _dark_card(slide, l, _CONTENT_TOP, card_w, _CONTENT_H,
                   card.get('heading', ''), card.get('bullets', []),
                   bg=bgs[i], heading_color=hacc[i])
    return slide


def stat_slide(prs, section, stat_value, stat_label, body_lines=None, title=''):
    """Full-dark slide with one giant metric."""
    if _is_artifact_template_set(prs):
        # Use Content - Blank so we own all drawing — no phantom placeholders
        layout = _get_layout(prs, 1, 'Content - Blank')
        slide = prs.slides.add_slide(layout)
        _fill_ph(slide, 14, section.upper())
        if title:
            _fill_ph(slide, 0, title)
            _tb(slide, 1.0, 2.20, 11.33, 2.0, stat_value, 96, TEAL, bold=True)
            _template_teal_bar(slide, 1.0, 4.30)
            _template_section_header(slide, stat_label, 1.0, 4.45, 11.33)
            if body_lines:
                _template_body_text(slide, [str(l) for l in body_lines[:3]], 1.0, 4.80, 11.33, 2.0, size=12)
        else:
            _tb(slide, 1.0, 1.85, 11.33, 2.0, stat_value, 112, TEAL, bold=True)
            _template_teal_bar(slide, 1.0, 4.0)
            _template_section_header(slide, stat_label, 1.0, 4.15, 11.33)
            if body_lines:
                _template_body_text(slide, [str(l) for l in body_lines[:3]], 1.0, 4.50, 11.33, 2.3, size=12)
        return slide

    # no-template: original shape-drawing path
    p = _pal(prs)
    slide = _blank_slide(prs, content=True)
    _dark_bg(slide)
    _remove_placeholders(slide)
    _gradient_rect(slide, 0, 0, 13.33, 7.52, p['dark_bg1'], p['dark_bg2'], angle=5400000)
    _rect(slide, 0, 0, 13.33, 0.08, p['accent'])
    _tb(slide, 1.0, 0.18, 11.33, 0.45, section.upper(), 11, p['accent'], bold=True)
    _circle(slide, 6.67, 3.4, 4.2, None, line_color=p['stat_circle'], line_w_pt=1.5)
    _tb(slide, 1.0, 1.3, 11.33, 2.8, stat_value, 96, WHITE,
        bold=True, align=PP_ALIGN.CENTER)
    _rect(slide, 3.5, 4.15, 6.33, 0.06, p['accent'])
    _tb(slide, 1.0, 4.35, 11.33, 0.85, stat_label, 28, WHITE,
        align=PP_ALIGN.CENTER)
    if body_lines:
        _bullets_tb(slide, 2.5, 5.4, 8.33, 1.9, body_lines, 16, p['body_on_dark'])
    return slide


def quote_slide(prs, section, quote, attribution=''):
    """Full-dark quote with accent bar."""
    if _is_artifact_template_set(prs):
        # Use Content - Quote and Headshot: ph[0]=quote text, ph[16]=name, ph[17]=title, ph[14]=breadcrumb
        layout = _get_layout(prs, 1, 'Content - Quote and Headshot')
        slide = prs.slides.add_slide(layout)
        _remove_picture_placeholders(slide)
        _fill_ph(slide, 14, section.upper())
        _fill_ph(slide, 0, f'”{quote}”')
        if attribution:
            parts = attribution.split(',', 1)
            _fill_ph(slide, 16, parts[0].strip())
            if len(parts) > 1:
                _fill_ph(slide, 17, parts[1].strip())
        return slide

    # no-template: original shape-drawing path
    p = _pal(prs)
    slide = _blank_slide(prs, content=True)
    _dark_bg(slide)
    _remove_placeholders(slide)
    _gradient_rect(slide, 0, 0, 13.33, 7.52, p['dark_bg1'], p['dark_bg2'], angle=5400000)
    _rect(slide, 0, 0, 13.33, 0.08, p['accent2'])
    _tb(slide, 1.0, 0.18, 11.33, 0.45, section.upper(), 11, p['accent2'], bold=True)
    _rrect(slide, 0.8, 1.5, 11.73, 4.2, p['quote_box'])
    _rect(slide, 0.8, 1.5, 0.10, 4.2, p['quote_border'])
    _tb(slide, 1.15, 1.7, 11.0, 3.6, f'"{quote}"', 26, WHITE, italic=True)
    if attribution:
        _rect(slide, 1.15, 5.75, 2.0, 0.06, p['quote_border'])
        _tb(slide, 1.15, 5.95, 11.0, 0.5, f'— {attribution}', 16, p['accent'], bold=True)
    return slide


def headline_slide(prs, section, title, body_text, accent=None):
    """Headline + body text. body_text: list of 3–5 strings."""
    if _is_artifact_template_set(prs):
        layout = _get_layout(prs, 1, 'Content - Half Sidebar')
        slide = prs.slides.add_slide(layout)
        _fill_ph(slide, 14, section.upper())
        _fill_ph(slide, 0, title)
        lines = [body_text] if isinstance(body_text, str) else list(body_text)
        main_lines = lines[:-1] if len(lines) > 1 else lines
        sidebar_line = lines[-1] if len(lines) > 1 else ''
        _template_teal_bar(slide, 1.0, 1.65, w=6.8)
        # Fill ph[12] directly with white text so it overrides the gray theme color
        try:
            ph12 = slide.placeholders[12]
            tf = ph12.text_frame
            _no_autofit(tf)
            tf.clear()
            for i, line in enumerate(main_lines):
                para = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
                if i > 0:
                    pPr = para._p.get_or_add_pPr()
                    spcBef = etree.SubElement(pPr, qn('a:spcBef'))
                    spcPts = etree.SubElement(spcBef, qn('a:spcPts'))
                    spcPts.set('val', '500')
                run = para.add_run()
                run.text = f'›  {line}'
                run.font.name = FONT
                run.font.size = Pt(12)
                run.font.color.rgb = WHITE
        except KeyError:
            _bullets_tb(slide, 1.0, 1.79, 7.5, 4.8, main_lines, 12, WHITE, bullet_char='›', space_before_pt=5)
        if sidebar_line:
            _fill_ph(slide, 15, ' ')
            _tb(slide, 8.3, 3.3, 3.8, 2.0, sidebar_line, 20, BLACK, bold=True, align=PP_ALIGN.CENTER)
        return slide

    # no-template: white card with accent top stripe
    p = _pal(prs)
    acc = accent if accent is not None else p['accent']
    slide = _blank_slide(prs, content=True)
    _chrome(slide, section, acc, prs=prs)
    _tb(slide, 0.5, _TITLE_Y, 12.33, 0.80, title, 30, WHITE, bold=True)
    lines = [body_text] if isinstance(body_text, str) else body_text
    _white_card(slide, 0.5, _CONTENT_TOP, 12.33, _CONTENT_H, '', lines, acc)
    return slide


def statement_slide(prs, title):
    """Bold declarative statement — maximum visual impact.
    Template: Content - Blank with large centered statement + teal accent lines."""
    if _is_artifact_template_set(prs):
        layout = _get_layout(prs, 1, 'Content - Blank')
        slide = prs.slides.add_slide(layout)
        # Large centered statement text — starts below master divider line at y=1.70
        _tb(slide, 1.0, 1.90, 11.33, 3.5, title, 32, BLACK, bold=True, align=PP_ALIGN.LEFT)
        _template_teal_bar(slide, 1.0, 5.6)
        return slide

    # no-template: dark card full-width
    p = _pal(prs)
    slide = _blank_slide(prs, content=True)
    _dark_bg(slide)
    _remove_placeholders(slide)
    _gradient_rect(slide, 0, 0, 13.33, 7.52, p['dark_bg1'], p['dark_bg2'], angle=5400000)
    _rect(slide, 0, 0, 13.33, 0.08, p['accent'])
    _tb(slide, 1.0, 2.5, 11.33, 2.5, title, 44, WHITE, bold=True, align=PP_ALIGN.CENTER)
    return slide


def table_slide(prs, section, title, headers, rows, accent=None):
    """Slide with a styled data table. Max ~8 rows."""
    p = _pal(prs)
    acc = accent if accent is not None else p['accent']

    if _is_artifact_template_set(prs):
        layout = _get_layout(prs, 1, 'Content - One Column')
        slide = prs.slides.add_slide(layout)
        _fill_ph(slide, 13, section.upper())
        _fill_ph(slide, 0, title)
        # Capture body placeholder geometry, then remove it to make room for the table
        try:
            body_ph = slide.placeholders[14]
            tl = body_ph.left
            tt = body_ph.top
            tw = body_ph.width
            th = body_ph.height
            body_ph._element.getparent().remove(body_ph._element)
        except KeyError:
            tl = Inches(0.5)
            tt = Inches(_CONTENT_TOP)
            tw = Inches(12.33)
            th = Inches(_CONTENT_H)
    else:
        slide = _blank_slide(prs, content=True)
        _chrome(slide, section, acc, prs=prs)
        _tb(slide, 0.5, _TITLE_Y, 12.33, 0.80, title, 30, WHITE, bold=True)
        tl = Inches(0.5)
        tt = Inches(_CONTENT_TOP)
        tw = Inches(12.33)
        th = Inches(_CONTENT_H)

    ncols = len(headers)
    nrows = len(rows) + 1
    # Cap each row at 0.55" so sparse tables don't sprawl — 1 header + n data rows
    row_h = Inches(0.55)
    table_h = min(th, row_h * nrows)
    if _is_artifact_template_set(prs):
        tt = tt + Inches(0.12)
    table = slide.shapes.add_table(nrows, ncols, tl, tt, tw, table_h).table

    col_w = int(tw / ncols)
    for col in table.columns:
        col.width = col_w
    for row in table.rows:
        row.height = row_h

    def _cell(cell, text, size, fg, bg, bold=False, align=PP_ALIGN.LEFT):
        cell.fill.solid()
        cell.fill.fore_color.rgb = bg
        tf = cell.text_frame
        tf.clear()
        para = tf.paragraphs[0]
        para.alignment = align
        run = para.add_run()
        run.text = str(text)
        run.font.name = FONT
        run.font.size = Pt(size)
        run.font.bold = bold
        run.font.color.rgb = fg
        for tag in ('a:lnL', 'a:lnR', 'a:lnT', 'a:lnB'):
            tcPr = cell._tc.find(qn('a:tcPr'))
            if tcPr is not None:
                for ln in tcPr.findall(qn(tag)):
                    tcPr.remove(ln)

    for j, hdr in enumerate(headers):
        _cell(table.cell(0, j), hdr, 14, WHITE, p['card1'], bold=True)

    for i, row_data in enumerate(rows):
        bg = WHITE if i % 2 == 0 else p['body_on_dark']
        for j, val in enumerate(row_data[:ncols]):
            _cell(table.cell(i + 1, j), val, 13, BLACK, bg)

    section_val = section if _is_artifact_template_set(prs) else section
    return slide


def icon_card_slide(prs, section, title, cards, accent=None):
    """Three rounded cards with icon, heading, bullets.
    cards: exactly 3 dicts: {'icon': 'analytics', 'heading': '...', 'bullets': [...]}"""
    if _is_artifact_template_set(prs):
        layout = _get_layout(prs, 1, 'Content - Three Column')
        slide = prs.slides.add_slide(layout)
        _fill_ph(slide, 13, section.upper())
        _fill_ph(slide, 0, title)
        for idx in [12, 1, 14]:
            _fill_ph(slide, idx, ' ')
        _template_teal_bar(slide, 1.0, 1.65)
        col_x = [0.97, 4.94, 8.91]
        col_w = 3.66
        icon_sz = 0.55
        for i, card in enumerate(cards[:3]):
            cx = col_x[i]
            # Icon centered above column
            icon_name = card.get('icon', '')
            icon_path = os.path.join(_ICONS, ICONS.get(icon_name, ''))
            body_y = 1.79
            if icon_name and os.path.exists(icon_path):
                try:
                    slide.shapes.add_picture(
                        icon_path,
                        Inches(cx + (col_w - icon_sz) / 2),
                        Inches(1.82),
                        Inches(icon_sz), Inches(icon_sz))
                    body_y = 1.82 + icon_sz + 0.12
                except Exception:
                    pass
            heading = card.get('heading', '')
            bullets = card.get('bullets', [])
            if heading:
                _template_section_header(slide, heading, cx, body_y, col_w)
                _template_hline(slide, cx, body_y + 0.31, 1.5, color=TEAL, w_pt=0.75)
                _template_body_text(slide, bullets, cx, body_y + 0.42, col_w, 6.16 - body_y)
            else:
                _template_body_text(slide, bullets, cx, body_y, col_w, 6.58 - body_y)
        return slide

    # no-template: three white cards with icons
    p = _pal(prs)
    acc = accent if accent is not None else p['accent']
    slide = _blank_slide(prs, content=True)
    _chrome(slide, section, acc, prs=prs)
    _tb(slide, 0.5, _TITLE_Y, 12.33, 0.80, title, 30, WHITE, bold=True)

    accents = p['hacc']
    card_w  = 3.98
    card_h  = _CONTENT_H
    gap     = 0.245
    icon_sz = 0.80

    for i, card in enumerate(cards[:3]):
        l    = 0.5 + i * (card_w + gap)
        iacc = accents[i]

        _white_card(slide, l, _CONTENT_TOP, card_w, card_h, '', [], iacc)

        icon_name = card.get('icon', '')
        icon_path = os.path.join(_ICONS, ICONS.get(icon_name, ''))
        if icon_name and os.path.exists(icon_path):
            slide.shapes.add_picture(
                icon_path,
                Inches(l + (card_w - icon_sz) / 2),
                Inches(_CONTENT_TOP + 0.22),
                Inches(icon_sz), Inches(icon_sz))
            icon_space = 0.22 + icon_sz + 0.10
        else:
            cx = l + card_w / 2
            cy = _CONTENT_TOP + 0.62
            _circle(slide, cx, cy, 0.55, iacc)
            _tb(slide, cx - 0.22, cy - 0.20, 0.44, 0.40,
                str(i + 1), 18, WHITE, bold=True, align=PP_ALIGN.CENTER)
            icon_space = 0.22 + 0.55 + 0.10

        _card_text(slide, l, _CONTENT_TOP, card_w, card_h,
                   card.get('heading', ''), card.get('bullets', []),
                   heading_color=BLACK, body_color=DGRAY,
                   heading_size=16, body_size=13, icon_space=icon_space)
    return slide


def process_flow_slide(prs, section, title, steps, accent=None):
    """Three or four steps with numbered circles, connecting arrows, and text boxes.
    steps: list of 3–4 dicts: {'number': '01', 'heading': '...', 'body': '...'}"""
    if _is_artifact_template_set(prs):
        n = min(len(steps), 4)
        if n <= 3:
            layout = _get_layout(prs, 1, 'Content - Three Column')
            slide = prs.slides.add_slide(layout)
            _fill_ph(slide, 13, section.upper())
            _fill_ph(slide, 0, title)
            for idx in [12, 1, 14]:
                _fill_ph(slide, idx, ' ')
            _template_teal_bar(slide, 1.0, 1.65)
            col_x = [1.0, 5.11, 9.22]
            col_w = 3.78
            for i, step in enumerate(steps[:3]):
                cx = col_x[i]
                num = step.get('number', f'0{i+1}')
                heading = step.get('heading', '')
                body = step.get('body', '')
                # Large step number
                _tb(slide, cx, 1.79, col_w, 0.65, num, 36, TEAL, bold=True)
                _template_hline(slide, cx, 2.46, 1.5, color=TEAL, w_pt=0.75)
                if heading:
                    _template_section_header(slide, heading, cx, 2.55, col_w)
                if body:
                    _template_body_text(slide, [body], cx, 2.88, col_w, 3.7, size=12)
        else:
            layout = _get_layout(prs, 1, 'Content - Two Column')
            slide = prs.slides.add_slide(layout)
            _fill_ph(slide, 13, section.upper())
            _fill_ph(slide, 0, title)
            _fill_ph(slide, 14, ' ')
            _fill_ph(slide, 15, ' ')
            _template_teal_bar(slide, 1.0, 1.65)
    
            cols = [(steps[:2], 1.0), (steps[2:4], 7.2)]
            for col_steps, cx in cols:
                y = 1.79
                for step in col_steps:
                    num = step.get('number', '')
                    heading = step.get('heading', '')
                    body = step.get('body', '')
                    _tb(slide, cx, y, 5.7, 0.50, num, 28, TEAL, bold=True)
                    _template_hline(slide, cx, y + 0.52, 1.5, color=TEAL, w_pt=0.75)
                    if heading:
                        _template_section_header(slide, heading, cx, y + 0.60, 5.7)
                    if body:
                        _template_body_text(slide, [body], cx, y + 0.93, 5.7, 1.4, size=12)
                    y += 2.45
        return slide

    # no-template: white cards, colored circles with numbers
    p = _pal(prs)
    acc = accent if accent is not None else p['accent']
    slide = _blank_slide(prs, content=True)
    _chrome(slide, section, acc, prs=prs)
    _tb(slide, 0.5, _TITLE_Y, 12.33, 0.80, title, 30, WHITE, bold=True)

    n = min(len(steps), 4)
    accents = p['hacc'] + [p['accent3']]

    total_w  = 12.33
    step_w   = total_w / n
    circle_y = _CONTENT_TOP + 0.55
    circle_d = 0.80
    conn_y   = circle_y + circle_d / 2

    for i, step in enumerate(steps[:n]):
        cx  = 0.5 + step_w * i + step_w / 2
        iacc = accents[i % len(accents)]

        # Connector line to next step
        if i < n - 1:
            next_cx = 0.5 + step_w * (i + 1) + step_w / 2
            arrow_l = cx + circle_d / 2 + 0.05
            arrow_w = next_cx - circle_d / 2 - 0.05 - arrow_l
            if arrow_w > 0.1:
                _rect(slide, arrow_l, conn_y - 0.02, arrow_w, 0.04, p['section_label'])

        # Colored circle
        _circle(slide, cx, conn_y, circle_d, iacc)
        num = step.get('number', str(i + 1).zfill(2))
        _tb(slide, cx - 0.30, conn_y - 0.22, 0.60, 0.44,
            num, 20, WHITE, bold=True, align=PP_ALIGN.CENTER)

        # White card below circle
        box_l = 0.5 + step_w * i + 0.15
        box_w = step_w - 0.30
        box_t = circle_y + circle_d + 0.25
        box_h = _CONTENT_TOP + _CONTENT_H - box_t

        heading = step.get('heading', '')
        body    = step.get('body', '')

        _white_card(slide, box_l, box_t, box_w, box_h, heading, [body] if body else [], iacc)

    return slide
