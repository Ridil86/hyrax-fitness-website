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
import { isAdmin } from '../utils/auth';
import { randomUUID } from 'crypto';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.TABLE_NAME!;

/**
 * GET /api/exercises - List all exercises
 */
export async function listExercises(
  _event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const result = await client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: { ':pk': 'EXERCISE' },
      })
    );

    const items = (result.Items || []).sort((a, b) => {
      if ((a.sortOrder ?? 999) !== (b.sortOrder ?? 999)) {
        return (a.sortOrder ?? 999) - (b.sortOrder ?? 999);
      }
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });

    return success(items);
  } catch (error) {
    console.error('listExercises error:', error);
    return serverError('Failed to fetch exercises');
  }
}

/**
 * GET /api/exercises/{id} - Get a single exercise
 */
export async function getExercise(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const id = event.pathParameters?.id;
  if (!id) return badRequest('Exercise ID is required');

  try {
    const result = await client.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { pk: 'EXERCISE', sk: `EXERCISE#${id}` },
      })
    );

    if (!result.Item) {
      return notFound('Exercise not found');
    }

    return success(result.Item);
  } catch (error) {
    console.error('getExercise error:', error);
    return serverError('Failed to fetch exercise');
  }
}

/**
 * POST /api/exercises - Create a new exercise (admin only)
 */
export async function createExercise(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (!isAdmin(event)) return badRequest('Admin access required');

  try {
    const body = JSON.parse(event.body || '{}');

    if (!body.name) {
      return badRequest('Name is required');
    }

    if (body.modifications && typeof body.modifications === 'object'
        && Object.keys(body.modifications).length > 20) {
      return badRequest('modifications cannot exceed 20 entries');
    }
    if (Array.isArray(body.tags) && body.tags.length > 20) {
      return badRequest('tags cannot exceed 20 items');
    }

    const id = randomUUID().slice(0, 8);
    const now = new Date().toISOString();

    const item = {
      pk: 'EXERCISE',
      sk: `EXERCISE#${id}`,
      id,
      name: body.name,
      description: body.description || '',
      imageUrl: body.imageUrl || '',
      notes: body.notes || '',
      modifications: body.modifications || {},
      tags: body.tags || [],
      sortOrder: body.sortOrder ?? 999,
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
    console.error('createExercise error:', error);
    return serverError('Failed to create exercise');
  }
}

/**
 * PUT /api/exercises/{id} - Update an exercise (admin only)
 */
export async function updateExercise(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (!isAdmin(event)) return badRequest('Admin access required');

  const id = event.pathParameters?.id;
  if (!id) return badRequest('Exercise ID is required');

  try {
    const body = JSON.parse(event.body || '{}');

    if (body.modifications && typeof body.modifications === 'object'
        && Object.keys(body.modifications).length > 20) {
      return badRequest('modifications cannot exceed 20 entries');
    }
    if (Array.isArray(body.tags) && body.tags.length > 20) {
      return badRequest('tags cannot exceed 20 items');
    }

    const updateFields: string[] = ['#updatedAt = :updatedAt'];
    const exprNames: Record<string, string> = { '#updatedAt': 'updatedAt' };
    const exprValues: Record<string, unknown> = {
      ':updatedAt': new Date().toISOString(),
    };

    const allowedFields = ['name', 'description', 'imageUrl', 'notes', 'modifications', 'tags', 'sortOrder'];

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
        Key: { pk: 'EXERCISE', sk: `EXERCISE#${id}` },
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
      return notFound('Exercise not found');
    }
    console.error('updateExercise error:', error);
    return serverError('Failed to update exercise');
  }
}

/**
 * DELETE /api/exercises/{id} - Delete an exercise (admin only)
 */
export async function deleteExercise(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (!isAdmin(event)) return badRequest('Admin access required');

  const id = event.pathParameters?.id;
  if (!id) return badRequest('Exercise ID is required');

  try {
    await client.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { pk: 'EXERCISE', sk: `EXERCISE#${id}` },
        ConditionExpression: 'attribute_exists(pk)',
      })
    );

    return success({ deleted: true, id });
  } catch (error: any) {
    if (error.name === 'ConditionalCheckFailedException') {
      return notFound('Exercise not found');
    }
    console.error('deleteExercise error:', error);
    return serverError('Failed to delete exercise');
  }
}
