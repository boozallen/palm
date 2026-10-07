import classifyUseCase, {
  buildUseCaseSqlFilter,
  getUseCaseAliases,
} from '@/features/context-studio/services/useCaseTaxonomy';
import { UseCase, USE_CASE_LABELS, USE_CASE_ORDER } from '@/features/shared/types/use-case';

// The real Prisma runtime resolves to its browser build under jest and throws on
// Prisma.sql — same workaround as searchChats.test.ts. Nested fragments and
// Prisma.join() are flattened the way the real tagged template does, so the
// assertions below can read a single sql string and one flat parameter list.
jest.mock('@prisma/client', () => {
  const isFragment = (value: unknown): value is { sql: string; values: unknown[] } => (
    typeof value === 'object' && value !== null && 'sql' in value && 'values' in value
  );

  return {
    Prisma: {
      sql: jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
        let sql = strings[0] ?? '';
        const flatValues: unknown[] = [];

        values.forEach((value, index) => {
          if (isFragment(value)) {
            sql += value.sql;
            flatValues.push(...value.values);
          } else {
            sql += '?';
            flatValues.push(value);
          }
          sql += strings[index + 1] ?? '';
        });

        return { sql, values: flatValues };
      }),
      join: jest.fn((values: unknown[]) => ({
        sql: values.map(() => '?').join(','),
        values,
      })),
    },
  };
});

// The eight names the chat write path asks the model for, copied literally from
// features/chat/system-ai/generateChatConversationSummary.ts. They are duplicated
// here on purpose: that file stores the model's answer unvalidated, so these
// strings are the actual contents of Chat.useCase in production. If someone
// rewords one there and not here, this is the test that says the Value tab stopped
// recognizing it — which is otherwise silent, because an unrecognized category
// renders as a plausible-looking Unclassified bar rather than as an error.
const WRITE_PATH_NAMES: Record<string, UseCase> = {
  'Engineering': UseCase.Engineering,
  'Research Analysis': UseCase.ResearchAnalysis,
  'Writing Communication': UseCase.WritingCommunication,
  'Data Analytics': UseCase.DataAnalytics,
  'Proposal Capture': UseCase.ProposalCapture,
  'Program Delivery': UseCase.ProgramDelivery,
  'Policy Compliance': UseCase.PolicyCompliance,
  'Trial Test': UseCase.TrialTest,
};

describe('classifyUseCase', () => {
  it('resolves a category the chat carries', () => {
    expect(classifyUseCase('proposalCapture')).toBe(UseCase.ProposalCapture);
  });

  it('resolves every member of the vocabulary', () => {
    Object.values(UseCase).forEach((useCase) => {
      expect(classifyUseCase(useCase)).toBe(useCase);
    });
  });

  it('is unclassified when the chat carries no category', () => {
    expect(classifyUseCase(null)).toBe(UseCase.Unclassified);
  });

  // The column is String?, so the database cannot reject a hallucinated category.
  // It degrades to a gray bar rather than throwing inside a DAL.
  it('is unclassified when the value is outside the vocabulary', () => {
    expect(classifyUseCase('capture-and-proposal')).toBe(UseCase.Unclassified);
  });

  it('treats an empty string as no value', () => {
    expect(classifyUseCase('')).toBe(UseCase.Unclassified);
  });

  // The reason this function normalizes at all. Every one of these is a value the
  // column actually holds.
  it('resolves each name the write path stores to its identifier', () => {
    Object.entries(WRITE_PATH_NAMES).forEach(([stored, expected]) => {
      expect(classifyUseCase(stored)).toBe(expected);
    });
  });

  it('resolves a display label, for a value that reached the column by way of the UI', () => {
    expect(classifyUseCase(USE_CASE_LABELS[UseCase.PolicyCompliance]))
      .toBe(UseCase.PolicyCompliance);
  });

  // A model asked for 'Proposal Capture' in prose returns these too. Absorbing
  // them is the point of normalizing rather than matching a literal table.
  it('absorbs the case and punctuation a model varies unprompted', () => {
    expect(classifyUseCase('research analysis')).toBe(UseCase.ResearchAnalysis);
    expect(classifyUseCase('Research & Analysis')).toBe(UseCase.ResearchAnalysis);
    expect(classifyUseCase('  Trial  Test  ')).toBe(UseCase.TrialTest);
  });

  // Normalization loosens matching, so this pins the boundary: it may not start
  // resolving a category from a substring. 'Engineering the proposal' is not a
  // request for the Engineering bar, and free-text matching is exactly what this
  // file was rewritten to remove.
  it('still refuses a value that merely contains a category name', () => {
    expect(classifyUseCase('Engineering the proposal')).toBe(UseCase.Unclassified);
    expect(classifyUseCase('mostly Data Analytics')).toBe(UseCase.Unclassified);
  });
});

describe('buildUseCaseSqlFilter', () => {
  it('matches the normalized identifier for a category', () => {
    const sql = buildUseCaseSqlFilter(UseCase.ResearchAnalysis);
    expect(sql.values).toContain('researchanalysis');
  });

  it('excludes a null column from the Unclassified category', () => {
    const sql = buildUseCaseSqlFilter(UseCase.Unclassified);
    expect(sql.sql).toContain('IS NOT NULL');
  });

  it('normalizes every category in the vocabulary to a non-empty target', () => {
    USE_CASE_ORDER.forEach((useCase) => {
      expect(buildUseCaseSqlFilter(useCase).values[0]).not.toBe('');
    });
  });

  // The two labels that normalize differently from their identifier. A chat
  // holding the display text sits on the panel's bar, so it must be in the drawer.
  it('matches a display label whose normalized form differs from the identifier', () => {
    expect(buildUseCaseSqlFilter(UseCase.ProposalCapture).values)
      .toEqual(expect.arrayContaining(['proposalcapture', 'captureproposal']));
    expect(buildUseCaseSqlFilter(UseCase.PolicyCompliance).values)
      .toEqual(expect.arrayContaining(['policycompliance', 'policycompliancerisk']));
  });

  it('excludes every other category\'s aliases from the Unclassified catch-all', () => {
    const sql = buildUseCaseSqlFilter(UseCase.Unclassified);
    const claimed = USE_CASE_ORDER
      .filter((useCase) => useCase !== UseCase.Unclassified)
      .flatMap((useCase) => getUseCaseAliases(useCase));

    expect(sql.sql).toContain('NOT IN');
    expect(sql.values.sort()).toEqual(claimed.sort());
  });
});

// The branch's central guarantee, stated as a test: the chats a drawer lists are
// exactly the chats on the panel row that opened it.
describe('the drawer filter and the panel classifier agree', () => {
  const STORED_VALUES = [
    'proposalCapture',
    'Proposal Capture',
    'Capture & proposal',
    'policyCompliance',
    'Policy, compliance & risk',
    'Engineering',
    'buy-a-sandwich',
    'unclassified',
  ];

  const selectedBySql = (useCase: UseCase): string[] => {
    const values = buildUseCaseSqlFilter(useCase).values as string[];
    const normalize = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, '');
    const matchesAlias = (stored: string): boolean => values.includes(normalize(stored));

    return STORED_VALUES.filter((stored) => (
      useCase === UseCase.Unclassified ? !matchesAlias(stored) : matchesAlias(stored)
    ));
  };

  it.each(USE_CASE_ORDER)('selects exactly the chats classified as %s', (useCase) => {
    const selectedByClassifier = STORED_VALUES.filter((stored) => classifyUseCase(stored) === useCase);

    expect(selectedBySql(useCase).sort()).toEqual(selectedByClassifier.sort());
  });
});
