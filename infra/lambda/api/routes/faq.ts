import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  QueryCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, created, badRequest, notFound, serverError } from '../utils/response';
import { isAdmin } from '../utils/auth';
import { randomUUID } from 'crypto';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.TABLE_NAME!;

/**
 * GET /api/faq - List all FAQ items sorted by sortOrder
 */
export async function listFaq(): Promise<APIGatewayProxyResult> {
  try {
    const result = await client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: { ':pk': 'FAQ' },
      })
    );

    const items = (result.Items || []).sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
    );

    return success(items);
  } catch (error) {
    console.error('listFaq error:', error);
    return serverError('Failed to fetch FAQ items');
  }
}

/**
 * POST /api/faq - Create a new FAQ item
 */
export async function createFaq(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (!isAdmin(event)) return badRequest('Admin access required');

  try {
    const body = JSON.parse(event.body || '{}');
    if (!body.q || !body.a) {
      return badRequest('Question (q) and answer (a) are required');
    }

    // Get current max sortOrder
    const existing = await client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: { ':pk': 'FAQ' },
        ProjectionExpression: 'sortOrder',
      })
    );

    const maxOrder = (existing.Items || []).reduce(
      (max, item) => Math.max(max, item.sortOrder ?? 0),
      0
    );

    const id = randomUUID().slice(0, 8);
    const item = {
      pk: 'FAQ',
      sk: `FAQ#${id}`,
      id,
      q: body.q,
      a: body.a,
      sortOrder: maxOrder + 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await client.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: item,
      })
    );

    return created(item);
  } catch (error) {
    console.error('createFaq error:', error);
    return serverError('Failed to create FAQ item');
  }
}

/**
 * PUT /api/faq/{id} - Update an FAQ item
 */
export async function updateFaq(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (!isAdmin(event)) return badRequest('Admin access required');

  const id = event.pathParameters?.id;
  if (!id) return badRequest('FAQ ID is required');

  try {
    const body = JSON.parse(event.body || '{}');
    if (!body.q && !body.a) {
      return badRequest('At least one of question (q) or answer (a) is required');
    }

    const updateExprParts: string[] = ['#updatedAt = :updatedAt'];
    const exprNames: Record<string, string> = { '#updatedAt': 'updatedAt' };
    const exprValues: Record<string, unknown> = {
      ':updatedAt': new Date().toISOString(),
    };

    if (body.q !== undefined) {
      updateExprParts.push('#q = :q');
      exprNames['#q'] = 'q';
      exprValues[':q'] = body.q;
    }

    if (body.a !== undefined) {
      updateExprParts.push('#a = :a');
      exprNames['#a'] = 'a';
      exprValues[':a'] = body.a;
    }

    const result = await client.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { pk: 'FAQ', sk: `FAQ#${id}` },
        UpdateExpression: `SET ${updateExprParts.join(', ')}`,
        ExpressionAttributeNames: exprNames,
        ExpressionAttributeValues: exprValues,
        ConditionExpression: 'attribute_exists(pk)',
        ReturnValues: 'ALL_NEW',
      })
    );

    return success(result.Attributes);
  } catch (error: any) {
    if (error.name === 'ConditionalCheckFailedException') {
      return notFound('FAQ item not found');
    }
    console.error('updateFaq error:', error);
    return serverError('Failed to update FAQ item');
  }
}

/**
 * DELETE /api/faq/{id} - Delete an FAQ item
 */
export async function deleteFaq(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (!isAdmin(event)) return badRequest('Admin access required');

  const id = event.pathParameters?.id;
  if (!id) return badRequest('FAQ ID is required');

  try {
    await client.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { pk: 'FAQ', sk: `FAQ#${id}` },
        ConditionExpression: 'attribute_exists(pk)',
      })
    );

    return success({ deleted: true, id });
  } catch (error: any) {
    if (error.name === 'ConditionalCheckFailedException') {
      return notFound('FAQ item not found');
    }
    console.error('deleteFaq error:', error);
    return serverError('Failed to delete FAQ item');
  }
}

/**
 * PUT /api/faq/reorder - Batch update sortOrder for FAQ items
 * Body: { items: [{ id: string, sortOrder: number }] }
 */
export async function reorderFaq(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (!isAdmin(event)) return badRequest('Admin access required');

  try {
    const body = JSON.parse(event.body || '{}');
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return badRequest('items array is required');
    }

    // DynamoDB BatchWrite can handle up to 25 items per call
    const batchSize = 25;
    for (let i = 0; i < body.items.length; i += batchSize) {
      const batch = body.items.slice(i, i + batchSize);

      // BatchWrite doesn't support UpdateItem, so use individual updates
      await Promise.all(
        batch.map((item: { id: string; sortOrder: number }) =>
          client.send(
            new UpdateCommand({
              TableName: TABLE_NAME,
              Key: { pk: 'FAQ', sk: `FAQ#${item.id}` },
              UpdateExpression: 'SET sortOrder = :order, updatedAt = :now',
              ExpressionAttributeValues: {
                ':order': item.sortOrder,
                ':now': new Date().toISOString(),
              },
            })
          )
        )
      );
    }

    return success({ reordered: true });
  } catch (error) {
    console.error('reorderFaq error:', error);
    return serverError('Failed to reorder FAQ items');
  }
}
