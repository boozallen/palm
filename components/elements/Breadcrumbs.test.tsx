import { render, screen } from '@testing-library/react';

import Breadcrumbs from './Breadcrumbs';

let links: Array<{title: string, href: string | null }> = [];
const resetLinks = () => links = [];
const addLink = (title: string, href: string | null) => {
  links.push({ title, href });
};

describe('Breadcrumbs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetLinks();
  });

  it('renders links as links with correct href and title', () => {
    addLink('Test 1', '/test1');
    addLink('Test 2', '/test2');
    addLink('Test 3', '/test3');

    render(<Breadcrumbs links={links} />);

    const renderedLinks = screen.getAllByRole('link');

    expect(renderedLinks).toHaveLength(links.length);

    renderedLinks.forEach((link, index) => {
      expect(link).toHaveTextContent(links[index].title);
      expect(link).toHaveAttribute('href', links[index].href);
    });
  });

  it('does not render a link element if href is null', () => {
    addLink('Test 1', null);

    render(<Breadcrumbs links={links} />);

    const renderedLinks = screen.queryAllByRole('link');

    expect(renderedLinks).toHaveLength(0);
  });
});
