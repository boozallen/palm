import logger from '@/server/logger';
import db from '@/server/db';
import { TimeRange, UserActivityStats } from '@/features/context-studio/types/context-studio';
import { Prisma } from '@prisma/client';
import {
  buildPreviousPeriodFilter,
  buildTimeRangeFilter,
  buildTimeRangeStart,
} from '@/features/context-studio/dal/timeRangeFilter';

type SeriesGranularity = {
  // The DATE_TRUNC unit the buckets are aligned to.
  groupBy: string;
  // The matching generate_series step.
  step: string;
};

// Coarser buckets for longer ranges, so every preset yields a readable number of
// points. A full Record rather than a ternary chain: a new TimeRange member must
// declare its granularity instead of silently inheriting the fallback branch.
//
// Day shares the Week/Month bucketing because the series rows are cast to ::date
// downstream — hourly buckets would collapse to one label and break the charts.
const GRANULARITY: Record<TimeRange, SeriesGranularity> = {
  [TimeRange.Day]: { groupBy: 'day', step: '1 day' },
  [TimeRange.Week]: { groupBy: 'day', step: '1 day' },
  [TimeRange.Month]: { groupBy: 'day', step: '1 day' },
  [TimeRange.Year]: { groupBy: 'week', step: '1 week' },
  [TimeRange.YearToDate]: { groupBy: 'week', step: '1 week' },
  [TimeRange.Forever]: { groupBy: 'month', step: '1 month' },
};

export default async function getUserActivityStats(
  timeRange: TimeRange,
  userGroupId: string,
  userId: string,
  excludeAdmins = false,
): Promise<UserActivityStats> {
  try {
    const getTimeFilter = (field: string) => buildTimeRangeFilter(timeRange, field);

    const getAdminFilter = (userField: string) => {
      if (!excludeAdmins) { return Prisma.empty; }
      return Prisma.sql`AND ${Prisma.raw(userField)} NOT IN (SELECT id FROM "User" WHERE role = 'Admin')`;
    };

    const { groupBy: groupByClause, step: seriesInterval } = GRANULARITY[timeRange];

    // Null only for Forever, where each series instead starts at its own table's
    // earliest row.
    const rangeStart = buildTimeRangeStart(timeRange);
    const previousPeriodFilter = buildPreviousPeriodFilter(timeRange, 'u."createdAt"');

    const startDate = rangeStart
      ?? Prisma.sql`(SELECT MIN(u."createdAt") FROM "User" u)`;

    const auditStartDate = rangeStart
      ?? Prisma.sql`(SELECT MIN(ar."timestamp") FROM "AuditRecord" ar WHERE ar.event = 'USER_SIGN_IN')`;

    const userCreatedStartDate = rangeStart
      ?? Prisma.sql`(SELECT MIN(ar."timestamp") FROM "AuditRecord" ar WHERE ar.event = 'CREATE_USER')`;

    const [
      totalUsersResult,
      userGroupsResult,
      loginsResult,
      sessionsResult,
      newUsersCurrentPeriodResult,
      newUsersPreviousPeriodResult,
      joinCodeUsesResult,
      auditLoginCountResult,
      auditUniqueUsersResult,
      auditLoginBlockedCountResult,
      timeSeriesResult,
      auditLoginTimeSeriesResult,
      auditLoginBlockedTimeSeriesResult,
      userCreatedCountResult,
      earliestUserCreatedResult,
      userCreatedTimeSeriesResult,
    ] = await Promise.all([
      db.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count
        FROM "User" u
        WHERE 1=1
          ${userId !== 'all' ? Prisma.sql`AND u.id = CAST(${userId} AS UUID)` : Prisma.empty}
          ${userGroupId !== 'all' ? Prisma.sql`
            AND u.id IN (
              SELECT "userId" FROM "UserGroupMembership" WHERE "userGroupId" = CAST(${userGroupId} AS UUID)
            )
          ` : Prisma.empty}
          ${getAdminFilter('u.id')}
      `,
      db.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count
        FROM "UserGroup" ug
        WHERE 1=1
          ${userGroupId !== 'all' ? Prisma.sql`AND ug.id = CAST(${userGroupId} AS UUID)` : Prisma.empty}
      `,
      db.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(DISTINCT ar."userId") as count
        FROM "AuditRecord" ar
        WHERE ar.event = 'USER_SIGN_IN'
          AND ar.outcome = 'SUCCESS'
          ${getTimeFilter('ar."timestamp"')}
          ${userId !== 'all' ? Prisma.sql`AND ar."userId" = CAST(${userId} AS UUID)` : Prisma.empty}
          ${userGroupId !== 'all' ? Prisma.sql`
            AND ar."userId" IN (
              SELECT "userId" FROM "UserGroupMembership" WHERE "userGroupId" = CAST(${userGroupId} AS UUID)
            )
          ` : Prisma.empty}
          ${getAdminFilter('ar."userId"')}
      `,
      db.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count
        FROM "AuditRecord" ar
        WHERE ar.event = 'USER_SIGN_IN'
          AND ar.outcome = 'SUCCESS'
          ${getTimeFilter('ar."timestamp"')}
          ${userId !== 'all' ? Prisma.sql`AND ar."userId" = CAST(${userId} AS UUID)` : Prisma.empty}
          ${userGroupId !== 'all' ? Prisma.sql`
            AND ar."userId" IN (
              SELECT "userId" FROM "UserGroupMembership" WHERE "userGroupId" = CAST(${userGroupId} AS UUID)
            )
          ` : Prisma.empty}
          ${getAdminFilter('ar."userId"')}
      `,
      db.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count
        FROM "User" u
        WHERE 1=1
          ${getTimeFilter('u."createdAt"')}
          ${userId !== 'all' ? Prisma.sql`AND u.id = CAST(${userId} AS UUID)` : Prisma.empty}
          ${userGroupId !== 'all' ? Prisma.sql`
            AND u.id IN (
              SELECT "userId" FROM "UserGroupMembership" WHERE "userGroupId" = CAST(${userGroupId} AS UUID)
            )
          ` : Prisma.empty}
          ${getAdminFilter('u.id')}
      `,
      previousPeriodFilter !== null
        ? db.$queryRaw<{ count: bigint }[]>`
            SELECT COUNT(*) as count
            FROM "User" u
            WHERE ${previousPeriodFilter}
              ${userId !== 'all' ? Prisma.sql`AND u.id = CAST(${userId} AS UUID)` : Prisma.empty}
              ${userGroupId !== 'all' ? Prisma.sql`
                AND u.id IN (
                  SELECT "userId" FROM "UserGroupMembership" WHERE "userGroupId" = CAST(${userGroupId} AS UUID)
                )
              ` : Prisma.empty}
              ${getAdminFilter('u.id')}
          `
        : Promise.resolve([{ count: BigInt(0) }]),
      db.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count
        FROM "AuditRecord" ar
        WHERE ar.event = 'CREATE_USER_GROUP_MEMBERSHIP'
          AND ar.outcome = 'SUCCESS'
          AND ar.description LIKE '%via join code%'
          ${getTimeFilter('ar."timestamp"')}
      `,
      db.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count
        FROM "AuditRecord" ar
        WHERE ar.event = 'USER_SIGN_IN'
          AND ar.outcome = 'SUCCESS'
          ${getTimeFilter('ar."timestamp"')}
          ${userId !== 'all' ? Prisma.sql`AND ar."userId" = CAST(${userId} AS UUID)` : Prisma.empty}
          ${userGroupId !== 'all' ? Prisma.sql`
            AND ar."userId" IN (
              SELECT "userId" FROM "UserGroupMembership" WHERE "userGroupId" = CAST(${userGroupId} AS UUID)
            )
          ` : Prisma.empty}
          ${getAdminFilter('ar."userId"')}
      `,
      db.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(DISTINCT ar."userId") as count
        FROM "AuditRecord" ar
        WHERE ar.event = 'USER_SIGN_IN'
          AND ar.outcome = 'SUCCESS'
          ${getTimeFilter('ar."timestamp"')}
          ${userId !== 'all' ? Prisma.sql`AND ar."userId" = CAST(${userId} AS UUID)` : Prisma.empty}
          ${userGroupId !== 'all' ? Prisma.sql`
            AND ar."userId" IN (
              SELECT "userId" FROM "UserGroupMembership" WHERE "userGroupId" = CAST(${userGroupId} AS UUID)
            )
          ` : Prisma.empty}
          ${getAdminFilter('ar."userId"')}
      `,
      db.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(DISTINCT u.id) as count
        FROM "User" u
        WHERE EXISTS (
          SELECT 1 FROM "AuditRecord" ar
          WHERE ar."userId" = u.id
            AND ar.event = 'USER_SIGN_IN'
            AND ar.outcome = 'SUCCESS'
            ${getTimeFilter('ar."timestamp"')}
        )
        AND NOT EXISTS (
          SELECT 1 FROM "UserGroupMembership" ugm WHERE ugm."userId" = u.id
        )
        ${userId !== 'all' ? Prisma.sql`AND u.id = CAST(${userId} AS UUID)` : Prisma.empty}
        ${getAdminFilter('u.id')}
      `,
      db.$queryRaw<{
        date: Date;
        logins: bigint;
        sessions: bigint;
        newUsers: bigint;
      }[]>`
        WITH date_series AS (
          SELECT generate_series(
            DATE_TRUNC('${Prisma.raw(groupByClause)}', ${startDate}),
            DATE_TRUNC('${Prisma.raw(groupByClause)}', NOW()),
            '${Prisma.raw(seriesInterval)}'::interval
          )::date AS date
        ),
          daily_logins AS (
            SELECT
              DATE_TRUNC('${Prisma.raw(groupByClause)}', ar."timestamp")::date AS date,
              COUNT(DISTINCT ar."userId") as count
            FROM "AuditRecord" ar
            WHERE ar.event = 'USER_SIGN_IN'
              AND ar.outcome = 'SUCCESS'
              ${getTimeFilter('ar."timestamp"')}
              ${userId !== 'all' ? Prisma.sql`AND ar."userId" = CAST(${userId} AS UUID)` : Prisma.empty}
              ${userGroupId !== 'all' ? Prisma.sql`
                AND ar."userId" IN (
                  SELECT "userId" FROM "UserGroupMembership" WHERE "userGroupId" = CAST(${userGroupId} AS UUID)
                )
              ` : Prisma.empty}
              ${getAdminFilter('ar."userId"')}
            GROUP BY DATE_TRUNC('${Prisma.raw(groupByClause)}', ar."timestamp")::date
          ),
          daily_sessions AS (
            SELECT
              DATE_TRUNC('${Prisma.raw(groupByClause)}', ar."timestamp")::date AS date,
              COUNT(*) as count
            FROM "AuditRecord" ar
            WHERE ar.event = 'USER_SIGN_IN'
              AND ar.outcome = 'SUCCESS'
              ${getTimeFilter('ar."timestamp"')}
              ${userId !== 'all' ? Prisma.sql`AND ar."userId" = CAST(${userId} AS UUID)` : Prisma.empty}
              ${userGroupId !== 'all' ? Prisma.sql`
                AND ar."userId" IN (
                  SELECT "userId" FROM "UserGroupMembership" WHERE "userGroupId" = CAST(${userGroupId} AS UUID)
                )
              ` : Prisma.empty}
              ${getAdminFilter('ar."userId"')}
            GROUP BY DATE_TRUNC('${Prisma.raw(groupByClause)}', ar."timestamp")::date
          ),
          daily_new_users AS (
            SELECT
              DATE_TRUNC('${Prisma.raw(groupByClause)}', u."createdAt")::date AS date,
              COUNT(*) as count
            FROM "User" u
            WHERE 1=1
              ${getTimeFilter('u."createdAt"')}
              ${userId !== 'all' ? Prisma.sql`AND u.id = CAST(${userId} AS UUID)` : Prisma.empty}
              ${userGroupId !== 'all' ? Prisma.sql`
                AND u.id IN (
                  SELECT "userId" FROM "UserGroupMembership" WHERE "userGroupId" = CAST(${userGroupId} AS UUID)
                )
              ` : Prisma.empty}
              ${getAdminFilter('u.id')}
            GROUP BY DATE_TRUNC('${Prisma.raw(groupByClause)}', u."createdAt")::date
          )
        SELECT
          ds.date,
          COALESCE(dl.count, 0) as logins,
          COALESCE(dses.count, 0) as sessions,
          COALESCE(dnu.count, 0) as "newUsers"
        FROM date_series ds
        LEFT JOIN daily_logins dl ON ds.date = dl.date
        LEFT JOIN daily_sessions dses ON ds.date = dses.date
        LEFT JOIN daily_new_users dnu ON ds.date = dnu.date
        ORDER BY ds.date
      `,
      db.$queryRaw<{
        date: Date;
        loginCount: bigint;
      }[]>`
        WITH date_series AS (
          SELECT generate_series(
            DATE_TRUNC('${Prisma.raw(groupByClause)}', ${auditStartDate}),
            DATE_TRUNC('${Prisma.raw(groupByClause)}', NOW()),
            '${Prisma.raw(seriesInterval)}'::interval
          )::date AS date
        ),
        audit_logins AS (
          SELECT
            DATE_TRUNC('${Prisma.raw(groupByClause)}', ar."timestamp")::date AS date,
            COUNT(*) as count
          FROM "AuditRecord" ar
          WHERE ar.event = 'USER_SIGN_IN'
            AND ar.outcome = 'SUCCESS'
            ${getTimeFilter('ar."timestamp"')}
            ${userId !== 'all' ? Prisma.sql`AND ar."userId" = CAST(${userId} AS UUID)` : Prisma.empty}
            ${userGroupId !== 'all' ? Prisma.sql`
              AND ar."userId" IN (
                SELECT "userId" FROM "UserGroupMembership" WHERE "userGroupId" = CAST(${userGroupId} AS UUID)
              )
            ` : Prisma.empty}
            ${getAdminFilter('ar."userId"')}
          GROUP BY DATE_TRUNC('${Prisma.raw(groupByClause)}', ar."timestamp")::date
        )
        SELECT
          ds.date,
          COALESCE(al.count, 0) as "loginCount"
        FROM date_series ds
        LEFT JOIN audit_logins al ON ds.date = al.date
        ORDER BY ds.date
      `,
      db.$queryRaw<{
        date: Date;
        loginCount: bigint;
      }[]>`
        WITH date_series AS (
          SELECT generate_series(
            DATE_TRUNC('${Prisma.raw(groupByClause)}', ${auditStartDate}),
            DATE_TRUNC('${Prisma.raw(groupByClause)}', NOW()),
            '${Prisma.raw(seriesInterval)}'::interval
          )::date AS date
        ),
        users_not_in_group AS (
          SELECT u.id
          FROM "User" u
          WHERE NOT EXISTS (
            SELECT 1 FROM "UserGroupMembership" ugm WHERE ugm."userId" = u.id
          )
          ${getAdminFilter('u.id')}
        ),
        first_logins_no_group AS (
          SELECT
            DATE_TRUNC('${Prisma.raw(groupByClause)}', first_login."timestamp")::date AS date,
            COUNT(*) as count
          FROM (
            SELECT DISTINCT ON (ar."userId")
              ar."userId",
              ar."timestamp"
            FROM "AuditRecord" ar
            INNER JOIN users_not_in_group ung ON ar."userId" = ung.id
            WHERE ar.event = 'USER_SIGN_IN'
              AND ar.outcome = 'SUCCESS'
              AND ar."userId" IS NOT NULL
              ${getTimeFilter('ar."timestamp"')}
              ${userId !== 'all' ? Prisma.sql`AND ar."userId" = CAST(${userId} AS UUID)` : Prisma.empty}
            ORDER BY ar."userId", ar."timestamp" ASC
          ) first_login
          GROUP BY DATE_TRUNC('${Prisma.raw(groupByClause)}', first_login."timestamp")::date
        )
        SELECT
          ds.date,
          COALESCE(flnju.count, 0) as "loginCount"
        FROM date_series ds
        LEFT JOIN first_logins_no_group flnju ON ds.date = flnju.date
        ORDER BY ds.date
      `,
      db.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count
        FROM "AuditRecord" ar
        WHERE ar.event = 'CREATE_USER'
          AND ar.outcome = 'SUCCESS'
          ${getTimeFilter('ar."timestamp"')}
          ${userId !== 'all' ? Prisma.sql`AND ar."userId" = CAST(${userId} AS UUID)` : Prisma.empty}
          ${userGroupId !== 'all' ? Prisma.sql`
            AND ar."userId" IN (
              SELECT "userId" FROM "UserGroupMembership" WHERE "userGroupId" = CAST(${userGroupId} AS UUID)
            )
          ` : Prisma.empty}
          ${getAdminFilter('ar."userId"')}
      `,
      db.$queryRaw<{ earliest: Date | null }[]>`
        SELECT MIN(ar."timestamp") as earliest
        FROM "AuditRecord" ar
        WHERE ar.event = 'CREATE_USER'
          AND ar.outcome = 'SUCCESS'
          ${userId !== 'all' ? Prisma.sql`AND ar."userId" = CAST(${userId} AS UUID)` : Prisma.empty}
          ${userGroupId !== 'all' ? Prisma.sql`
            AND ar."userId" IN (
              SELECT "userId" FROM "UserGroupMembership" WHERE "userGroupId" = CAST(${userGroupId} AS UUID)
            )
          ` : Prisma.empty}
          ${getAdminFilter('ar."userId"')}
      `,
      db.$queryRaw<{
        date: Date;
        count: bigint;
      }[]>`
        WITH date_series AS (
          SELECT generate_series(
            DATE_TRUNC('${Prisma.raw(groupByClause)}', ${userCreatedStartDate}),
            DATE_TRUNC('${Prisma.raw(groupByClause)}', NOW()),
            '${Prisma.raw(seriesInterval)}'::interval
          )::date AS date
        ),
        user_creations AS (
          SELECT
            DATE_TRUNC('${Prisma.raw(groupByClause)}', ar."timestamp")::date AS date,
            COUNT(*) as count
          FROM "AuditRecord" ar
          WHERE ar.event = 'CREATE_USER'
            AND ar.outcome = 'SUCCESS'
            ${getTimeFilter('ar."timestamp"')}
            ${userId !== 'all' ? Prisma.sql`AND ar."userId" = CAST(${userId} AS UUID)` : Prisma.empty}
            ${userGroupId !== 'all' ? Prisma.sql`
              AND ar."userId" IN (
                SELECT "userId" FROM "UserGroupMembership" WHERE "userGroupId" = CAST(${userGroupId} AS UUID)
              )
            ` : Prisma.empty}
            ${getAdminFilter('ar."userId"')}
          GROUP BY DATE_TRUNC('${Prisma.raw(groupByClause)}', ar."timestamp")::date
        )
        SELECT
          ds.date,
          COALESCE(uc.count, 0) as count
        FROM date_series ds
        LEFT JOIN user_creations uc ON ds.date = uc.date
        ORDER BY ds.date
      `,
    ]);

    const totalUsersCount = Number(totalUsersResult[0]?.count || 0);
    const userGroupsCount = Number(userGroupsResult[0]?.count || 0);
    const loginsCount = Number(loginsResult[0]?.count || 0);
    const sessionsCount = Number(sessionsResult[0]?.count || 0);
    const newUsersCurrentPeriodCount = Number(newUsersCurrentPeriodResult[0]?.count || 0);
    const newUsersPreviousPeriodCount = Number(newUsersPreviousPeriodResult[0]?.count || 0);
    const joinCodeUsesCount = Number(joinCodeUsesResult[0]?.count || 0);
    const auditLoginCount = Number(auditLoginCountResult[0]?.count || 0);
    const auditUniqueUsersCount = Number(auditUniqueUsersResult[0]?.count || 0);
    const auditLoginBlockedCount = Number(auditLoginBlockedCountResult[0]?.count || 0);
    const userCreatedCount = Number(userCreatedCountResult[0]?.count || 0);
    const earliestUserCreatedDate = earliestUserCreatedResult[0]?.earliest
      ? earliestUserCreatedResult[0].earliest.toISOString().split('T')[0]
      : null;

    const userActivityTimeSeries = timeSeriesResult.map((row) => ({
      date: row.date.toISOString().split('T')[0],
      logins: Number(row.logins),
      sessions: Number(row.sessions),
      newUsers: Number(row.newUsers),
    }));

    const auditLoginTimeSeries = auditLoginTimeSeriesResult.map((row) => ({
      date: row.date.toISOString().split('T')[0],
      loginCount: Number(row.loginCount),
    }));

    const auditLoginBlockedTimeSeries = auditLoginBlockedTimeSeriesResult.map((row) => ({
      date: row.date.toISOString().split('T')[0],
      loginCount: Number(row.loginCount),
    }));

    const userCreatedTimeSeries = userCreatedTimeSeriesResult.map((row) => ({
      date: row.date.toISOString().split('T')[0],
      count: Number(row.count),
    }));

    return {
      totalUsers: totalUsersCount,
      userGroups: userGroupsCount,
      logins: loginsCount,
      totalSessions: sessionsCount,
      newUsersThisWeek: newUsersCurrentPeriodCount,
      newUsersPreviousWeek: newUsersPreviousPeriodCount,
      auditLogins: auditLoginCount,
      auditUniqueUsers: auditUniqueUsersCount,
      auditLoginsBlocked: auditLoginBlockedCount,
      joinCodeUses: joinCodeUsesCount,
      userCreatedCount,
      earliestUserCreatedDate,
      userActivityTimeSeries,
      auditLoginTimeSeries,
      auditLoginBlockedTimeSeries,
      userCreatedTimeSeries,
    };
  } catch (error) {
    logger.error('Error fetching user activity stats', { error });
    throw new Error('Failed to fetch user activity statistics');
  }
}
