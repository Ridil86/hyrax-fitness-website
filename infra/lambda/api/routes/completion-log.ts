import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  QueryCommand,
  PutCommand,
  DeleteCommand,
  UpdateCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, created, badRequest, forbidden, serverError } from '../utils/response';
import { extractClaims } from '../utils/auth';
import {
  limitString,
  limitStringOptional,
  limitArray,
  limitNumber,
  ValidationError,
} from '../utils/validate';
import { randomUUID } from 'crypto';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.TABLE_NAME!;

/**
 * Update pre-computed aggregate stats records.
 * Called after creating or deleting a log. `delta` is +1 or -1.
 */
async function updateAggregates(
  log: { exerciseId?: string; workoutId?: string; userSub?: string; sets?: number; reps?: number; rpe?: number; completedAt?: string },
  delta: number
) {
  const date = (log.completedAt || new Date().toISOString()).slice(0, 10);
  const month = date.slice(0, 7);

  const updates = [];

  // Daily total
  updates.push(
    client.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { pk: 'STATS', sk: `DAILY#${date}` },
      UpdateExpression: 'ADD #cnt :d',
      ExpressionAttributeNames: { '#cnt': 'count' },
      ExpressionAttributeValues: { ':d': delta },
    }))
  );

  // Monthly total
  updates.push(
    client.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { pk: 'STATS', sk: `MONTHLY#${month}` },
      UpdateExpression: 'ADD #cnt :d',
      ExpressionAttributeNames: { '#cnt': 'count' },
      ExpressionAttributeValues: { ':d': delta },
    }))
  );

  // Per-exercise monthly
  if (log.exerciseId) {
    updates.push(
      client.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { pk: 'STATS', sk: `EXERCISE#${log.exerciseId}#${month}` },
        UpdateExpression: 'ADD #cnt :d, #sets :s, #reps :r SET #name = if_not_exists(#name, :empty)',
        ExpressionAttributeNames: { '#cnt': 'count', '#sets': 'totalSets', '#reps': 'totalReps', '#name': 'exerciseName' },
        ExpressionAttributeValues: { ':d': delta, ':s': (log.sets || 0) * delta, ':r': (log.reps || 0) * delta, ':empty': '' },
      }))
    );
  }

  // Per-workout monthly
  if (log.workoutId) {
    updates.push(
      client.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { pk: 'STATS', sk: `WORKOUT#${log.workoutId}#${month}` },
        UpdateExpression: 'ADD #cnt :d SET #name = if_not_exists(#name, :empty)',
        ExpressionAttributeNames: { '#cnt': 'count', '#name': 'workoutTitle' },
        ExpressionAttributeValues: { ':d': delta, ':empty': '' },
      }))
    );
  }

  await Promise.allSettled(updates);
}

/**
 * POST /api/logs - Create a single exercise completion log
 */
export async function createLog(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const claims = extractClaims(event);
  if (!claims?.sub) return forbidden('Authentication required');

  try {
    const body = JSON.parse(event.body || '{}');

    const exerciseId = limitString(body.exerciseId, 100, 'exerciseId');
    const exerciseName = limitString(body.exerciseName, 200, 'exerciseName');
    const sets = body.sets != null ? limitNumber(body.sets, 0, 100, 'sets') : 1;
    const reps = body.reps != null ? limitNumber(body.reps, 0, 10000, 'reps') : 0;
    const weight = body.weight != null ? limitNumber(body.weight, 0, 10000, 'weight') : undefined;
    const duration = body.duration != null ? limitNumber(body.duration, 0, 86400, 'duration') : undefined;
    const rpe = body.rpe != null ? limitNumber(body.rpe, 0, 10, 'rpe') : undefined;
    const notes = limitStringOptional(body.notes, 1000, 'notes') || '';
    const workoutTitle = limitStringOptional(body.workoutTitle, 200, 'workoutTitle') || '';

    const id = randomUUID().slice(0, 8);
    const now = new Date().toISOString();

    const item = {
      pk: `USER#${claims.sub}`,
      sk: `LOG#${now}#${id}`,
      gsi1pk: 'LOG',
      gsi1sk: `${now}#${claims.sub}`,
      id,
      userSub: claims.sub,
      userEmail: claims.email || '',
      sessionId: body.sessionId || id,
      type: (body.type === 'benchmark' ? 'benchmark' : 'exercise') as string,
      exerciseId,
      exerciseName,
      workoutId: body.workoutId || '',
      workoutTitle,
      difficulty: body.difficulty || 'intermediate',
      sets,
      reps,
      weight,
      weightUnit: body.weightUnit || 'lbs',
      duration,
      rpe,
      notes,
      source: body.source || 'manual',
      sourceId: body.sourceId || '',
      completedAt: now,
    };

    // Remove undefined values for DynamoDB
    const cleanItem = Object.fromEntries(
      Object.entries(item).filter(([, v]) => v !== undefined)
    );

    await client.send(
      new PutCommand({ TableName: TABLE_NAME, Item: cleanItem })
    );

    // Update aggregates (fire-and-forget)
    updateAggregates(item, 1).catch(() => {});

    return created(cleanItem);
  } catch (error) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error('createLog error:', error);
    return serverError('Failed to create completion log');
  }
}

/**
 * POST /api/logs/workout - Log completion of an entire workout
 * Creates one log per exercise in the workout, grouped by sessionId
 */
export async function createWorkoutLog(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const claims = extractClaims(event);
  if (!claims?.sub) return forbidden('Authentication required');

  try {
    const body = JSON.parse(event.body || '{}');

    let exercises: any[];
    try {
      exercises = limitArray(body.exercises, 50, 'exercises');
    } catch (err) {
      return badRequest(err instanceof ValidationError ? err.message : 'Invalid exercises');
    }
    if (exercises.length === 0) return badRequest('exercises array is required');

    const sessionId = randomUUID().slice(0, 12);
    const now = new Date().toISOString();
    const logs: Record<string, unknown>[] = [];

    for (const ex of exercises) {
      const id = randomUUID().slice(0, 8);
      const ts = new Date(Date.now() + logs.length).toISOString(); // offset by 1ms per exercise for unique SK

      const item: Record<string, unknown> = {
        pk: `USER#${claims.sub}`,
        sk: `LOG#${ts}#${id}`,
        gsi1pk: 'LOG',
        gsi1sk: `${ts}#${claims.sub}`,
        id,
        userSub: claims.sub,
        userEmail: claims.email || '',
        sessionId,
        type: 'exercise',
        exerciseId: ex.exerciseId || '',
        exerciseName: ex.exerciseName || '',
        workoutId: body.workoutId || '',
        workoutTitle: body.workoutTitle || '',
        difficulty: ex.difficulty || body.difficulty || 'intermediate',
        sets: Number(ex.sets) || 1,
        reps: Number(ex.reps) || 0,
        notes: ex.notes || '',
        source: body.source || 'workout',
        sourceId: body.sourceId || body.workoutId || '',
        completedAt: ts,
      };

      if (ex.weight != null) item.weight = Number(ex.weight);
      if (ex.weightUnit) item.weightUnit = ex.weightUnit;
      if (ex.duration != null) item.duration = Number(ex.duration);
      if (ex.rpe != null) item.rpe = Number(ex.rpe);
      if (ex.rating != null || body.rating != null) item.rating = Number(ex.rating ?? body.rating);
      if (body.workoutDuration != null) item.workoutDuration = Number(body.workoutDuration);

      logs.push(item);
    }

    // DynamoDB BatchWriteItem supports max 25 items per batch
    const batches = [];
    for (let i = 0; i < logs.length; i += 25) {
      batches.push(logs.slice(i, i + 25));
    }

    for (const batch of batches) {
      await client.send(
        new BatchWriteCommand({
          RequestItems: {
            [TABLE_NAME]: batch.map((item) => ({
              PutRequest: { Item: item },
            })),
          },
        })
      );
    }

    // Update aggregates for each log (fire-and-forget)
    Promise.allSettled(logs.map((log) => updateAggregates(log as any, 1))).catch(() => {});

    return created({ sessionId, count: logs.length, logs });
  } catch (error) {
    console.error('createWorkoutLog error:', error);
    return serverError('Failed to create workout completion log');
  }
}

/**
 * GET /api/logs - List current user's completion logs
 * Query params: ?exerciseId=X, ?workoutId=X, ?from=ISO, ?to=ISO, ?limit=N
 */
export async function listUserLogs(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const claims = extractClaims(event);
  if (!claims?.sub) return forbidden('Authentication required');

  try {
    const params = event.queryStringParameters || {};
    const limit = Math.min(Number(params.limit) || 100, 500);

    let keyCondition = 'pk = :pk';
    const exprValues: Record<string, unknown> = {
      ':pk': `USER#${claims.sub}`,
    };

    // SK range filter for time-based queries
    if (params.from || params.to) {
      const from = params.from || '2000-01-01';
      const to = params.to || '2099-12-31';
      keyCondition += ' AND sk BETWEEN :skFrom AND :skTo';
      exprValues[':skFrom'] = `LOG#${from}`;
      exprValues[':skTo'] = `LOG#${to}~`;
    } else {
      keyCondition += ' AND begins_with(sk, :skPrefix)';
      exprValues[':skPrefix'] = 'LOG#';
    }

    const result = await client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: keyCondition,
        ExpressionAttributeValues: exprValues,
        ScanIndexForward: false, // newest first
        Limit: limit,
      })
    );

    let items = result.Items || [];

    // Post-query filters
    if (params.exerciseId) {
      items = items.filter((i) => i.exerciseId === params.exerciseId);
    }
    if (params.workoutId) {
      items = items.filter((i) => i.workoutId === params.workoutId);
    }

    return success(items);
  } catch (error) {
    console.error('listUserLogs error:', error);
    return serverError('Failed to fetch completion logs');
  }
}

/**
 * GET /api/logs/stats - Get current user's completion stats
 */
export async function getLogStats(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const claims = extractClaims(event);
  if (!claims?.sub) return forbidden('Authentication required');

  try {
    const result = await client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': `USER#${claims.sub}`,
          ':skPrefix': 'LOG#',
        },
      })
    );

    const items = result.Items || [];
    const sessions = new Set(items.map((i) => i.sessionId));
    const exercises = new Set(items.map((i) => i.exerciseId));
    const workouts = new Set(items.filter((i) => i.workoutId).map((i) => i.workoutId));

    // Calculate streak (consecutive days with at least one log)
    const daySet = new Set<string>();
    items.forEach((i) => {
      if (i.completedAt) {
        daySet.add(i.completedAt.slice(0, 10));
      }
    });
    const sortedDays = Array.from(daySet).sort().reverse();
    let streak = 0;
    const today = new Date().toISOString().slice(0, 10);
    for (let i = 0; i < sortedDays.length; i++) {
      const expected = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      if (sortedDays[i] === expected || (i === 0 && sortedDays[i] === today)) {
        streak++;
      } else if (i === 0) {
        // Allow streak to start from yesterday
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        if (sortedDays[i] === yesterday) {
          streak++;
        } else {
          break;
        }
      } else {
        break;
      }
    }

    return success({
      totalLogs: items.length,
      totalSessions: sessions.size,
      uniqueExercises: exercises.size,
      uniqueWorkouts: workouts.size,
      currentStreak: streak,
      lastActivity: items[0]?.completedAt || null,
    });
  } catch (error) {
    console.error('getLogStats error:', error);
    return serverError('Failed to fetch completion stats');
  }
}

/**
 * GET /api/logs/exercise-history?exerciseId=X - Get logs for a specific exercise
 * Returns chronological logs for charting weight/volume/RPE progression
 */
export async function getExerciseHistory(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const claims = extractClaims(event);
  if (!claims?.sub) return forbidden('Authentication required');

  const exerciseId = event.queryStringParameters?.exerciseId;
  if (!exerciseId) return badRequest('exerciseId query parameter is required');

  try {
    const result = await client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': `USER#${claims.sub}`,
          ':skPrefix': 'LOG#',
        },
        ScanIndexForward: true, // oldest first for charting
      })
    );

    const items = (result.Items || []).filter((i) => i.exerciseId === exerciseId);

    return success(items);
  } catch (error) {
    console.error('getExerciseHistory error:', error);
    return serverError('Failed to fetch exercise history');
  }
}

/**
 * GET /api/logs/calendar?year=2026&month=3 - Get day-level activity counts
 * Returns { "2026-03-01": 5, "2026-03-03": 2, ... }
 */
export async function getCalendarData(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const claims = extractClaims(event);
  if (!claims?.sub) return forbidden('Authentication required');

  const params = event.queryStringParameters || {};
  const year = params.year || new Date().getFullYear().toString();
  const month = params.month ? params.month.padStart(2, '0') : (new Date().getMonth() + 1).toString().padStart(2, '0');

  const from = `${year}-${month}-01`;
  const to = `${year}-${month}-31`;

  try {
    const result = await client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk AND sk BETWEEN :skFrom AND :skTo',
        ExpressionAttributeValues: {
          ':pk': `USER#${claims.sub}`,
          ':skFrom': `LOG#${from}`,
          ':skTo': `LOG#${to}~`,
        },
      })
    );

    const dayCounts: Record<string, number> = {};
    (result.Items || []).forEach((item) => {
      const day = (item.completedAt || '').slice(0, 10);
      if (day) {
        dayCounts[day] = (dayCounts[day] || 0) + 1;
      }
    });

    return success(dayCounts);
  } catch (error) {
    console.error('getCalendarData error:', error);
    return serverError('Failed to fetch calendar data');
  }
}

/**
 * DELETE /api/logs/{id} - Delete own completion log
 */
export async function deleteLog(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const claims = extractClaims(event);
  if (!claims?.sub) return forbidden('Authentication required');

  const id = event.pathParameters?.id;
  if (!id) return badRequest('Log ID is required');

  try {
    // Find the log first to get the full SK
    const result = await client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': `USER#${claims.sub}`,
          ':skPrefix': 'LOG#',
        },
      })
    );

    const log = (result.Items || []).find((i) => i.id === id);
    if (!log) return badRequest('Log not found');

    await client.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { pk: log.pk, sk: log.sk },
      })
    );

    // Decrement aggregates (fire-and-forget)
    updateAggregates(log, -1).catch(() => {});

    return success({ deleted: true, id });
  } catch (error) {
    console.error('deleteLog error:', error);
    return serverError('Failed to delete completion log');
  }
}

/**
 * GET /api/logs/benchmarks - Get user's benchmark history grouped by exercise
 */
export async function getBenchmarkHistory(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const claims = extractClaims(event);
  if (!claims?.sub) return forbidden('Authentication required');

  try {
    const result = await client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
        ExpressionAttributeValues: {
          ':pk': `USER#${claims.sub}`,
          ':prefix': 'LOG#',
        },
        ScanIndexForward: true,
      })
    );

    const benchmarks = (result.Items || []).filter((item) => item.type === 'benchmark');

    // Group by exerciseId
    const grouped: Record<string, {
      exerciseId: string;
      exerciseName: string;
      entries: Array<{
        date: string;
        value: number;
        unit: string;
        reps?: number;
        weight?: number;
        duration?: number;
        notes?: string;
      }>;
    }> = {};

    for (const b of benchmarks) {
      const exId = b.exerciseId;
      if (!grouped[exId]) {
        grouped[exId] = {
          exerciseId: exId,
          exerciseName: b.exerciseName || exId,
          entries: [],
        };
      }
      grouped[exId].entries.push({
        date: (b.completedAt || '').slice(0, 10),
        value: b.weight || b.reps || b.duration || 0,
        unit: b.weight ? (b.weightUnit || 'lbs') : b.duration ? 'sec' : 'reps',
        reps: b.reps,
        weight: b.weight,
        duration: b.duration,
        notes: b.notes,
      });
    }

    return success({
      benchmarks: Object.values(grouped),
      totalEntries: benchmarks.length,
    });
  } catch (error) {
    console.error('getBenchmarkHistory error:', error);
    return serverError('Failed to fetch benchmark history');
  }
}
