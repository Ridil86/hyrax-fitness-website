import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, badRequest, notFound, serverError } from '../utils/response';
import { isAdmin } from '../utils/auth';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.TABLE_NAME!;

const VALID_SECTIONS = [
  'hero',
  'dassie',
  'method',
  'workouts',
  'programs',
  'testimonials',
  'getstarted',
];

/**
 * GET /api/content/{section} - Get a content section
 */
export async function getContent(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const section = event.pathParameters?.section;
  if (!section || !VALID_SECTIONS.includes(section)) {
    return badRequest(
      `Invalid section. Valid sections: ${VALID_SECTIONS.join(', ')}`
    );
  }

  try {
    const result = await client.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { pk: 'CONTENT', sk: section },
      })
    );

    if (!result.Item) {
      return notFound(`Content section "${section}" not found`);
    }

    return success(result.Item);
  } catch (error) {
    console.error('getContent error:', error);
    return serverError('Failed to fetch content');
  }
}

/**
 * PUT /api/content/{section} - Update a content section
 */
export async function updateContent(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (!isAdmin(event)) return badRequest('Admin access required');

  const section = event.pathParameters?.section;
  if (!section || !VALID_SECTIONS.includes(section)) {
    return badRequest(
      `Invalid section. Valid sections: ${VALID_SECTIONS.join(', ')}`
    );
  }

  try {
    const body = JSON.parse(event.body || '{}');
    if (!body.data) {
      return badRequest('data field is required');
    }

    const item = {
      pk: 'CONTENT',
      sk: section,
      data: body.data,
      updatedAt: new Date().toISOString(),
    };

    await client.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: item,
      })
    );

    return success(item);
  } catch (error) {
    console.error('updateContent error:', error);
    return serverError('Failed to update content');
  }
}
