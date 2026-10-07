# Word Document Generator

A `.docx` is a ZIP archive of XML files. Choose your approach by task:

| Task | Approach |
|---|---|
| **Create** a new document | Write a `docx` (npm) script — see gotchas below |
| **Edit** an existing document | `unzip` → edit `word/document.xml` → `zip` (docx-js cannot open existing files) |

> `docx` is pre-installed globally — do not run `npm install`. Use `require('docx')`.

---

## Creating with docx-js: gotchas

The model knows the API; these are the footguns:

- **Page size defaults to A4.** Always set US Letter explicitly: `page: { size: { width: 12240, height: 15840 } }` (DXA; 1440 = 1″).
- **Landscape:** pass portrait dimensions and `orientation: PageOrientation.LANDSCAPE` — docx-js swaps width/height internally.
- **Tables need dual widths:** set `columnWidths` on the table AND `width` on every cell, both in `WidthType.DXA` — never percentages (breaks in some viewers). Column widths must sum to the table width.
- **Table shading:** use `ShadingType.CLEAR`, never `SOLID` (renders black).
- **Lists:** never insert `•` literally; use a `numbering` config with `LevelFormat.BULLET`.
- **`ImageRun` requires `type:`** (`"png"`, `"jpg"`, …).
- **`PageBreak` must be inside a `Paragraph`.**
- **Never use `\n`** — use separate `Paragraph` elements.
- **TOC:** headings must use built-in `HeadingLevel.*`; custom heading styles need `outlineLevel` set or they won't appear.
- **Don't use a table as a horizontal rule** — use a paragraph bottom border instead.
- **Dot-leader / right-aligned tab on same line:** use `PositionalTab` (`alignment: PositionalTabAlignment.RIGHT`, `leader: PositionalTabLeader.DOT`) inside a `TextRun`, not literal dots or space padding.
- **Smart quotes**: use XML entities — `&#x201C;` / `&#x201D;` for `"` / `"`, `&#x2018;` / `&#x2019;` for `'` / `'`.

---

## Script structure

Always set Calibri as the default font — it is Word's standard font and renders correctly in all viewers:

```javascript
const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
        AlignmentType, WidthType, BorderStyle, LevelFormat, PageOrientation } = require('docx');
const fs = require('fs');

const doc = new Document({
    styles: {
        default: {
            document: {
                run: { font: 'Calibri', size: 24 },  // 12pt — size is in half-points
            },
        },
    },
    sections: [{ properties: { page: { size: { width: 12240, height: 15840 } } }, children: [...] }],
});

Packer.toBuffer(doc).then(buf => {
    fs.writeFileSync(OUTPUT_PATH, buf);
    console.log('DONE: ' + OUTPUT_PATH);
});
```

---

## Verify the output

After writing a `.docx`, always render it to PDF and read the images to catch visual errors:

```bash
soffice --headless --convert-to pdf --outdir /tmp output.docx
pdftoppm -jpeg -r 100 /tmp/output.pdf /tmp/page
ls /tmp/page-*.jpg   # then read each image to verify layout
```

If the output looks wrong, fix the script and regenerate.

---

## Editing existing documents

`docx-js` cannot open existing `.docx` files — always use the unzip/XML/rezip approach:

```bash
SKILL_DIR=$(dirname $(realpath $0)) || SKILL_DIR=/app/skills/document
unzip -q input.docx -d /tmp/unpacked/
python $SKILL_DIR/merge_runs.py /tmp/unpacked/
# edit /tmp/unpacked/word/document.xml in place — do NOT reformat or pretty-print the XML
(cd /tmp/unpacked && rm -f /tmp/out.docx && zip -Xr /tmp/out.docx .)
```

`merge_runs.py` coalesces adjacent identically-formatted `<w:r>` runs so the text you are looking for exists as a contiguous string in the XML. Always run it before editing.

Key XML facts:
- Text is in `<w:t>` elements inside `<w:r>` runs inside `<w:p>` paragraphs
- `xml:space="preserve"` is required on `<w:t>` when text starts/ends with whitespace
- Do NOT reformat or pretty-print `document.xml` — whitespace inside `<w:t>` is content
- After editing, verify the zip contains `[Content_Types].xml` at root

---

## Headings

```javascript
new Paragraph({
    text: 'Section Title',
    heading: HeadingLevel.HEADING_1,
})
```

---

## Bullet lists

```javascript
const doc = new Document({
    numbering: {
        config: [{
            reference: 'bullet-list',
            levels: [{
                level: 0,
                format: LevelFormat.BULLET,
                text: '•',
                alignment: AlignmentType.LEFT,
                style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            }],
        }],
    },
    sections: [...],
});

new Paragraph({
    text: 'Bullet item',
    numbering: { reference: 'bullet-list', level: 0 },
})
```

---

## Tables

Use tables for comparisons, option matrices, and command references — not bullet lists.

```javascript
new Table({
    columnWidths: [4500, 4500],  // DXA — must sum to page width minus margins
    rows: [
        new TableRow({
            children: [
                new TableCell({
                    width: { size: 4500, type: WidthType.DXA },
                    children: [new Paragraph({ text: 'Header A' })],
                }),
                new TableCell({
                    width: { size: 4500, type: WidthType.DXA },
                    children: [new Paragraph({ text: 'Header B' })],
                }),
            ],
            tableHeader: true,
        }),
    ],
})
```

---

## Length guidance

| Signal | Target |
|---|---|
| "brief", "one-pager", "executive summary", "short" | 1–2 sections, ~500 words, no cover page |
| "memo", "quick note" | 1 section, no cover page |
| "report", "analysis", "comprehensive" | As many sections as needed |
| Explicit page count ("3 pages") | Target that page count at ~500 words/page |

When in doubt, be concise.

---

## Cover page

For formal reports only — a simple first page with title, author, date as large centered text.

- **No company branding, logos, or colors.** Black text on white only.
- Do not add decorative shapes, colored rectangles, or any graphic elements.
- Skip for briefs, memos, and short documents.

---

## Output instructions

Write the complete `.docx` file to the path specified in the task.
Print `DONE: {output_path}` when complete, nothing else.
