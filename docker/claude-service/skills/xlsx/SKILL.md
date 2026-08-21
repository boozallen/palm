# XLSX creation

| Task | Approach |
|---|---|
| **Create** with formulas/formatting | `openpyxl` — see gotchas below |
| **Bulk data** | `pandas` (`to_excel`) |

> `openpyxl` and `pandas` are preinstalled — do not run `pip install`.

## Requirements for every output

- **Professional font** (Arial, Times New Roman) throughout, unless the user says otherwise.
- **Zero formula errors.** Write formulas as strings — `sheet['B10'] = '=SUM(B2:B9)'`, not the Python-computed total.
- **Follow the user's spec literally.** Exact tab names, exact column headers.
- **Document every hardcoded number** in an adjacent cell or comment.
- **A workbook you create for someone to fill in** needs a short legend naming which cells to edit, and one example row of realistic values. Never add such a row to a file you were asked to edit.

## Choosing formulas that survive verification

LibreOffice implements fewer functions than Excel.

- **Prefer Excel-2007-era functions** — `SUMIFS`, `INDEX`, `MATCH`, `IFERROR`, `SUMPRODUCT` — no prefix needed.
- **Six post-2007 functions require `_xlfn.` prefix**: `_xlfn.TEXTJOIN`, `_xlfn.CONCAT`, `_xlfn.IFS`, `_xlfn.SWITCH`, `_xlfn.MAXIFS`, `_xlfn.MINIFS`. Written bare, each yields `#NAME?`.
- **Never use `XLOOKUP`, `XMATCH`, `SORT`, `FILTER`, `UNIQUE`, or `SEQUENCE`.** Use `INDEX`/`MATCH` for lookups; sort and filter in Python before writing cells.

## openpyxl gotchas

- **Merged cells: write the top-left anchor only.** Every other cell in the range is read-only.
- **A sheet name containing a space must be quoted** in a cross-sheet reference: `='My Sheet'!$B$5`.
- **`.xlsm` loses macros unless you pass `keep_vba=True`** to `load_workbook`.
- **`openpyxl` writes formulas as strings with no cached values.** Excel recalculates on open — this is fine for delivery.

## Financial models

Unless the user says otherwise.

**Color:** blue text (`0,0,255`) for hardcoded inputs · black for formulas · green (`0,128,0`) for cross-sheet links · yellow fill (`255,255,0`) for cells the user should fill in.

**Numbers:** currency `$#,##0` with unit in header (`Revenue ($mm)`) · zeros render as `-` · negatives in parentheses · percentages `0.0%` stored as fractions (`0.15` renders `15.0%`) · years as text (`"2024"`, never `2,024`).

**Structure:** every assumption in its own labeled cell, referenced by formulas (`=B5*(1+$B$6)`, never `=B5*1.05`) · formulas consistent across every projection period.

## Output instructions

Write the complete `.xlsx` file to the path specified in the task. Use `workbook.save(output_path)`.
Print `DONE: {output_path}` when complete, nothing else.
