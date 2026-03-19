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
 * GET /api/equipment - List all equipment
 */
export async function listEquipment(
  _event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const result = await client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: { ':pk': 'EQUIPMENT' },
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
    console.error('listEquipment error:', error);
    return serverError('Failed to fetch equipment');
  }
}

/**
 * GET /api/equipment/{id} - Get a single equipment item
 */
export async function getEquipment(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const id = event.pathParameters?.id;
  if (!id) return badRequest('Equipment ID is required');

  try {
    const result = await client.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { pk: 'EQUIPMENT', sk: `EQUIPMENT#${id}` },
      })
    );

    if (!result.Item) {
      return notFound('Equipment not found');
    }

    return success(result.Item);
  } catch (error) {
    console.error('getEquipment error:', error);
    return serverError('Failed to fetch equipment');
  }
}

/**
 * POST /api/equipment - Create a new equipment item (admin only)
 */
export async function createEquipment(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (!isAdmin(event)) return badRequest('Admin access required');

  try {
    const body = JSON.parse(event.body || '{}');

    if (!body.name) {
      return badRequest('Name is required');
    }

    const id = randomUUID().slice(0, 8);
    const now = new Date().toISOString();

    const item = {
      pk: 'EQUIPMENT',
      sk: `EQUIPMENT#${id}`,
      id,
      name: body.name,
      description: body.description || '',
      imageUrl: body.imageUrl || '',
      notes: body.notes || '',
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
    console.error('createEquipment error:', error);
    return serverError('Failed to create equipment');
  }
}

/**
 * PUT /api/equipment/{id} - Update an equipment item (admin only)
 */
export async function updateEquipment(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (!isAdmin(event)) return badRequest('Admin access required');

  const id = event.pathParameters?.id;
  if (!id) return badRequest('Equipment ID is required');

  try {
    const body = JSON.parse(event.body || '{}');

    const updateFields: string[] = ['#updatedAt = :updatedAt'];
    const exprNames: Record<string, string> = { '#updatedAt': 'updatedAt' };
    const exprValues: Record<string, unknown> = {
      ':updatedAt': new Date().toISOString(),
    };

    const allowedFields = ['name', 'description', 'imageUrl', 'notes', 'sortOrder'];

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
        Key: { pk: 'EQUIPMENT', sk: `EQUIPMENT#${id}` },
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
      return notFound('Equipment not found');
    }
    console.error('updateEquipment error:', error);
    return serverError('Failed to update equipment');
  }
}

/**
 * DELETE /api/equipment/{id} - Delete an equipment item (admin only)
 */
export async function deleteEquipment(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (!isAdmin(event)) return badRequest('Admin access required');

  const id = event.pathParameters?.id;
  if (!id) return badRequest('Equipment ID is required');

  try {
    await client.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { pk: 'EQUIPMENT', sk: `EQUIPMENT#${id}` },
        ConditionExpression: 'attribute_exists(pk)',
      })
    );

    return success({ deleted: true, id });
  } catch (error: any) {
    if (error.name === 'ConditionalCheckFailedException') {
      return notFound('Equipment not found');
    }
    console.error('deleteEquipment error:', error);
    return serverError('Failed to delete equipment');
  }
}
