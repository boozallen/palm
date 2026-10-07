import { fireEvent, render, screen } from '@testing-library/react';

import Breadcrumbs from './Breadcrumbs';
import { AuditRecordEvent } from '@/features/shared/types/audit-record';

const mockCreateAuditRecord = jest.fn();

jest.mock('@/features/shared/api/create-client-side-audit-record', () => ({
  useCreateClientSideAuditRecord: jest.fn(() => ({ mutate: mockCreateAuditRecord })),
}));

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

  it('records a navigation audit record with the destination href when a link is clicked', () => {
    addLink('Prompt Library', '/library');

    render(<Breadcrumbs links={links} />);

    fireEvent.click(screen.getByRole('link'));

    expect(mockCreateAuditRecord).toHaveBeenCalledWith({
      event: AuditRecordEvent.Navigation,
      label: 'Prompt Library',
      href: '/library',
    });
  });

  it('does not record an audit record for the current (non-link) breadcrumb', () => {
    addLink('Prompt Library', '/library');
    addLink('Edit', null);

    render(<Breadcrumbs links={links} />);

    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(mockCreateAuditRecord).not.toHaveBeenCalled();
  });
});
