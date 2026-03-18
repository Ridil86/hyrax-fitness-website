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
 * GET /api/videos - List videos
 * Public/Auth users see only published videos.
 * Admin users see all videos (draft + published).
 * Query params: ?category=&tier=
 */
export async function listVideos(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const admin = isAdmin(event);
    const result = await client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: { ':pk': 'VIDEO' },
      })
    );

    let items = result.Items || [];

    // Non-admin users only see published videos
    if (!admin) {
      items = items.filter((item) => item.status === 'published');
    }

    // Optional filters
    const category = event.queryStringParameters?.category;
    const tier = event.queryStringParameters?.tier;

    if (category) {
      items = items.filter((item) => item.category === category);
    }
    if (tier) {
      items = items.filter((item) => item.requiredTier === tier);
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
    console.error('listVideos error:', error);
    return serverError('Failed to fetch videos');
  }
}

/**
 * GET /api/videos/{id} - Get a single video
 */
export async function getVideo(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const id = event.pathParameters?.id;
  if (!id) return badRequest('Video ID is required');

  try {
    const result = await client.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { pk: 'VIDEO', sk: `VIDEO#${id}` },
      })
    );

    if (!result.Item) {
      return notFound('Video not found');
    }

    // Non-admin users can only view published videos
    if (result.Item.status !== 'published' && !isAdmin(event)) {
      return notFound('Video not found');
    }

    return success(result.Item);
  } catch (error) {
    console.error('getVideo error:', error);
    return serverError('Failed to fetch video');
  }
}

/**
 * POST /api/videos - Create a new video (admin only)
 */
export async function createVideo(
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

    // Default requiredTier by category
    let defaultTier = 'Pup';
    if (body.category === 'full-workout-routine') {
      defaultTier = 'Rock Runner';
    }

    const item = {
      pk: 'VIDEO',
      sk: `VIDEO#${id}`,
      id,
      title: body.title,
      description: body.description || '',
      category: body.category || 'program-explainer',
      thumbnailUrl: body.thumbnailUrl || '',
      videoUrl: body.videoUrl || '',
      requiredTier: body.requiredTier || defaultTier,
      duration: body.duration || '',
      status: body.status || 'draft',
      sortOrder: body.sortOrder ?? 999,
      tags: body.tags || [],
      transcodingStatus: 'pending',
      transcodingJobId: '',
      hlsUrl: '',
      transcodingError: '',
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
    console.error('createVideo error:', error);
    return serverError('Failed to create video');
  }
}

/**
 * PUT /api/videos/{id} - Update a video (admin only)
 */
export async function updateVideo(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (!isAdmin(event)) return badRequest('Admin access required');

  const id = event.pathParameters?.id;
  if (!id) return badRequest('Video ID is required');

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
      'thumbnailUrl',
      'videoUrl',
      'requiredTier',
      'duration',
      'status',
      'sortOrder',
      'tags',
      'transcodingStatus',
      'transcodingJobId',
      'hlsUrl',
      'transcodingError',
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
        Key: { pk: 'VIDEO', sk: `VIDEO#${id}` },
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
      return notFound('Video not found');
    }
    console.error('updateVideo error:', error);
    return serverError('Failed to update video');
  }
}

/**
 * DELETE /api/videos/{id} - Delete a video (admin only)
 */
export async function deleteVideo(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (!isAdmin(event)) return badRequest('Admin access required');

  const id = event.pathParameters?.id;
  if (!id) return badRequest('Video ID is required');

  try {
    await client.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { pk: 'VIDEO', sk: `VIDEO#${id}` },
        ConditionExpression: 'attribute_exists(pk)',
      })
    );

    return success({ deleted: true, id });
  } catch (error: any) {
    if (error.name === 'ConditionalCheckFailedException') {
      return notFound('Video not found');
    }
    console.error('deleteVideo error:', error);
    return serverError('Failed to delete video');
  }
}
