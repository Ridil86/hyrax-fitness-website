import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  QueryCommand,
  ScanCommand,
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

    return success({
      allTimeTotal,
      thisMonthTotal,
      thisWeekTotal,
      dailyStats,
      topExercises: exerciseStats,
      topWorkouts: workoutStats,
      tierDistribution: tierDist,
      totalUsers: Object.values(tierDist).reduce((s, n) => s + n, 0),
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
