import { Prisma } from '@prisma/client';
import { isUseCase, UseCase, USE_CASE_LABELS } from '@/features/shared/types/use-case';

// Resolves what a chat was for from the one column that carries the signal,
// Chat.useCase. Pure: no LLM, no database, no clock. Every categorization
// decision the Value tab makes passes through this function, so it is
// exhaustively unit tested.
//
// This file used to substring-match agent names, workflow names and prompt tags.
// That is gone rather than replaced. Two of its four documented defects were
// fixed by the deletion alone: the agent arm matched AgentProvider.name, which is
// an unrelated concept to the agents its term list named and has exactly one row
// in production; and matching admin-editable display names meant renaming an
// agent in Settings silently reclassified its historical spend.
//
// A value outside the closed vocabulary is treated as no value at all rather than
// as an error: the column is a plain String? because this schema has no enum
// blocks, so anything unrecognized resolves to Unclassified instead of being cast
// and trusted.

// Case, spacing and punctuation removed. The write path in
// features/chat/system-ai asks the model for a category by prose name and stores
// whatever comes back unvalidated, so the column holds display text — 'Research
// Analysis' — while everything that reads it keys on identifiers —
// 'researchAnalysis'. Without this the two sides never meet and every categorized
// chat renders as Unclassified.
//
// Normalizing rather than table-mapping the write path's eight names is
// deliberate: each of them collapses to exactly its own identifier under this
// transform, so there is no second list here to drift against the first. It also
// absorbs the near-misses a model produces unprompted — a stray ampersand, an
// unexpected case — which a literal table would drop on the floor.
const normalize = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, '');

// Built from the vocabulary itself, so a category added to the enum is resolvable
// the moment it exists. The display labels are folded in as well, which costs
// nothing and covers a value that reached the column by way of the UI.
const USE_CASE_ALIASES = new Map<string, UseCase>(
  Object.values(UseCase).flatMap((useCase) => [
    [normalize(useCase), useCase] as const,
    [normalize(USE_CASE_LABELS[useCase]), useCase] as const,
  ]),
);

// Every normalized value classifyUseCase() resolves to this category: its
// identifier and its display label. Exported so the SQL predicate below reads the
// same map instead of carrying a hand-written second list that can drift.
export function getUseCaseAliases(useCase: UseCase): string[] {
  return Array.from(USE_CASE_ALIASES.entries())
    .filter(([, resolved]) => resolved === useCase)
    .map(([alias]) => alias);
}

export default function classifyUseCase(value: string | null): UseCase {
  if (isUseCase(value)) {
    return value;
  }

  if (value === null) {
    return UseCase.Unclassified;
  }

  return USE_CASE_ALIASES.get(normalize(value)) ?? UseCase.Unclassified;
}

// The SQL image of classifyUseCase, matching every alias that resolves to the
// category. NOT NULL is explicit because a null column means the classifier never
// ran, which is bucketed as unattributed and kept off the bars.
export function buildUseCaseSqlFilter(useCase: UseCase): Prisma.Sql {
  const normalizedColumn = Prisma.sql`regexp_replace(lower(c."useCase"), '[^a-z0-9]', '', 'g')`;

  if (useCase === UseCase.Unclassified) {
    const claimedAliases = Array.from(USE_CASE_ALIASES.entries())
      .filter(([, resolved]) => resolved !== UseCase.Unclassified)
      .map(([alias]) => alias);

    return Prisma.sql`c."useCase" IS NOT NULL
      AND ${normalizedColumn} NOT IN (${Prisma.join(claimedAliases)})`;
  }

  return Prisma.sql`c."useCase" IS NOT NULL
    AND ${normalizedColumn} IN (${Prisma.join(getUseCaseAliases(useCase))})`;
}
