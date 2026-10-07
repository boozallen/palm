import {
  PULSE_BASE_CSS,
  PULSE_OUTPUT_COLORS,
} from '@/features/ai-agents/utils/pulse/results/theme';

const C = PULSE_OUTPUT_COLORS;

export const DASHBOARD_CSS = `${PULSE_BASE_CSS}
main { max-width: 1120px; margin: 0 auto; padding: 32px 24px 64px; }
section { margin-top: 24px; }
.tabs { display: flex; flex-wrap: wrap; gap: 4px; margin: 20px 0 0; border-bottom: 1px solid ${C.border}; }
.tabs a { padding: 10px 16px; color: ${C.inkSecondary}; text-decoration: none; border-bottom: 3px solid transparent; margin-bottom: -1px; font-weight: 600; }
.tabs a[aria-selected="true"] { color: ${C.ink}; border-bottom-color: ${C.accent}; }
.page { padding-top: 8px; }
.page-title { margin-top: 32px; }
html.js .page-title, html.js .group-heading { display: none; }
.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin: 16px 0 24px; }
.kpi { padding: 16px; background: ${C.surface}; border: 1px solid ${C.border}; border-radius: 8px; overflow-wrap: anywhere; }
.kpi-value { display: block; font-size: 30px; font-weight: 600; font-variant-numeric: tabular-nums; }
.kpi-label { display: block; color: ${C.inkSecondary}; font-size: 14px; }
.tone-lists { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; }
.tone-list { margin-top: 0; padding: 16px; border: 1px solid ${C.border}; border-left: 4px solid ${C.baseline}; border-radius: 8px; }
.tone-list h2 { margin-top: 0; font-size: 17px; }
.tone-list ul { margin: 0; padding-left: 20px; }
.tone-list li { margin-bottom: 6px; overflow-wrap: anywhere; }
.tone-positive { border-left-color: ${C.accent}; }
.tone-concern { border-left-color: ${C.bannerBorder}; }
[data-part="charts"] { margin-top: 24px; }
.selector { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; margin: 12px 0; }
.selector-label { color: ${C.inkSecondary}; font-size: 14px; font-weight: 600; }
.options { display: flex; flex-wrap: wrap; gap: 8px; }
.option {
  font: inherit;
  font-size: 14px;
  padding: 6px 14px;
  max-width: 100%;
  text-align: left;
  overflow-wrap: anywhere;
  color: ${C.ink};
  background: ${C.page};
  border: 1px solid ${C.baseline};
  border-radius: 999px;
  cursor: pointer;
}
.option[aria-checked="true"] { color: ${C.inkOnDark}; background: ${C.accent}; border-color: ${C.accent}; }
.option:focus-visible, .tabs a:focus-visible { outline: 2px solid ${C.accent}; outline-offset: 2px; }
html:not(.js) .selector, html:not(.js) .showing { display: none; }
.showing { margin-bottom: 16px; }
.group-panel, .topic-panel { margin-bottom: 24px; }
.topic-panel { padding: 20px; border: 1px solid ${C.border}; border-radius: 8px; }
.topic-panel h2 { margin-top: 0; overflow-wrap: anywhere; }
.topic-panel section { margin-top: 16px; }
.caveat { margin-top: 16px; padding: 10px 14px; background: ${C.bannerBackground}; border-left: 4px solid ${C.bannerBorder}; border-radius: 4px; }
.actions strong { display: block; }
details.appendix { margin-top: 24px; }
details.appendix > summary { cursor: pointer; font-weight: 600; margin-bottom: 12px; }
@media print {
  .tabs, .selector, .showing { display: none; }
  .page[hidden], .group-panel[hidden], .topic-panel[hidden] { display: block !important; }
  html.js .page-title, html.js .group-heading { display: block; }
  details.appendix > summary { display: none; }
  details.appendix > *:not(summary) { display: block; }
}
`;
