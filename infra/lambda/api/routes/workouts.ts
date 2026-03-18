import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  QueryCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  GetCommand,
} from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, created, badRequest, notFound, serverError } from '../utils/response';
import { isAdmin, extractClaims } from '../utils/auth';
import { randomUUID } from 'crypto';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.TABLE_NAME!;

/**
 * GET /api/workouts - List workouts
 * Public/Auth users see only published workouts.
 * Admin users see all workouts (draft + published).
 * Query params: ?category=&difficulty=
 */
export async function listWorkouts(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const admin = isAdmin(event);
    const result = await client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: { ':pk': 'WORKOUT' },
      })
    );

    let items = result.Items || [];

    // Non-admin users only see published workouts
    if (!admin) {
      items = items.filter((item) => item.status === 'published');
    }

    // Optional filters
    const category = event.queryStringParameters?.category;
    const difficulty = event.queryStringParameters?.difficulty;

    if (category) {
      items = items.filter((item) => item.category === category);
    }
    if (difficulty) {
      items = items.filter((item) => item.difficulty === difficulty);
    }

    // Sort by sortOrder, then createdAt descending
    items.sort((a, b) => {
      if ((a.sortOrder ?? 999) !== (b.sortOrder ?? 999)) {
        return (a.sortOrder ?? 999) - (b.sortOrder ?? 999);
      }
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });

    return success(items);
  } catch (error) {
    console.error('listWorkouts error:', error);
    return serverError('Failed to fetch workouts');
  }
}

/**
 * GET /api/workouts/{id} - Get a single workout
 */
export async function getWorkout(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const id = event.pathParameters?.id;
  if (!id) return badRequest('Workout ID is required');

  try {
    const result = await client.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { pk: 'WORKOUT', sk: `WORKOUT#${id}` },
      })
    );

    if (!result.Item) {
      return notFound('Workout not found');
    }

    // Non-admin users can only view published workouts
    if (result.Item.status !== 'published' && !isAdmin(event)) {
      return notFound('Workout not found');
    }

    return success(result.Item);
  } catch (error) {
    console.error('getWorkout error:', error);
    return serverError('Failed to fetch workout');
  }
}

/**
 * POST /api/workouts - Create a new workout (admin only)
 */
export async function createWorkout(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (!isAdmin(event)) return badRequest('Admin access required');

  try {
    const body = JSON.parse(event.body || '{}');

    if (!body.title) {
      return badRequest('Title is required');
    }

    const id = randomUUID().slice(0, 8);
    const claims = extractClaims(event);
    const now = new Date().toISOString();

    const item = {
      pk: 'WORKOUT',
      sk: `WORKOUT#${id}`,
      id,
      title: body.title,
      description: body.description || '',
      category: body.category || 'general',
      difficulty: body.difficulty || 'intermediate',
      duration: body.duration || '',
      equipment: body.equipment || [],
      exercises: body.exercises || [],
      imageUrl: body.imageUrl || '',
      requiredTier: body.requiredTier || 'Pup',
      status: body.status || 'draft',
      sortOrder: body.sortOrder ?? 999,
      createdBy: claims?.email || 'unknown',
      createdAt: now,
      updatedAt: now,
    };

    await client.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: item,
      })
    );

    return created(item);
  } catch (error) {
    console.error('createWorkout error:', error);
    return serverError('Failed to create workout');
  }
}

/**
 * PUT /api/workouts/{id} - Update a workout (admin only)
 */
export async function updateWorkout(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (!isAdmin(event)) return badRequest('Admin access required');

  const id = event.pathParameters?.id;
  if (!id) return badRequest('Workout ID is required');

  try {
    const body = JSON.parse(event.body || '{}');

    // Build dynamic update expression
    const updateFields: string[] = ['#updatedAt = :updatedAt'];
    const exprNames: Record<string, string> = { '#updatedAt': 'updatedAt' };
    const exprValues: Record<string, unknown> = {
      ':updatedAt': new Date().toISOString(),
    };

    const allowedFields = [
      'title',
      'description',
      'category',
      'difficulty',
      'duration',
      'equipment',
      'exercises',
      'imageUrl',
      'requiredTier',
      'status',
      'sortOrder',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateFields.push(`#${field} = :${field}`);
        exprNames[`#${field}`] = field;
        exprValues[`:${field}`] = body[field];
      }
    }

    const result = await client.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { pk: 'WORKOUT', sk: `WORKOUT#${id}` },
        UpdateExpression: `SET ${updateFields.join(', ')}`,
        ExpressionAttributeNames: exprNames,
        ExpressionAttributeValues: exprValues,
        ConditionExpression: 'attribute_exists(pk)',
        ReturnValues: 'ALL_NEW',
      })
    );

    return success(result.Attributes);
  } catch (error: any) {
    if (error.name === 'ConditionalCheckFailedException') {
      return notFound('Workout not found');
    }
    console.error('updateWorkout error:', error);
    return serverError('Failed to update workout');
  }
}

/**
 * DELETE /api/workouts/{id} - Delete a workout (admin only)
 */
export async function deleteWorkout(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (!isAdmin(event)) return badRequest('Admin access required');

  const id = event.pathParameters?.id;
  if (!id) return badRequest('Workout ID is required');

  try {
    await client.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { pk: 'WORKOUT', sk: `WORKOUT#${id}` },
        ConditionExpression: 'attribute_exists(pk)',
      })
    );

    return success({ deleted: true, id });
  } catch (error: any) {
    if (error.name === 'ConditionalCheckFailedException') {
      return notFound('Workout not found');
    }
    console.error('deleteWorkout error:', error);
    return serverError('Failed to delete workout');
  }
}
