// Plain ES5 so it runs in any browser; without it every page, grouping, and topic shows stacked.
export const DASHBOARD_SCRIPT = `
(function () {
  function toArray(list) { return Array.prototype.slice.call(list); }
  var tablist = document.querySelector('[role="tablist"]');
  var tabs = toArray(document.querySelectorAll('[data-tab]'));
  var pages = toArray(document.querySelectorAll('[data-page]'));
  if (!tablist || tabs.length === 0 || pages.length === 0) { return; }
  var groupOptions = toArray(document.querySelectorAll('[data-group-option]'));
  var groupPanels = toArray(document.querySelectorAll('[data-group]'));
  var topicOptions = toArray(document.querySelectorAll('[data-topic-option]'));
  var topicPanels = toArray(document.querySelectorAll('[data-topic]'));
  var showing = document.querySelector('[data-group-showing-label]');
  var firstPage = pages[0].getAttribute('data-page');
  var state = { page: firstPage, group: '0', topic: '1' };

  function has(elements, attribute, value) {
    return elements.some(function (element) { return element.getAttribute(attribute) === value; });
  }
  function parse(hash) {
    var parts = hash.replace(/^#/, '').split('/');
    if (!has(pages, 'data-page', parts[0])) { return { page: firstPage }; }
    var next = { page: parts[0] };
    if (parts[0] === 'deeper' && has(groupPanels, 'data-group', parts[1])) { next.group = parts[1]; }
    if (parts[0] === 'insights' && has(topicPanels, 'data-topic', parts[1])) { next.topic = parts[1]; }
    return next;
  }
  function choose(elements, attribute, value, ariaState) {
    elements.forEach(function (element) {
      var on = element.getAttribute(attribute) === value;
      element.setAttribute(ariaState, on ? 'true' : 'false');
      element.setAttribute('tabindex', on ? '0' : '-1');
    });
  }
  function reveal(panels, attribute, value) {
    panels.forEach(function (panel) { panel.hidden = panel.getAttribute(attribute) !== value; });
  }
  function render() {
    reveal(pages, 'data-page', state.page);
    choose(tabs, 'data-tab', state.page, 'aria-selected');
    reveal(groupPanels, 'data-group', state.group);
    choose(groupOptions, 'data-group-option', state.group, 'aria-checked');
    reveal(topicPanels, 'data-topic', state.topic);
    choose(topicOptions, 'data-topic-option', state.topic, 'aria-checked');
    groupOptions.forEach(function (option) {
      if (showing && option.getAttribute('data-group-option') === state.group) { showing.textContent = option.textContent; }
    });
  }
  function apply(hash) {
    var next = parse(hash);
    state.page = next.page;
    if (next.group !== undefined) { state.group = next.group; }
    if (next.topic !== undefined) { state.topic = next.topic; }
    render();
  }
  function current() {
    if (state.page === 'deeper') { return '#deeper/' + state.group; }
    if (state.page === 'insights') { return '#insights/' + state.topic; }
    return '#' + state.page;
  }
  function go(hash) {
    apply(hash);
    if (window.location.hash !== current()) { window.history.pushState(null, '', current()); }
  }

  document.addEventListener('click', function (event) {
    var target = event.target && event.target.closest
      ? event.target.closest('a[href^="#"], [data-group-option], [data-topic-option]')
      : null;
    if (!target) { return; }
    var hash;
    if (target.hasAttribute('data-group-option')) {
      hash = '#deeper/' + target.getAttribute('data-group-option');
    } else if (target.hasAttribute('data-topic-option')) {
      hash = '#insights/' + target.getAttribute('data-topic-option');
    } else {
      hash = target.getAttribute('href');
      if (!has(pages, 'data-page', hash.replace(/^#/, '').split('/')[0])) { return; }
    }
    event.preventDefault();
    go(hash);
    if (target.hasAttribute('data-topic-link') && tablist.scrollIntoView) { tablist.scrollIntoView(); }
  });

  document.addEventListener('keydown', function (event) {
    var target = event.target && event.target.closest ? event.target.closest('[role="tab"], [role="radio"]') : null;
    if (!target) { return; }
    var siblings = target.getAttribute('role') === 'tab'
      ? tabs
      : toArray(target.parentNode.querySelectorAll('[role="radio"]'));
    var index = siblings.indexOf(target);
    var next = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') { next = siblings[(index + 1) % siblings.length]; }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') { next = siblings[(index - 1 + siblings.length) % siblings.length]; }
    if (event.key === 'Home') { next = siblings[0]; }
    if (event.key === 'End') { next = siblings[siblings.length - 1]; }
    if (!next) { return; }
    event.preventDefault();
    next.focus();
    next.click();
  });

  window.addEventListener('hashchange', function () { apply(window.location.hash); });
  window.addEventListener('popstate', function () { apply(window.location.hash); });
  document.documentElement.classList.add('js');
  apply(window.location.hash);
})();
`;
