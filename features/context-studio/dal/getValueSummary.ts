import getAdoptionMetrics from '@/features/context-studio/dal/getAdoptionMetrics';
import getArtifactEgress, { isPutToWork } from '@/features/context-studio/dal/getArtifactEgress';
import getArtifactFacts, { ArtifactFact } from '@/features/context-studio/dal/getArtifactFacts';
import getSpendFacts from '@/features/context-studio/dal/getSpendFacts';
import getTimeInTool from '@/features/context-studio/dal/getTimeInTool';
import { resolveTimeRangeStart } from '@/features/context-studio/dal/timeRangeFilter';
import classifyUseCase from '@/features/context-studio/services/useCaseTaxonomy';
import { TimeRange } from '@/features/context-studio/types/context-studio';
import {
  SpendRemainder,
  TeamValue,
  UseCaseSpend,
  ValueSummary,
} from '@/features/context-studio/types/value';
import { UseCase, USE_CASE_ORDER } from '@/features/shared/types/use-case';
import db from '@/server/db';
import logger from '@/server/logger';

// The synthetic team row for people who belong to no user group. A named row
// rather than dropping them: their spend is real and has to appear somewhere for
// the team column to reconcile against the total.
export const UNATTRIBUTED_TEAM_LABEL = 'Unattributed (no team)';

const MILLISECONDS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

// One decimal on both derived rates. More digits imply a precision the inputs
// do not have.
const round = (value: number): number => Math.round(value * 10) / 10;

type TeamAccumulator = {
  activePeople: Set<string>;
  artifacts: number;
  putToWork: number;
  cost: number;
};

// Composes the five Value-view DALs into the single shape the client renders.
// Runs no SQL of its own beyond turning user ids into team rows — every figure
// here is arithmetic over facts the DALs already returned.
export default async function getValueSummary(
  timeRange: TimeRange,
  userGroupId: string,
  userId: string,
  excludeAdmins = true,
  teamUserGroupIds: string[] = [],
): Promise<ValueSummary> {
  try {
    const [adoption, artifactFacts, spendFacts, hoursInTool, memberships] = await Promise.all([
      getAdoptionMetrics(timeRange, userGroupId, userId, excludeAdmins),
      getArtifactFacts(timeRange, userGroupId, userId, excludeAdmins),
      getSpendFacts(timeRange, userGroupId, userId, excludeAdmins),
      getTimeInTool(timeRange, userGroupId, userId, excludeAdmins),
      teamUserGroupIds.length > 0
        ? db.userGroupMembership.findMany({
            where: { userGroupId: { in: teamUserGroupIds } },
            select: {
              userId: true,
              userGroupId: true,
              userGroup: { select: { label: true } },
            },
          })
        : Promise.resolve([]),
    ]);

    const nonAdminUsers = excludeAdmins
      ? await db.user.findMany({
          where: { role: { not: 'Admin' } },
          select: { id: true },
        })
      : [];

    const nonAdmins = new Set(nonAdminUsers.map((user) => user.id));
    const groupLabels = new Map<string, string>();
    const memberCounts = new Map<string, number>();

    memberships.forEach((membership) => {
      // Admin memberships are dropped here as well as in the DALs, so a team's
      // member count and its activity come from the same population.
      if (excludeAdmins && !nonAdmins.has(membership.userId)) {
        return;
      }

      groupLabels.set(membership.userGroupId, membership.userGroup.label);
      memberCounts.set(
        membership.userGroupId,
        (memberCounts.get(membership.userGroupId) ?? 0) + 1,
      );
    });

    const teams = new Map<string | null, TeamAccumulator>();
    const teamFor = (key: string | null): TeamAccumulator => {
      const existing = teams.get(key);
      if (existing) {
        return existing;
      }

      const created: TeamAccumulator = {
        activePeople: new Set<string>(),
        artifacts: 0,
        putToWork: 0,
        cost: 0,
      };
      teams.set(key, created);
      return created;
    };

    const inWindow = (window: ArtifactFact['window']): ArtifactFact[] =>
      artifactFacts.filter((fact) => fact.window === window);

    const currentArtifacts = inWindow('current');
    const previousArtifacts = inWindow('previous');

    // One call per window. Each cohort's egress is observed only within its own
    // window, so the two observation periods are identically distributed and the
    // delta compares like with like. A single call bounded below would let the
    // previous cohort accrue egress for up to an extra full interval and report a
    // flat metric as a decline. Both calls take artifact ids, which is what lets
    // them use the [event, outcome, timestamp] index instead of a JSONB
    // containment scan — so running them concurrently costs nothing.
    const [currentEgress, previousEgress] = await Promise.all([
      getArtifactEgress(currentArtifacts.map((fact) => fact.artifactId), timeRange, 'current'),
      getArtifactEgress(previousArtifacts.map((fact) => fact.artifactId), timeRange, 'previous'),
    ]);

    const isPutToWorkCurrent = (artifactId: string): boolean => isPutToWork(currentEgress.get(artifactId));

    const isPutToWorkPrevious = (artifactId: string): boolean => isPutToWork(previousEgress.get(artifactId));

    const currentPutToWork = currentArtifacts.filter((fact) => isPutToWorkCurrent(fact.artifactId));

    adoption.activeAttributions.forEach(({ userId: personId, userGroupId: key }) => {
      teamFor(key).activePeople.add(personId);
    });

    const artifactsByUseCase = new Map<UseCase, number>();
    const putToWorkByUseCase = new Map<UseCase, number>();
    currentArtifacts.forEach((fact) => {
      const wasPutToWork = isPutToWorkCurrent(fact.artifactId) ? 1 : 0;

      // Bars are chat only, matching the spend side. A workflow artifact has no
      // category to read, and inventing one is the fabrication the footer exists
      // to avoid. It still counts toward the team and headline figures below.
      //
      // A null classification is excluded for the same reason and on the same terms
      // as the spend side: the chat was never categorized, so there is no finding to
      // report. Counting it would put every pre-feature artifact on the Unclassified
      // row while its spend sat in the footer, and the two columns of one row would
      // then be measuring different populations.
      if (fact.kind === 'chat' && fact.classification !== null) {
        const useCase = classifyUseCase(fact.classification);
        artifactsByUseCase.set(useCase, (artifactsByUseCase.get(useCase) ?? 0) + 1);
        putToWorkByUseCase.set(
          useCase,
          (putToWorkByUseCase.get(useCase) ?? 0) + wasPutToWork,
        );
      }

      const team = teamFor(fact.userGroupId);
      team.artifacts += 1;
      team.putToWork += wasPutToWork;
    });

    const costByUseCase = new Map<UseCase, number>();
    const remainder: SpendRemainder = {
      platform: 0,
      workflow: 0,
      customAgent: 0,
      unattributed: 0,
    };
    let chatCost = 0;
    let systemCost = 0;
    let totalCost = 0;

    spendFacts.forEach((fact) => {
      // Reported as a parenthetical so the footer reconciles against the Cost
      // tab, and deliberately in no total here — not in totalCost, not in
      // costPerPutToWork, not on any team row. This is the property that makes an
      // LLM classifier affordable: the call that categorizes a chat is system
      // spend, so it can never inflate the panel it populates.
      if (fact.bucket === 'system') {
        systemCost += fact.cost;
        return;
      }

      totalCost += fact.cost;
      teamFor(fact.userGroupId).cost += fact.cost;

      if (fact.bucket === 'chat') {
        const useCase = classifyUseCase(fact.classification);
        costByUseCase.set(useCase, (costByUseCase.get(useCase) ?? 0) + fact.cost);
        chatCost += fact.cost;
        return;
      }

      // Every remaining bucket is a footer line, and SpendBucket's members are
      // exactly SpendRemainder's keys plus the two handled above — so this needs
      // no default arm and cannot silently drop a bucket added later.
      remainder[fact.bucket] += fact.cost;
    });

    // Fixed taxonomy order with every category present, even at zero. A period
    // where nothing was categorized as engineering must not shift the other bars,
    // or two screenshots of the same panel stop being comparable.
    const byUseCase: UseCaseSpend[] = USE_CASE_ORDER.map((useCase) => ({
      useCase,
      cost: costByUseCase.get(useCase) ?? 0,
      artifacts: artifactsByUseCase.get(useCase) ?? 0,
      putToWork: putToWorkByUseCase.get(useCase) ?? 0,
    }));

    const byTeam: TeamValue[] = Array.from(teams.entries())
      .map(([key, team]) => ({
        userGroupId: key,
        label: key === null
          ? UNATTRIBUTED_TEAM_LABEL
          : groupLabels.get(key) ?? UNATTRIBUTED_TEAM_LABEL,
        activePeople: team.activePeople.size,
        // The unattributed row has no membership to count. The table renders a
        // dash rather than "0 members", which would read as a real team of none.
        members: key === null ? 0 : memberCounts.get(key) ?? 0,
        artifacts: team.artifacts,
        putToWork: team.putToWork,
        cost: team.cost,
      }))
      .sort((first, second) => second.cost - first.cost);

    const periodStart = resolveTimeRangeStart(timeRange, new Date());
    const weeksInPeriod = periodStart
      ? (Date.now() - periodStart.getTime()) / MILLISECONDS_PER_WEEK
      : null;

    return {
      provisionedPeople: adoption.provisionedPeople,
      activePeople: adoption.activePeople,
      returningPeople: adoption.returningPeople,
      artifacts: {
        value: currentArtifacts.length,
        previous: previousArtifacts.length,
      },
      putToWork: {
        value: currentPutToWork.length,
        previous: previousArtifacts.filter((fact) => isPutToWorkPrevious(fact.artifactId)).length,
      },
      totalCost,
      chatCost,
      remainder,
      systemCost,
      // Null, never 0: a zero here would assert a unit cost we cannot compute.
      costPerPutToWork: currentPutToWork.length > 0
        ? totalCost / currentPutToWork.length
        : null,
      hoursInTool,
      // A single day is not a week, and the label promises a weekly rate. Forever
      // has no fixed span, so it cannot yield a per-week figure either.
      hoursPerPersonPerWeek: timeRange !== TimeRange.Day && weeksInPeriod && weeksInPeriod > 0 && adoption.activePeople.value > 0
        ? round(hoursInTool / adoption.activePeople.value / weeksInPeriod)
        : null,
      byUseCase,
      byTeam,
    };
  } catch (error) {
    logger.error('Failed to compose the Context Studio value summary', { error });
    throw new Error('Failed to fetch the Context Studio value summary');
  }
}
