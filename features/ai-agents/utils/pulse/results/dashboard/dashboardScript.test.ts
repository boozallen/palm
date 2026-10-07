import renderInteractiveDashboard from '@/features/ai-agents/utils/pulse/results/dashboard/renderInteractiveDashboard';
import { DASHBOARD_SCRIPT } from '@/features/ai-agents/utils/pulse/results/dashboard/dashboardScript';
import { buildTwoGroupingInput } from '@/features/ai-agents/utils/pulse/results/testFixtures';

type Listener = { target: EventTarget; type: string; listener: EventListenerOrEventListenerObject };

const listeners: Listener[] = [];
const addDocumentListener = document.addEventListener.bind(document);
const addWindowListener = window.addEventListener.bind(window);

function mountDashboard(hash = ''): void {
  window.history.replaceState(null, '', hash === '' ? window.location.pathname : hash);
  const parsed = new DOMParser().parseFromString(renderInteractiveDashboard(buildTwoGroupingInput()), 'text/html');
  document.body.innerHTML = parsed.body.innerHTML;
  document.body.querySelectorAll('script').forEach((element) => element.remove());
  const script = document.createElement('script');
  script.textContent = DASHBOARD_SCRIPT;
  document.body.appendChild(script);
}

function visible(attribute: string): string[] {
  return Array.from(document.querySelectorAll<HTMLElement>(`[${attribute}]`))
    .filter((element) => !element.hidden)
    .map((element) => element.getAttribute(attribute) ?? '');
}

function element(selector: string): HTMLElement {
  const found = document.querySelector<HTMLElement>(selector);

  if (found === null) {
    throw new Error(`Nothing matches ${selector}`);
  }

  return found;
}

describe('DASHBOARD_SCRIPT', () => {
  beforeEach(() => {
    jest.spyOn(document, 'addEventListener').mockImplementation((type, listener, options) => {
      listeners.push({ target: document, type, listener });
      addDocumentListener(type, listener, options);
    });
    jest.spyOn(window, 'addEventListener').mockImplementation((type, listener, options) => {
      listeners.push({ target: window, type, listener });
      addWindowListener(type, listener, options);
    });
  });

  afterEach(() => {
    listeners.splice(0).forEach(({ target, type, listener }) => target.removeEventListener(type, listener));
    jest.restoreAllMocks();
    document.documentElement.classList.remove('js');
    document.body.innerHTML = '';
  });

  it('opens on the overview with only that page showing', () => {
    mountDashboard();

    expect(document.documentElement.classList.contains('js')).toBe(true);
    expect(visible('data-page')).toEqual(['overview']);
    expect(element('[data-tab="overview"]').getAttribute('aria-selected')).toBe('true');
  });

  it('opens the topic a link names', () => {
    mountDashboard('#insights/2');

    expect(visible('data-page')).toEqual(['insights']);
    expect(visible('data-topic')).toEqual(['2']);
    expect(element('[data-topic-option="2"]').getAttribute('aria-checked')).toBe('true');
  });

  it('opens the grouping a link names and says which it is', () => {
    mountDashboard('#deeper/1');

    expect(visible('data-page')).toEqual(['deeper']);
    expect(visible('data-group')).toEqual(['1']);
    expect(element('[data-group-showing-label]').textContent).toBe('B – Region');
  });

  it('falls back to the overview for a link it does not recognize', () => {
    mountDashboard('#column-3');

    expect(visible('data-page')).toEqual(['overview']);
  });

  it('opens the first topic when a link names one that does not exist', () => {
    mountDashboard('#insights/99');

    expect(visible('data-page')).toEqual(['insights']);
    expect(visible('data-topic')).toEqual(['1']);
  });

  it('switches page from a tab and records it in the address', () => {
    mountDashboard();
    element('[data-tab="insights"]').click();

    expect(visible('data-page')).toEqual(['insights']);
    expect(element('[data-tab="insights"]').getAttribute('aria-selected')).toBe('true');
    expect(element('[data-tab="overview"]').getAttribute('aria-selected')).toBe('false');
    expect(window.location.hash).toBe('#insights/1');
  });

  it('switches topic from its chip', () => {
    mountDashboard('#insights');
    element('[data-topic-option="3"]').click();

    expect(visible('data-topic')).toEqual(['3']);
    expect(window.location.hash).toBe('#insights/3');
  });

  it('remembers the chosen grouping when the reader comes back to the page', () => {
    mountDashboard('#deeper');
    element('[data-group-option="1"]').click();
    element('[data-tab="overview"]').click();
    element('[data-tab="deeper"]').click();

    expect(visible('data-group')).toEqual(['1']);
    expect(window.location.hash).toBe('#deeper/1');
  });

  it('opens a topic from the overview\'s finding lists', () => {
    mountDashboard();
    element('[data-tone-list="concern"] a').click();

    expect(visible('data-page')).toEqual(['insights']);
    expect(visible('data-topic')).toEqual(['3']);
  });

  it('moves between tabs with the arrow keys', () => {
    mountDashboard();
    const tab = element('[data-tab="overview"]');
    tab.focus();
    tab.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

    expect(visible('data-page')).toEqual(['deeper']);
    expect(document.activeElement).toBe(element('[data-tab="deeper"]'));
  });

  it('wraps from the last topic to the first with the arrow keys', () => {
    mountDashboard('#insights/3');
    element('[data-topic-option="3"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

    expect(visible('data-topic')).toEqual(['1']);
  });

  it('follows the address when the reader goes back', () => {
    mountDashboard('#insights/2');
    window.history.replaceState(null, '', '#overview');
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    expect(visible('data-page')).toEqual(['overview']);
  });
});
