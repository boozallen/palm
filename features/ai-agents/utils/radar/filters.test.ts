import { ResponsePaper } from '@/features/ai-agents/types/radar/researchAgent';
import { filterByInstitution } from './filters';

const mockPapers = [
  {
    id: '1',
    title: 'Title 1',
    summary: 'Summary 1',
    author: [{
      'arxiv:affiliation': {
        '#text': 'Institution A',
      },
    }],
  },
  {
    id: '2',
    title: 'Title 2',
    summary: 'Summary 2',
    author: [{
      'arxiv:affiliation': {
        '#text': 'Institution B',
      },
    }],
  },
  {
    id: '3',
    title: 'Title 3',
    summary: 'Summary 3',
    author: [{
      'arxiv:affiliation': {
        '#text': 'Institution C',
      },
    }],
  },
] as unknown as ResponsePaper[];

describe('filterByInstitution', () => {

  it('should filter papers by exact institution match', () => {
    const institutions = ['Institution A'];
    const filteredPapers = filterByInstitution(mockPapers, institutions);
    expect(filteredPapers.length).toBe(1);
    expect(filteredPapers[0].id).toBe('1');
  });

  it('should filter papers by partial institution match in title or summary', () => {
    const institutions = ['Title 2'];
    const filteredPapers = filterByInstitution(mockPapers, institutions);
    expect(filteredPapers.length).toBe(1);
    expect(filteredPapers[0].id).toBe('2');
  });

  it('should not filter papers if no institutions match', () => {
    const institutions = ['Nonexistent Institution'];
    const filteredPapers = filterByInstitution(mockPapers, institutions);
    expect(filteredPapers.length).toBe(0);
  });

  it('should handle empty institution list', () => {
    const institutions: string[] = [];
    const filteredPapers = filterByInstitution(mockPapers, institutions);
    expect(filteredPapers.length).toBe(0);
  });
});
