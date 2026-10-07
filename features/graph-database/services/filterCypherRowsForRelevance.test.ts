import { filterCypherRowsForRelevance } from './filterCypherRowsForRelevance';
import type { AiRepository } from '@/features/ai-provider/sources/types';

jest.mock('@/server/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const model = { externalId: 'm' };
const makeSource = (text: string): AiRepository =>
  ({ chatCompletion: jest.fn().mockResolvedValue({ text }) } as unknown as AiRepository);

describe('filterCypherRowsForRelevance', () => {
  describe('enumeration intent → strict pass-through (zero row loss)', () => {
    it('passes through "list every" with no LLM call', async () => {
      const rows = [{ name: 'A' }, { name: 'B' }, { name: 'C' }];
      const source = makeSource('{"irrelevant":[{"index":0}]}');
      const out = await filterCypherRowsForRelevance({ subQuestion: 'list every concept in this paper', rows, source, model });
      expect(out.rows).toEqual(rows);
      expect((source.chatCompletion as jest.Mock)).not.toHaveBeenCalled();
    });

    it('passes through "how many" (aggregation phrasing) with no LLM call', async () => {
      const rows = [{ type: 'PERSON', count: 3 }, { type: 'ORG', count: 5 }];
      const source = makeSource('{"irrelevant":[{"index":0}]}');
      const out = await filterCypherRowsForRelevance({ subQuestion: 'how many entities of each type', rows, source, model });
      expect(out.rows).toEqual(rows);
      expect((source.chatCompletion as jest.Mock)).not.toHaveBeenCalled();
    });

    it('passes through a single-row set without an LLM call', async () => {
      const rows = [{ name: 'Solo' }];
      const source = makeSource('{"irrelevant":[{"index":0}]}');
      const out = await filterCypherRowsForRelevance({ subQuestion: 'which company is dominant', rows, source, model });
      expect(out.rows).toEqual(rows);
      expect((source.chatCompletion as jest.Mock)).not.toHaveBeenCalled();
    });
  });

  describe('selective intent → prune', () => {
    it('prunes the rows the judge marks irrelevant and keeps the rest', async () => {
      const rows = [{ name: 'Relevant Co' }, { name: 'Noise Inc' }, { name: 'Another Relevant' }];
      const source = makeSource('{"irrelevant":[{"index":1,"reason":"off-topic"}]}');
      const out = await filterCypherRowsForRelevance({ subQuestion: 'which company builds rockets', rows, source, model });
      expect(out.rows).toEqual([{ name: 'Relevant Co' }, { name: 'Another Relevant' }]);
      expect((source.chatCompletion as jest.Mock)).toHaveBeenCalledTimes(1);
    });

    it('never reduces a non-empty set to zero even if everything is marked irrelevant', async () => {
      const rows = [{ name: 'A' }, { name: 'B' }];
      const source = makeSource('{"irrelevant":[{"index":0},{"index":1}]}');
      const out = await filterCypherRowsForRelevance({ subQuestion: 'which is the single best option', rows, source, model });
      expect(out.rows).toEqual(rows);
    });

    it('ignores out-of-range irrelevant indices', async () => {
      const rows = [{ name: 'A' }, { name: 'B' }];
      const source = makeSource('{"irrelevant":[{"index":5},{"index":-1}]}');
      const out = await filterCypherRowsForRelevance({ subQuestion: 'which is the key player', rows, source, model });
      expect(out.rows).toEqual(rows);
    });
  });

  describe('graceful fallback (keep all)', () => {
    it('keeps all rows when the LLM returns no parseable JSON', async () => {
      const rows = [{ name: 'A' }, { name: 'B' }];
      const source = makeSource('I cannot help with that');
      const out = await filterCypherRowsForRelevance({ subQuestion: 'which is relevant here', rows, source, model });
      expect(out.rows).toEqual(rows);
    });

    it('keeps all rows when the LLM call throws', async () => {
      const rows = [{ name: 'A' }, { name: 'B' }];
      const source = { chatCompletion: jest.fn().mockRejectedValue(new Error('LLM down')) } as unknown as AiRepository;
      const out = await filterCypherRowsForRelevance({ subQuestion: 'which is relevant here', rows, source, model });
      expect(out.rows).toEqual(rows);
    });
  });
});
