# PPTX Generation with python-pptx

All presentations are created with **python-pptx**. Write a single Python script and execute with `python3 script.py`.

## Workflow — FOLLOW THIS EXACTLY

Complete the entire task in **under 15 tool calls**:

1. **Write the script** — one complete Python file. Include icons (see below).
2. **Run it** — `python3 script.py`. Fix errors if needed (counts as 1 retry).
3. **Validate** — `python /app/skills/pptx/scripts/office/validate.py output.pptx`. Fix any structural errors.
4. **Done** — print `DONE: {path}`.

**Do NOT:**
- Unpack .pptx files or edit raw XML
- Write pixel-analysis code (numpy, PIL variance checks, etc.)
- Rewrite the entire script from scratch — make targeted fixes only
- Exceed 2 iterations of the generate→validate loop
- Convert to PDF/images or do visual inspection — that is handled externally
- Explore the template file (layouts are provided in your prompt)

## python-pptx Essentials

```python
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN

# From scratch (no template)
prs = Presentation()
prs.slide_width = Inches(13.33)
prs.slide_height = Inches(7.5)
blank_layout = prs.slide_layouts[6]

# With template (template path provided in prompt)
prs = Presentation("template.pptx")
```

### Key patterns

```python
# Add a slide
slide = prs.slides.add_slide(blank_layout)

# Set background
bg = slide.background.fill
bg.solid()
bg.fore_color.rgb = RGBColor(0x1E, 0x27, 0x61)

# Add text box
tf = slide.shapes.add_textbox(Inches(0.8), Inches(1.5), Inches(8), Inches(1.2)).text_frame
tf.word_wrap = True
p = tf.paragraphs[0]
p.text = "Title Text"
p.font.size = Pt(44)
p.font.bold = True
p.font.name = "Calibri"
p.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)

# Multi-paragraph (bullets)
tf = slide.shapes.add_textbox(Inches(0.8), Inches(3.0), Inches(11), Inches(3.0)).text_frame
tf.word_wrap = True
for i, text in enumerate(items):
    p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
    p.text = text
    p.font.size = Pt(14)
    p.font.name = "Calibri"
    p.font.color.rgb = RGBColor(0x44, 0x44, 0x44)
    p.space_after = Pt(8)

# Add shape
shape = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(1), Inches(2), Inches(4), Inches(3))
shape.fill.solid()
shape.fill.fore_color.rgb = RGBColor(0xCA, 0xDC, 0xFC)
shape.line.fill.background()  # no border

# Add picture
slide.shapes.add_picture("icon.png", Inches(1), Inches(2), Inches(0.5), Inches(0.5))

# Save
prs.save("output.pptx")
```

### Gotchas

- **Always set `font.name` on every text run** — python-pptx does not inherit fonts from the theme for manually-added text boxes.
- **Always set `font.size` on every text run** — unsized text renders at 18pt (the default), not what you expect.
- **Use `prs.slide_layouts[6]`** (blank layout) for scratch decks — other layouts have placeholder shapes you don't want.
- **`shape.line.fill.background()`** removes borders — don't use `shape.line.color` to try to make it "invisible."
- **`tf.word_wrap = True`** is required for multi-line text boxes — without it text overflows.
- **`RGBColor` takes hex bytes** — `RGBColor(0xFF, 0x00, 0x00)` for red, not strings.
- **Slide dimensions** — set `prs.slide_width` and `prs.slide_height` BEFORE adding slides when creating from scratch.

## Icons — react-icons via Node.js

**Every slide MUST have a visual element** — not just shapes and text. Use react-icons rendered to PNG:

```python
import subprocess, os

icon_script = """
const React = require('react');
const ReactDOMServer = require('react-dom/server');
const { GiArtificialIntelligence } = require('react-icons/gi');
const sharp = require('sharp');
const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(GiArtificialIntelligence, {color: '#CADCFC', size: 256}));
sharp(Buffer.from(svg)).resize(256).png().toBuffer().then(b => process.stdout.write(b));
"""
result = subprocess.run(
    ['node', '-e', icon_script], capture_output=True,
    env={**os.environ, 'NODE_PATH': '/usr/local/lib/node_modules'},
)
with open('/tmp/icon.png', 'wb') as f:
    f.write(result.stdout)
slide.shapes.add_picture('/tmp/icon.png', Inches(1), Inches(2), Inches(0.5), Inches(0.5))
```

Available icon sets: `react-icons/gi` (game/food), `react-icons/fa` (FontAwesome), `react-icons/md` (Material), `react-icons/fi` (Feather). Use icons that match the topic.

## Design Ideas

**Don't create boring slides.** Plain bullets on a white background won't impress anyone.

### Before Starting

- **Pick a bold, content-informed color palette**: specific to THIS topic, not generic.
- **Dominance over equality**: one color 60-70% visual weight, 1-2 supporting, one sharp accent.
- **Dark/light contrast**: dark backgrounds for title + conclusion, light for content. Or commit to dark throughout.
- **Commit to a visual motif**: ONE distinctive element repeated across every slide (rounded image frames, icons in colored circles, etc.). **Not** a color bar or accent stripe.

### Color Palettes

Choose colors that match your topic — don't default to generic blue:

| Theme | Primary | Secondary | Accent |
|-------|---------|-----------|--------|
| **Midnight Executive** | `1E2761` (navy) | `CADCFC` (ice blue) | `FFFFFF` (white) |
| **Forest & Moss** | `2C5F2D` (forest) | `97BC62` (moss) | `F5F5F5` (cream) |
| **Coral Energy** | `F96167` (coral) | `F9E795` (gold) | `2F3C7E` (navy) |
| **Warm Terracotta** | `B85042` (terracotta) | `E7E8D1` (sand) | `A7BEAE` (sage) |
| **Ocean Gradient** | `065A82` (deep blue) | `1C7293` (teal) | `21295C` (midnight) |
| **Charcoal Minimal** | `36454F` (charcoal) | `F2F2F2` (off-white) | `212121` (black) |
| **Teal Trust** | `028090` (teal) | `00A896` (seafoam) | `02C39A` (mint) |
| **Berry & Cream** | `6D2E46` (berry) | `A26769` (dusty rose) | `ECE2D0` (cream) |
| **Sage Calm** | `84B59F` (sage) | `69A297` (eucalyptus) | `50808E` (slate) |
| **Cherry Bold** | `990011` (cherry) | `FCF6F5` (off-white) | `2F3C7E` (navy) |

### For Each Slide

**Every slide needs a visual element** — image, chart, icon, or shape. Text-only slides are forgettable.

**Layout options:**
- Two-column (text left, illustration right)
- Icon + text rows (icon in colored circle, bold header, description below)
- 2x2 or 2x3 grid (image one side, content blocks other)
- Half-bleed image with content overlay

**Data display:**
- Large stat callouts (big numbers 60-72pt with small labels below)
- Comparison columns (before/after, pros/cons)
- Timeline or process flow (numbered steps, arrows)

**Visual polish:**
- Icons in small colored circles next to section headers
- Italic accent text for key stats or taglines

### Typography

**Font names are rendered by the user's PowerPoint, not this environment.**

- **Safe fonts** (render true-to-width in QA and ship with Office): **Arial, Calibri, Cambria, Times New Roman, Courier New**
- **Headers with personality**: pair a serif header (Cambria) with a sans body (Calibri or Arial)
- **Never default to Aptos** — missing from older Office installs

| Element | Size |
|---------|------|
| Slide title | 36-44pt bold |
| Section header | 20-24pt bold |
| Body text | 14-16pt |
| Captions | 10-12pt muted |

### Spacing

- 0.5" minimum margins
- 0.3-0.5" between content blocks
- Leave breathing room — don't fill every inch

### Avoid (Common Mistakes)

- **Don't repeat the same layout** — vary columns, cards, and callouts across slides
- **Don't center body text** — left-align paragraphs and lists; center only titles
- **Don't skimp on size contrast** — titles need 36pt+ to stand out from 14-16pt body
- **Don't default to blue** — pick colors that reflect the specific topic
- **Don't mix spacing randomly** — use 0.3" or 0.5" gaps consistently
- **Don't style one slide and leave the rest plain** — commit fully
- **Don't create text-only slides** — add images, icons, charts, or visual elements
- **Don't use low-contrast elements** — icons AND text need strong contrast
- **NEVER use accent lines under titles** — hallmark of AI-generated slides
- **NEVER add decorative color bars or accent stripes** — these read as AI filler. Use background tint or drop shadow instead.
- **Don't default to cream/beige backgrounds** — use white or the palette
- **Don't ship text that overflows its shape** — reduce font size, split across slides, or enlarge container

## QA (Required)

Run structural validation after generating the file:

```bash
python /app/skills/pptx/scripts/office/validate.py output.pptx
```

Fix any errors before declaring success. Do NOT convert to images or do visual inspection — that is handled externally.

## Final Output

After validation passes:
```
DONE: {output_path}
```
