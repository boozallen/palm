# PowerPoint Presentation Generator

Create a `.pptx` file using Python + python-pptx. Write a Python script and execute it with `python3`.

---

## Branded decks

**(When your `## Setup` block calls `load_group_template()`)**

Your setup code loads the template and defines helper functions. The template has **many purpose-built layouts** — prefer them over drawing shapes manually. Each layout inherits the full template chrome automatically: teal title-divider line, logo, footer, page number.

> **CRITICAL — READ BEFORE WRITING ANY SLIDE:**
> - **`Title Slide - Texture 1` is used EXACTLY ONCE — slide 1 only.** Every other slide uses a named content layout or `Content - Blank` custom pattern.
> - **Prefer named layouts.** Use `Content - Blank` only when no named layout fits the content.
> - **Breadcrumb on named layouts:** use `_text(slide, BREADCRUMB_IDX, 'SECTION | TOPIC')` — the placeholder inherits the correct template style automatically.
> - **Breadcrumb on `Content - Blank`:** use `tb(slide, 1.0, 0.25, 6.0, 0.40, 'SECTION', 11, BLACK, bold=True)` — always BLACK, never TEAL or GREEN.
> - **All text uses Inter font.** The `tb()` helper sets `run.font.name = 'Inter'` automatically.

---

### Template brand colors

```python
TEAL    = '23D2D7'   # electric teal — primary accent, headers, highlights
DTEAL   = '00A5B5'   # dark teal — secondary accent
LTEAL   = 'E9FBFB'   # light teal tint — panel backgrounds
GREEN   = 'A8D34F'   # electric green — alternate accent
FUCHSIA = 'D857C6'   # fuchsia — alternate accent
LGRAY   = 'F7F8F8'   # light gray — alternating panel backgrounds
MGRAY   = 'D6DBDD'   # medium gray — muted borders
DARK    = '0D1117'   # near-black — dark panels, callout boxes
WHITE   = 'FFFFFF'
BLACK   = '000000'
```

---

### Core drawing primitives

```python
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN

def rgb(hex6):
    return RGBColor(int(hex6[0:2],16), int(hex6[2:4],16), int(hex6[4:6],16))

def _layout(name):
    for master in prs.slide_masters:
        for layout in master.slide_layouts:
            if layout.name == name: return layout
    raise ValueError(f'Layout not found: {name}')

def _text(slide, idx, text):
    """Fill a placeholder by idx. Use for all named-layout placeholders."""
    for ph in slide.placeholders:
        if ph.placeholder_format.idx == idx:
            ph.text = str(text); return

def _pic(slide, idx, icon_name):
    """Insert an icon into a pic-type placeholder by idx."""
    path = f'{ICONS_DIR}/icon_{icon_name}.png'
    for ph in slide.placeholders:
        if ph.placeholder_format.idx == idx:
            ph.insert_picture(path); return

def rect(slide, l, t, w, h, color, line_color=None):
    s = slide.shapes.add_shape(1, Inches(l), Inches(t), Inches(w), Inches(h))
    s.fill.solid(); s.fill.fore_color.rgb = rgb(color)
    if line_color: s.line.color.rgb = rgb(line_color); s.line.width = Pt(0.5)
    else: s.line.fill.background()
    return s

def tb(slide, l, t, w, h, text, size, color, bold=False, align=PP_ALIGN.LEFT):
    """Add a freeform textbox. Use only on Content - Blank slides."""
    tx = slide.shapes.add_textbox(Inches(l), Inches(t), Inches(w), Inches(h))
    tx.text_frame.word_wrap = True
    p = tx.text_frame.paragraphs[0]; p.alignment = align
    run = p.add_run(); run.text = text
    run.font.size = Pt(size); run.font.bold = bold
    run.font.color.rgb = rgb(color)
    run.font.name = 'Inter'
    return tx

def title(slide, text):
    _text(slide, 0, text)

ICONS_DIR = '/app/skills/pptx/assets/icons'

def pic(slide, icon_name, l, t, size=0.45):
    """Add a freeform icon image. Use only on Content - Blank slides."""
    path = f'{ICONS_DIR}/icon_{icon_name}.png'
    slide.shapes.add_picture(path, Inches(l), Inches(t), Inches(size), Inches(size))
```

**Available icons:** `ai`, `analytics`, `calendar`, `collaboration`, `innovation`, `intelligence`, `leadership`, `organization`, `performance`, `process`, `progress`, `quality`

---

## Named layouts — PREFER THESE

Every named layout has a built-in breadcrumb placeholder at y=0. Fill it with `_text(slide, BC, 'SECTION | TOPIC')` where `BC` is the breadcrumb idx shown for each layout. The title is always `_text(slide, 0, 'Title')`.

---

### COVER — `Title Slide - Texture 1`

Use exactly once: slide 1.

```python
slide = prs.slides.add_slide(_layout('Title Slide - Texture 1'))
_text(slide, 0, 'Deck Title Here')
_text(slide, 1, 'One-line subtitle or description')
_text(slide, 11, 'Team Name  |  Month Year')
```

---

### CONTENT + SIDEBAR — `Content - Half Sidebar`

Best for: main content with a callout/summary panel on the right. Breadcrumb idx=14, main body idx=12, sidebar idx=15.

```python
slide = prs.slides.add_slide(_layout('Content - Half Sidebar'))
_text(slide, 14, 'SECTION | TOPIC')
_text(slide, 0, 'Slide Title')
_text(slide, 12, 'Main body content here.\n\nPoint one\nPoint two\nPoint three\nPoint four')
_text(slide, 15, 'Key Insight\n\nSupporting detail that reinforces the main message.')
```

---

### EXEC SUMMARY — `Summary - Exec`

Best for: opening executive summary or closing summary with stats. Breadcrumb idx=14, title idx=0, milestones body idx=12, milestones label idx=16, stats label idx=15. Stats come in value/description pairs: (17/18), (19/20), (21/22), (23/24).

```python
slide = prs.slides.add_slide(_layout('Summary - Exec'))
_text(slide, 14, 'OVERVIEW | EXECUTIVE SUMMARY')
_text(slide, 0, 'Executive\nSummary')
_text(slide, 16, 'Key milestones')
_text(slide, 12, '• Milestone one achieved\n• Milestone two on track\n• Milestone three planned Q3\n• Milestone four planned Q4')
_text(slide, 15, 'Key facts')
_text(slide, 17, '94%')
_text(slide, 18, 'Adoption rate across program')
_text(slide, 19, '$2.4M')
_text(slide, 20, 'Cost savings identified')
_text(slide, 21, '18mo')
_text(slide, 22, 'Ahead of schedule')
_text(slide, 23, '12')
_text(slide, 24, 'Agencies onboarded')
```

---

### THREE PRIORITIES — `Summary - Priority`

Best for: top 3 findings, priorities, or recommendations — each with a number, title, description, and sub-bullets. Breadcrumb idx=14.

| Col | Number | Title | Description | Subhead | Bullets |
|-----|--------|-------|-------------|---------|---------|
| 1   | 24     | 21    | 18          | 27      | 28      |
| 2   | 25     | 22    | 19          | 29      | 30      |
| 3   | 26     | 23    | 20          | 31      | 32      |

```python
slide = prs.slides.add_slide(_layout('Summary - Priority'))
_text(slide, 14, 'FINDINGS | TOP PRIORITIES')
_text(slide,  0, 'Three Strategic Priorities')

_text(slide, 24, '01')
_text(slide, 21, 'Priority One Title')
_text(slide, 18, 'Two-sentence description of this priority and why it matters to the mission.')
_text(slide, 27, 'KEY ACTIONS')
_text(slide, 28, 'Action item one\nAction item two')

_text(slide, 25, '02')
_text(slide, 22, 'Priority Two Title')
_text(slide, 19, 'Two-sentence description of this priority and why it matters to the mission.')
_text(slide, 29, 'KEY ACTIONS')
_text(slide, 30, 'Action item one\nAction item two')

_text(slide, 26, '03')
_text(slide, 23, 'Priority Three Title')
_text(slide, 20, 'Two-sentence description of this priority and why it matters to the mission.')
_text(slide, 31, 'KEY ACTIONS')
_text(slide, 32, 'Action item one\nAction item two')
```

---

### AGENDA — `Summary - Agenda`

Best for: meeting agenda, table of contents, session overview. Breadcrumb idx=13, title idx=0, participants idx=14. Agenda items are number/text pairs: (17/1), (18/15), (19/16), (21/20).

```python
slide = prs.slides.add_slide(_layout('Summary - Agenda'))
_text(slide, 13, 'OVERVIEW | AGENDA')
_text(slide,  0, "Today's Agenda")
_text(slide, 14, 'Attendees: Name, Name, Name')

_text(slide, 17, '01');  _text(slide,  1, 'Topic One — brief description')
_text(slide, 18, '02');  _text(slide, 15, 'Topic Two — brief description')
_text(slide, 19, '03');  _text(slide, 16, 'Topic Three — brief description')
_text(slide, 21, '04');  _text(slide, 20, 'Topic Four — brief description')
```

---

### FIVE-COLUMN WITH ICONS — `1_Custom Layout`

Best for: five workstreams, five capabilities, five team functions — each with a subtitle, body text, a metric, and an icon. Breadcrumb idx=40.

| Col | Subtitle | Body | Metric | Icon (pic) | Label |
|-----|----------|------|--------|------------|-------|
| 1   | 15       | 20   | 25     | 35         | 26    |
| 2   | 16       | 21   | 27     | 36         | 28    |
| 3   | 17       | 22   | 29     | 37         | 30    |
| 4   | 18       | 23   | 31     | 38         | 32    |
| 5   | 19       | 24   | 33     | 39         | 34    |

```python
slide = prs.slides.add_slide(_layout('1_Custom Layout'))
_text(slide, 40, 'CAPABILITIES | FIVE PILLARS')
_text(slide,  0, 'Five Core Capabilities')

cols = [
    (15, 20, 25, 35, 26, 'AI & Data',      'Detail\nDetail\nDetail', '94%',  'analytics',      'Adoption'),
    (16, 21, 27, 36, 28, 'Process',        'Detail\nDetail\nDetail', '2.4x', 'process',        'Efficiency'),
    (17, 22, 29, 37, 30, 'Collaboration',  'Detail\nDetail\nDetail', '18mo', 'collaboration',  'Ahead'),
    (18, 23, 31, 38, 32, 'Innovation',     'Detail\nDetail\nDetail', '$2M',  'innovation',     'Saved'),
    (19, 24, 33, 39, 34, 'Leadership',     'Detail\nDetail\nDetail', '12',   'leadership',     'Teams'),
]
for sub_i, body_i, met_i, icon_i, lbl_i, subtitle, body, metric, icon, label in cols:
    _text(slide, sub_i, subtitle)
    _text(slide, body_i, body)
    _text(slide, met_i, metric)
    _pic(slide, icon_i, icon)
    _text(slide, lbl_i, label)
```

---

## Content - Blank (fallback only)

Use `Content - Blank` **only** when no named layout fits. It has no built-in placeholders — you draw everything manually. Body safe zone: x=0.30–12.83, y=1.78–6.90 inches.

```python
slide = prs.slides.add_slide(_layout('Content - Blank'))
title(slide, 'Slide Title')
tb(slide, 1.0, 0.25, 6.0, 0.40, 'SECTION', 11, BLACK, bold=True)
# all body shapes below y=1.78
```

### Custom pattern: TWO-PANEL COMPARISON

```python
slide = prs.slides.add_slide(_layout('Content - Blank'))
title(slide, 'Option A vs. Option B')
tb(slide, 1.0, 0.25, 6.0, 0.40, 'APPROACH | COMPARISON', 11, BLACK, bold=True)

rect(slide, 0.30, 1.82, 5.95, 4.80, 'F7F8F8')
rect(slide, 0.30, 1.82, 0.08, 4.80, TEAL)
tb(slide, 0.55, 2.00, 5.5, 0.35, 'Option A', 14, BLACK, bold=True)
tb(slide, 0.55, 2.50, 5.5, 3.80, '• Strength one\n• Strength two\n• Strength three\n• Strength four', 12, '374151')

rect(slide, 6.58, 1.82, 6.05, 4.80, LTEAL)
rect(slide, 6.58, 1.82, 0.08, 4.80, DTEAL)
tb(slide, 6.83, 2.00, 5.5, 0.35, 'Option B', 14, BLACK, bold=True)
tb(slide, 6.83, 2.50, 5.5, 3.80, '• Strength one\n• Strength two\n• Strength three\n• Strength four', 12, '374151')
```

---

### Custom pattern: BIG STAT

```python
slide = prs.slides.add_slide(_layout('Content - Blank'))
title(slide, 'The Headline Number')
tb(slide, 1.0, 0.25, 6.0, 0.40, 'RESULTS | IMPACT', 11, BLACK, bold=True)

tb(slide, 1.0, 1.90, 11.33, 2.20, '94%', 96, TEAL, bold=True, align=PP_ALIGN.CENTER)
rect(slide, 0.30, 4.20, 12.53, 0.06, TEAL)
tb(slide, 1.0, 4.40, 11.33, 0.40, 'WHAT THIS NUMBER MEANS', 12, BLACK, bold=True, align=PP_ALIGN.CENTER)
tb(slide, 1.0, 4.95, 11.33, 1.60,
   '• Supporting detail one\n• Supporting detail two\n• Supporting detail three',
   12, '374151', align=PP_ALIGN.CENTER)
```

---

### Custom pattern: THREE-COLUMN PILLARS

```python
slide = prs.slides.add_slide(_layout('Content - Blank'))
title(slide, 'Three Core Components')
tb(slide, 1.0, 0.25, 6.0, 0.40, 'ARCHITECTURE', 11, BLACK, bold=True)

col_w, col_h = 3.85, 4.55
positions = [0.30, 4.48, 8.66]
colors = [TEAL, GREEN, FUCHSIA]
headings = ['Component One', 'Component Two', 'Component Three']
bullets = [
    '• Detail one\n• Detail two\n• Detail three',
    '• Detail one\n• Detail two\n• Detail three',
    '• Detail one\n• Detail two\n• Detail three',
]
for x, color, heading, body in zip(positions, colors, headings, bullets):
    rect(slide, x, 1.82, col_w, col_h, WHITE, 'D6DBDD')
    rect(slide, x, 1.82, 0.08, col_h, color)
    tb(slide, x+0.22, 2.05, col_w-0.3, 0.32, heading, 14, BLACK, bold=True)
    tb(slide, x+0.22, 2.55, col_w-0.3, 3.6, body, 12, '374151')
```

---

### Custom pattern: FOUR-STEP PROCESS FLOW

```python
slide = prs.slides.add_slide(_layout('Content - Blank'))
title(slide, 'How It Works')
tb(slide, 1.0, 0.25, 6.0, 0.40, 'PROCESS', 11, BLACK, bold=True)

steps = [
    ('1', 'Step One',   'Short description'),
    ('2', 'Step Two',   'Short description'),
    ('3', 'Step Three', 'Short description'),
    ('4', 'Step Four',  'Short description'),
]
step_w = 2.70
for i, (num, heading, body) in enumerate(steps):
    x = 0.30 + i * (step_w + 0.30)
    rect(slide, x, 1.85, step_w, 3.20, LTEAL if i % 2 == 0 else LGRAY)
    rect(slide, x+0.12, 2.10, 0.50, 0.50, TEAL)
    tb(slide, x+0.12, 2.20, 0.50, 0.30, num, 11, WHITE, bold=True, align=PP_ALIGN.CENTER)
    tb(slide, x+0.12, 2.80, step_w-0.24, 0.32, heading, 14, BLACK, bold=True)
    tb(slide, x+0.12, 3.30, step_w-0.24, 1.50, body, 12, '374151')
    if i < len(steps)-1:
        rect(slide, x+step_w+0.04, 3.25, 0.22, 0.02, TEAL)

rect(slide, 0.30, 5.30, 12.53, 0.75, DARK)
tb(slide, 0.60, 5.48, 12.0, 0.40, 'Key takeaway for this process.', 12, WHITE)
```

### Custom pattern: THREE-ICON CARDS

```python
slide = prs.slides.add_slide(_layout('Content - Blank'))
title(slide, 'Core Capabilities')
tb(slide, 1.0, 0.25, 6.0, 0.40, 'CAPABILITIES', 11, BLACK, bold=True)

cards = [
    ('ai',            TEAL,    'AI & Automation', '• Detail\n• Detail\n• Detail'),
    ('analytics',     DTEAL,   'Data Analytics',  '• Detail\n• Detail\n• Detail'),
    ('collaboration', FUCHSIA, 'Team Enablement', '• Detail\n• Detail\n• Detail'),
]
card_w = 3.85
for i, (icon, color, heading, body) in enumerate(cards):
    x = 0.30 + i * (card_w + 0.27)
    rect(slide, x, 1.82, card_w, 4.80, WHITE, 'D6DBDD')
    rect(slide, x, 1.82, card_w, 0.55, color)
    pic(slide, icon, x + (card_w - 0.45) / 2, 1.87, size=0.42)
    tb(slide, x+0.18, 2.52, card_w-0.36, 0.36, heading, 14, BLACK, bold=True)
    tb(slide, x+0.18, 3.00, card_w-0.36, 3.20, body, 12, '374151')
```

### Custom pattern: CLOSING SUMMARY

```python
slide = prs.slides.add_slide(_layout('Content - Blank'))
title(slide, 'A Foundation Designed to Keep Evolving')
tb(slide, 1.0, 0.25, 6.0, 0.40, 'CONCLUSION', 11, BLACK, bold=True)

rect(slide, 0.30, 1.82, 12.53, 1.05, LTEAL)
tb(slide, 0.55, 2.0,  2.5, 0.30, 'The core principle', 12, '4B5563', bold=True)
tb(slide, 3.20, 1.97, 9.4, 0.38, 'One bold declarative statement.', 16, BLACK, bold=True)

props = [
    ('Property One',   'Short description'),
    ('Property Two',   'Short description'),
    ('Property Three', 'Short description'),
    ('Property Four',  'Short description'),
]
card_w = 2.85
for i, (prop, desc) in enumerate(props):
    x = 0.30 + i * (card_w + 0.35)
    rect(slide, x, 3.15, card_w, 1.95, WHITE if i % 2 == 0 else LGRAY, 'E0E2E6')
    tb(slide, x+0.18, 3.40, card_w-0.3, 0.30, prop, 14, BLACK, bold=True)
    tb(slide, x+0.18, 3.88, card_w-0.3, 0.80, desc, 12, '374151')

tb(slide, 0.35, 5.58, 12.3, 0.55, 'Closing sentence that leaves the audience with a clear takeaway.', 12, '4B5563')
```

---

## Design rules

1. **Prefer named layouts.** Match the layout to the content: one body → `Content - One Column`, stats/milestones → `Summary - Exec`, top findings → `Summary - Priority`, five workstreams → `1_Custom Layout`, sidebar → `Content - Half Sidebar`. Use `Content - Blank` custom patterns for comparisons, three-column pillars, big stats, process flows, and icon cards. **NEVER use these layouts:** `Content - Two Column`, `Content - Three Column`, `Content - Quarter Image`, `Content - Half Image`, `Content - Quarter Sidebar`, `Content - Stat and Image`, `Content - Quote and Headshot`, `Content - Quote and Image`, `Content - One Column`, `Divider - Texture 1`, `Divider - Texture 2`, `Divider - Quarter Image` — these either render as unstyled floating text, leave broken empty picture placeholders, or look like title/cover slides mid-deck.
2. **`Title Slide - Texture 1` exactly once — slide 1 only. Never use `Divider - Texture 1` or any other Divider/Title layout** — they all look like cover slides and confuse the audience. Every slide after slide 1 uses a content layout or custom `Content - Blank` pattern.
3. **8–12 slides total.** Every slide uses a different layout or pattern — never repeat the same one back-to-back.
4. **Breadcrumbs on named layouts:** `_text(slide, BC_IDX, 'SECTION | TOPIC')` — inherits template style automatically. On `Content - Blank`: `tb(slide, 1.0, 0.25, 6.0, 0.40, 'SECTION', 11, BLACK, bold=True)`.
5. **Use brand colors only** — TEAL, DTEAL, LTEAL, GREEN, FUCHSIA, DARK, WHITE, LGRAY, BLACK. Never invent hex codes.
6. **Add a DARK callout bar on at least 2 slides** — `rect(slide, 0.30, 5.30, 12.53, 0.75, DARK)` with a WHITE key-message sentence inside.
7. **Use icons on at least 2 slides** — via `_pic()` on `1_Custom Layout`, or `pic()` on `Content - Blank` three-icon/four-icon patterns.
8. **Keep text short.** Heading: 1 line. Body: short phrases. Max 40 words per slide.
9. **Last slide must be visually strong** — `Summary - Exec`, closing summary, or `Divider - Texture 1` with a bold statement.
10. **Never use a named layout for only part of its purpose.** If you use `1_Custom Layout`, fill all 5 columns. If you use `Summary - Priority`, fill all 3 priorities.

## Typography rules — ENFORCE STRICTLY

- **Headings in named-layout placeholders:** inherit from master — do not override.
- **Custom headings (`tb()`):** 14pt minimum, bold.
- **Custom body text (`tb()`):** 12pt minimum.
- **Section breadcrumb on `Content - Blank`:** 11pt bold BLACK at y=0.25. Never TEAL, never GREEN.
- **Stat values** (the big number in `Content - Stat and Image`): uses the layout's built-in oversized style — just set the text.
- **Never use 8pt, 9pt, or 10pt for any `tb()` content text.**

## Density rules — ENFORCE STRICTLY

- **Named layouts:** fill every placeholder — never leave idx fields empty.
- **Max 4 items per custom-drawn column or list.** If content has 5+ items, use a named layout or split slides.
- **Whitespace is intentional.** Fewer, larger elements beat many small crowded ones.
- **One key message per slide.**

---

## Unbranded decks

**(When your `## Setup` block shows `load_plain_template()`)**

Use the slide factory functions only.

### RULES

1. **Only call factory functions.** Do NOT write raw python-pptx shapes.
2. **`title_slide()` exactly once — slide 1 only.**
3. **`divider_slide()` for section breaks only.** Max 1 per deck.
4. **`table_slide` for any content with headers + rows.** At least 4 rows.
5. **`stat_slide` `stat_value` = short metric only** — number, %, duration, date. Never a sentence.
6. **`comparison_slide` only for two genuinely parallel options.**
7. **`bullets_slide` needs at least 4 bullets.**
8. **Always pass `section=` breadcrumb.** Never empty.
9. **Never end with `bullets_slide`.** Last slide: `statement_slide`, `headline_slide`, or `quote_slide`.
10. **Max 2 `bullets_slide` per deck.** For 3-group content use `icon_card_slide`.
11. **Keep bullet text short** — one short phrase per line.
12. **Never produce an empty slide.**

### Available functions (no template)

```python
title_slide(prs, title='', subtitle='', tagline='')
bullets_slide(prs, section='', title='', bullets=[])
comparison_slide(prs, section='', title='', left_heading='', left_bullets=[], right_heading='', right_bullets=[])
three_card_slide(prs, section='', title='', cards=[{'heading': '', 'bullets': []}])
gradient_slide(prs, section='', title='', cards=[{'heading': '', 'bullets': ['', '', '']}])
stat_slide(prs, section='', stat_value='', stat_label='', body_lines=[])
quote_slide(prs, section='', quote='', attribution='')
headline_slide(prs, section='', title='', body_text=[])
statement_slide(prs, title='')
table_slide(prs, section='', title='', headers=[], rows=[])
icon_card_slide(prs, section='', title='', cards=[{'icon': '', 'heading': '', 'bullets': []}])
process_flow_slide(prs, section='', title='', steps=[{'number': '', 'heading': '', 'body': ''}])
divider_slide(prs, title='', subtitle='')
agenda_slide(prs, section='', title='', items=[], summary='')
exec_summary_slide(prs, section='', title='', stats=[{'value': '', 'description': ''}], milestones=[])
```

### Available icons (for `icon_card_slide`)

`analytics`, `performance`, `quality`, `process`, `progress`, `ai`, `intelligence`, `organization`, `collaboration`, `leadership`, `innovation`, `calendar`

### SLIDE_JSON format (no template)

After `DONE: {output_path}`, print:

```
SLIDE_JSON: [{"fn": "title_slide", "args": {"title": "...", "subtitle": "..."}}, ...]
```

One object per function call, only args you passed, no markdown fences.

---

## Save (both paths)

```python
import os
prs.save(output_path)
assert os.path.exists(output_path), f'Save failed: {output_path}'
print(f'DONE: {output_path} ({os.path.getsize(output_path):,} bytes)')
```
