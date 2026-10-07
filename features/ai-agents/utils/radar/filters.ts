import { FilteredResponsePaper, ResponsePaper } from '@/features/ai-agents/types/radar/researchAgent';
import logger from '@/server/logger';

export function filterByInstitution(papers: ResponsePaper[], institutions: string[]): FilteredResponsePaper[] {
  const filteredPapers: FilteredResponsePaper[] = [];

  papers.forEach((paper) => {
    // Create set from authors' affiliation(s)
    const papersInstitutionsSet: Set<string> = new Set();
    paper.author
      .forEach((author) => {
        if (author['arxiv:affiliation']?.['#text']) {
          const affiliation = author['arxiv:affiliation']['#text'].trim().toLowerCase();
          papersInstitutionsSet.add(affiliation);
        };
      });

    const papersInstitutions = Array.from(papersInstitutionsSet);

    for (const institution of institutions) {
      // Check for institution in paper's institution(s) array
      if (papersInstitutions.includes(institution.trim().toLowerCase())) {
        logger.debug(`Paper ${paper.id} matches institution ${institution}`);
        filteredPapers.push({ ...paper, institutions: papersInstitutions });
        break;
      }

      // Skip short institution names to avoid false positives
      if (institution.length <= 3) {
        continue;
      }

      // Check if the institution is mentioned in the title or summary
      const fullArticleText = `${paper.title} ${paper.summary}`.toLowerCase();
      const startIdx = fullArticleText.indexOf(institution.trim().toLowerCase());
      if (startIdx !== -1) {
        const contextStart = Math.max(0, startIdx - 20);
        const contextEnd = Math.min(fullArticleText.length, startIdx + institution.length + 20);
        const context = fullArticleText.slice(contextStart, contextEnd);

        logger.debug(`Found potential institution match: ${institution}`);
        logger.debug(`Context: ...${context}...`);

        const beforeChar = fullArticleText[startIdx - 1];
        const afterChar = fullArticleText[startIdx + institution.length];

        const isStartOk = startIdx === 0 || !/[A-Za-z0-9]/.test(beforeChar);
        const isEndOk = startIdx + institution.length >= fullArticleText.length || !/[A-Za-z0-9]/.test(afterChar);

        if (isStartOk && isEndOk) {
          logger.debug('Confirmed as institution mention');
          filteredPapers.push({ ...paper, institutions: [institution, ...papersInstitutions] });
          break;
        } else {
          logger.debug('Rejected as likely false positive');
        }
      }
    }
  });

  return filteredPapers;
}
