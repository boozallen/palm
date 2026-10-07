// Light, print-friendly theme shared by the dashboard, executive summary, and slides.
export const PULSE_OUTPUT_COLORS = {
  page: '#ffffff',
  surface: '#fcfcfb',
  ink: '#0b0b0b',
  inkSecondary: '#52514e',
  inkMuted: '#898781',
  grid: '#e1e0d9',
  baseline: '#c3c2b7',
  border: '#e1e0d9',
  accent: '#2a78d6',
  fallback: '#b5b3ab',
  bannerBackground: '#fdf3dc',
  bannerBorder: '#fab219',
  inkOnDark: '#ffffff',
} as const;

// Categorical order validated for adjacent CVD separation; never cycled past eight.
export const PULSE_SERIES_COLORS: readonly string[] = [
  '#2a78d6',
  '#eb6834',
  '#1baf7a',
  '#eda100',
  '#e87ba4',
  '#008300',
  '#4a3aa7',
  '#e34948',
];

// Text color for a label drawn inside each series fill, chosen by the fill's luminance.
export const PULSE_SERIES_LABEL_INK: readonly string[] = [
  '#ffffff',
  '#0b0b0b',
  '#0b0b0b',
  '#0b0b0b',
  '#0b0b0b',
  '#ffffff',
  '#ffffff',
  '#0b0b0b',
];

export const PULSE_OTHER_COLOR = '#d6d4cc';

export const PULSE_OTHER_LABEL_INK = '#0b0b0b';

export const PULSE_FONT_STACK = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const C = PULSE_OUTPUT_COLORS;

export const PULSE_BASE_CSS = `
*, *::before, *::after { box-sizing: border-box; }
html { color-scheme: light; }
body {
  margin: 0;
  background: ${C.page};
  color: ${C.ink};
  font-family: ${PULSE_FONT_STACK};
  font-size: 15px;
  line-height: 1.5;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
h1, h2, h3 { line-height: 1.25; margin: 0 0 8px; font-weight: 600; }
h1 { font-size: 26px; }
h2 { font-size: 20px; margin-top: 32px; }
h3 { font-size: 16px; }
p { margin: 0 0 12px; }
a { color: ${C.accent}; }
.meta { color: ${C.inkSecondary}; font-size: 14px; }
.muted { color: ${C.inkMuted}; }
.headline { font-size: 22px; font-weight: 600; margin: 24px 0 12px; }
.banner {
  margin: 16px 0;
  padding: 12px 16px;
  background: ${C.bannerBackground};
  border-left: 4px solid ${C.bannerBorder};
  border-radius: 4px;
  color: ${C.ink};
}
.findings, .actions { padding-left: 20px; margin: 0 0 12px; }
.findings li, .actions li { margin-bottom: 10px; }
.cited { color: ${C.inkSecondary}; font-size: 13px; }
.figure-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(420px, 1fr)); gap: 16px; }
figure.column, figure.breakdown {
  margin: 0 0 16px;
  padding: 16px;
  background: ${C.surface};
  border: 1px solid ${C.border};
  border-radius: 8px;
  break-inside: avoid;
  page-break-inside: avoid;
}
figure figcaption h3 { margin: 0 0 2px; }
.answered { color: ${C.inkSecondary}; font-size: 13px; margin: 0 0 8px; }
.summary { margin: 4px 0 8px; }
.note { color: ${C.inkSecondary}; font-size: 14px; margin: 8px 0 0; }
svg.chart { display: block; width: 100%; height: auto; max-width: 640px; overflow: visible; }
svg.chart text { font-family: ${PULSE_FONT_STACK}; font-size: 12px; fill: ${C.inkSecondary}; }
svg.chart text.axis { fill: ${C.inkMuted}; font-size: 11px; font-variant-numeric: tabular-nums; }
svg.chart text.value { fill: ${C.inkSecondary}; }
svg.chart text.category { fill: ${C.ink}; }
svg.chart line.grid { stroke: ${C.grid}; stroke-width: 1; }
svg.chart line.baseline { stroke: ${C.baseline}; stroke-width: 1; }
.legend { list-style: none; display: flex; flex-wrap: wrap; gap: 4px 16px; padding: 0; margin: 0 0 8px; font-size: 13px; color: ${C.inkSecondary}; }
.legend-item { display: inline-flex; align-items: center; gap: 6px; }
.swatch { display: inline-block; width: 10px; height: 10px; border-radius: 2px; }
details.data-table { margin-top: 8px; font-size: 13px; }
details.data-table summary { cursor: pointer; color: ${C.inkSecondary}; }
table { border-collapse: collapse; margin-top: 6px; font-variant-numeric: tabular-nums; }
caption { text-align: left; color: ${C.inkSecondary}; padding-bottom: 4px; }
th, td { text-align: left; padding: 4px 12px 4px 0; border-bottom: 1px solid ${C.grid}; vertical-align: top; }
th { color: ${C.inkSecondary}; font-weight: 600; }
td.number, th.number { text-align: right; }
blockquote.quote {
  margin: 0 0 12px;
  padding: 8px 16px;
  border-left: 3px solid ${C.baseline};
  color: ${C.ink};
}
blockquote.quote footer { color: ${C.inkMuted}; font-size: 13px; margin-top: 4px; }
.method li { margin-bottom: 6px; color: ${C.inkSecondary}; }
@media print {
  details.data-table { display: none; }
  h2 { break-after: avoid; page-break-after: avoid; }
}
`;
