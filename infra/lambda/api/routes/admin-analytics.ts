import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  QueryCommand,
  ScanCommand,
  BatchGetCommand,
} from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, badRequest, serverError } from '../utils/response';
import { isAdmin } from '../utils/auth';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.TABLE_NAME!;

/**
 * GET /api/admin/analytics/overview - Platform-wide analytics overview
 */
export async function getAnalyticsOverview(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (!isAdmin(event)) return badRequest('Admin access required');

  try {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const thisMonth = today.slice(0, 7);
    const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);

    // Fetch daily stats for last 30 days
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
    const dailyResult = await client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk AND sk BETWEEN :from AND :to',
        ExpressionAttributeValues: {
          ':pk': 'STATS',
          ':from': `DAILY#${thirtyDaysAgo}`,
          ':to': `DAILY#${today}~`,
        },
      })
    );
    const dailyStats = (dailyResult.Items || []).map((item) => ({
      date: (item.sk as string).replace('DAILY#', ''),
      count: item.count || 0,
    }));

    // Monthly total
    const monthlyResult = await client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk AND sk = :sk',
        ExpressionAttributeValues: {
          ':pk': 'STATS',
          ':sk': `MONTHLY#${thisMonth}`,
        },
      })
    );
    const thisMonthTotal = monthlyResult.Items?.[0]?.count || 0;

    // This week total (sum daily stats from weekAgo to today)
    const thisWeekTotal = dailyStats
      .filter((d) => d.date >= weekAgo)
      .reduce((sum, d) => sum + d.count, 0);

    // Top exercises this month
    const exerciseStatsResult = await client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
        ExpressionAttributeValues: {
          ':pk': 'STATS',
          ':prefix': `EXERCISE#`,
        },
      })
    );
    const exerciseStats = (exerciseStatsResult.Items || [])
      .filter((item) => (item.sk as string).endsWith(`#${thisMonth}`))
      .map((item) => {
        const parts = (item.sk as string).split('#');
        return {
          exerciseId: parts[1],
          exerciseName: item.exerciseName || parts[1],
          completions: item.count || 0,
          totalSets: item.totalSets || 0,
          totalReps: item.totalReps || 0,
        };
      })
      .sort((a, b) => b.completions - a.completions)
      .slice(0, 10);

    // Top workouts this month
    const workoutStatsResult = await client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
        ExpressionAttributeValues: {
          ':pk': 'STATS',
          ':prefix': `WORKOUT#`,
        },
      })
    );
    const workoutStats = (workoutStatsResult.Items || [])
      .filter((item) => (item.sk as string).endsWith(`#${thisMonth}`))
      .map((item) => {
        const parts = (item.sk as string).split('#');
        return {
          workoutId: parts[1],
          workoutTitle: item.workoutTitle || parts[1],
          completions: item.count || 0,
        };
      })
      .sort((a, b) => b.completions - a.completions)
      .slice(0, 10);

    // All-time total (sum all monthly records)
    const allMonthlyResult = await client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
        ExpressionAttributeValues: {
          ':pk': 'STATS',
          ':prefix': 'MONTHLY#',
        },
      })
    );
    const allTimeTotal = (allMonthlyResult.Items || [])
      .reduce((sum, item) => sum + (item.count || 0), 0);

    // Tier distribution (scan USER profiles - acceptable for admin-only)
    const tierResult = await client.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: 'begins_with(pk, :prefix) AND sk = :sk',
        ExpressionAttributeValues: {
          ':prefix': 'USER#',
          ':sk': 'PROFILE',
        },
        ProjectionExpression: 'tier',
      })
    );
    const tierDist: Record<string, number> = {};
    (tierResult.Items || []).forEach((item) => {
      const tier = (item.tier as string) || 'Pup';
      tierDist[tier] = (tierDist[tier] || 0) + 1;
    });

    // Routine generation stats (query GSI1 for DAILY_WORKOUT records last 30 days)
    let routineStats: any = null;
    try {
      const routineResult = await client.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: 'GSI1',
          KeyConditionExpression: 'gsi1pk = :pk AND gsi1sk >= :from',
          ExpressionAttributeValues: {
            ':pk': 'DAILY_WORKOUT',
            ':from': `${thirtyDaysAgo}`,
          },
        })
      );
      const routineItems = (routineResult.Items || []).filter((r: any) => r.status !== 'generating');
      const monthStart = thisMonth + '-01';
      const monthRoutines = routineItems.filter((r: any) => (r.date || '') >= monthStart);
      const weekRoutines = routineItems.filter((r: any) => (r.date || '') >= weekAgo);

      // Token aggregation - separate input/output
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let billingInputTokens = 0;
      let billingOutputTokens = 0;
      const dailyMap: Record<string, { generations: number; inputTokens: number; outputTokens: number }> = {};
      const userMap: Record<string, { generations: number; inputTokens: number; outputTokens: number }> = {};

      for (const r of routineItems) {
        const usage = r.tokenUsage;
        const input = usage?.inputTokens || 0;
        const output = usage?.outputTokens || 0;
        totalInputTokens += input;
        totalOutputTokens += output;

        // Billing cycle (current month)
        const date = r.date || '';
        if (date >= monthStart) {
          billingInputTokens += input;
          billingOutputTokens += output;
        }

        // Daily breakdown
        if (date) {
          if (!dailyMap[date]) dailyMap[date] = { generations: 0, inputTokens: 0, outputTokens: 0 };
          dailyMap[date].generations += 1;
          dailyMap[date].inputTokens += input;
          dailyMap[date].outputTokens += output;
        }

        // Per-user breakdown (extract sub from gsi1sk: "date#sub")
        const gsi1sk = r.gsi1sk || '';
        const hashIdx = gsi1sk.indexOf('#');
        const userSub = hashIdx >= 0 ? gsi1sk.slice(hashIdx + 1) : '';
        if (userSub) {
          if (!userMap[userSub]) userMap[userSub] = { generations: 0, inputTokens: 0, outputTokens: 0 };
          userMap[userSub].generations += 1;
          userMap[userSub].inputTokens += input;
          userMap[userSub].outputTokens += output;
        }
      }

      const totalTokens = totalInputTokens + totalOutputTokens;
      const genCount = routineItems.length;

      // Cost calculation (Sonnet 4.6: $3/M input, $15/M output)
      const COST_PER_M_INPUT = 3;
      const COST_PER_M_OUTPUT = 15;
      const billingCostInput = (billingInputTokens / 1_000_000) * COST_PER_M_INPUT;
      const billingCostOutput = (billingOutputTokens / 1_000_000) * COST_PER_M_OUTPUT;

      // Daily breakdown sorted
      const dailyBreakdown = Object.entries(dailyMap)
        .map(([date, d]) => ({ date, ...d }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Top users by token usage - get top 10
      const topUserEntries = Object.entries(userMap)
        .map(([userSub, u]) => ({ userSub, ...u, totalTokens: u.inputTokens + u.outputTokens }))
        .sort((a, b) => b.totalTokens - a.totalTokens)
        .slice(0, 10);

      // Batch-get emails for top users
      const topUsers: any[] = [];
      if (topUserEntries.length > 0) {
        try {
          const keys = topUserEntries.map((u) => ({ pk: `USER#${u.userSub}`, sk: 'PROFILE' }));
          const batchResult = await client.send(
            new BatchGetCommand({
              RequestItems: {
                [TABLE_NAME]: { Keys: keys, ProjectionExpression: 'pk, email, givenName, familyName' },
              },
            })
          );
          const profileMap: Record<string, any> = {};
          (batchResult.Responses?.[TABLE_NAME] || []).forEach((p: any) => {
            const sub = (p.pk || '').replace('USER#', '');
            profileMap[sub] = p;
          });
          for (const u of topUserEntries) {
            const profile = profileMap[u.userSub];
            topUsers.push({
              userSub: u.userSub,
              email: profile?.email || 'Unknown',
              name: [profile?.givenName, profile?.familyName].filter(Boolean).join(' ') || '',
              generations: u.generations,
              inputTokens: u.inputTokens,
              outputTokens: u.outputTokens,
              totalTokens: u.totalTokens,
              estimatedCost: Number(((u.inputTokens / 1_000_000) * COST_PER_M_INPUT + (u.outputTokens / 1_000_000) * COST_PER_M_OUTPUT).toFixed(4)),
            });
          }
        } catch (err) {
          // Fall back to users without email
          for (const u of topUserEntries) {
            topUsers.push({ ...u, email: 'Unknown', name: '', estimatedCost: 0 });
          }
        }
      }

      routineStats = {
        thisMonthTotal: monthRoutines.length,
        thisWeekTotal: weekRoutines.length,
        totalInputTokens,
        totalOutputTokens,
        totalTokensUsed: totalTokens,
        avgInputTokensPerGen: genCount > 0 ? Math.round(totalInputTokens / genCount) : 0,
        avgOutputTokensPerGen: genCount > 0 ? Math.round(totalOutputTokens / genCount) : 0,
        avgTokensPerGeneration: genCount > 0 ? Math.round(totalTokens / genCount) : 0,
        billingCycle: {
          startDate: monthStart,
          endDate: today,
          generations: monthRoutines.length,
          inputTokens: billingInputTokens,
          outputTokens: billingOutputTokens,
          estimatedCostInput: Number(billingCostInput.toFixed(4)),
          estimatedCostOutput: Number(billingCostOutput.toFixed(4)),
          estimatedCostTotal: Number((billingCostInput + billingCostOutput).toFixed(4)),
        },
        dailyBreakdown,
        topUsers,
      };
    } catch (err) {
      console.error('Failed to fetch routine stats:', err);
    }

    return success({
      allTimeTotal,
      thisMonthTotal,
      thisWeekTotal,
      dailyStats,
      topExercises: exerciseStats,
      topWorkouts: workoutStats,
      tierDistribution: tierDist,
      totalUsers: Object.values(tierDist).reduce((s, n) => s + n, 0),
      routineStats,
    });
  } catch (error) {
    console.error('getAnalyticsOverview error:', error);
    return serverError('Failed to fetch analytics overview');
  }
}

/**
 * GET /api/admin/analytics/trends - Monthly totals for the last 12 months
 */
export async function getAnalyticsTrends(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (!isAdmin(event)) return badRequest('Admin access required');

  try {
    const result = await client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
        ExpressionAttributeValues: {
          ':pk': 'STATS',
          ':prefix': 'MONTHLY#',
        },
        ScanIndexForward: true,
      })
    );

    const trends = (result.Items || [])
      .map((item) => ({
        month: (item.sk as string).replace('MONTHLY#', ''),
        count: item.count || 0,
      }))
      .slice(-12);

    return success(trends);
  } catch (error) {
    console.error('getAnalyticsTrends error:', error);
    return serverError('Failed to fetch analytics trends');
  }
}
