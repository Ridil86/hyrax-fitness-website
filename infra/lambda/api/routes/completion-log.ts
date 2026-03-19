import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  QueryCommand,
  PutCommand,
  DeleteCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, created, badRequest, forbidden, serverError } from '../utils/response';
import { extractClaims } from '../utils/auth';
import { randomUUID } from 'crypto';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.TABLE_NAME!;

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

    if (!body.exerciseId || !body.exerciseName) {
      return badRequest('exerciseId and exerciseName are required');
    }

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
      type: 'exercise' as const,
      exerciseId: body.exerciseId,
      exerciseName: body.exerciseName,
      workoutId: body.workoutId || '',
      workoutTitle: body.workoutTitle || '',
      difficulty: body.difficulty || 'intermediate',
      sets: Number(body.sets) || 1,
      reps: Number(body.reps) || 0,
      weight: body.weight != null ? Number(body.weight) : undefined,
      weightUnit: body.weightUnit || 'lbs',
      duration: body.duration != null ? Number(body.duration) : undefined,
      rpe: body.rpe != null ? Number(body.rpe) : undefined,
      notes: body.notes || '',
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

    return created(cleanItem);
  } catch (error) {
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

    if (!body.exercises || !Array.isArray(body.exercises) || body.exercises.length === 0) {
      return badRequest('exercises array is required');
    }

    const sessionId = randomUUID().slice(0, 12);
    const now = new Date().toISOString();
    const logs: Record<string, unknown>[] = [];

    for (const ex of body.exercises) {
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

    return success({ deleted: true, id });
  } catch (error) {
    console.error('deleteLog error:', error);
    return serverError('Failed to delete completion log');
  }
}
