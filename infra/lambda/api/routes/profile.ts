import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, forbidden, serverError } from '../utils/response';
import { extractClaims } from '../utils/auth';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.TABLE_NAME!;

/**
 * GET /api/profile - Get the current user's profile (AUTHENTICATED)
 */
export async function getProfile(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const claims = extractClaims(event);
  if (!claims?.sub) {
    return forbidden('Authentication required');
  }

  try {
    const result = await client.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          pk: `USER#${claims.sub}`,
          sk: 'PROFILE',
        },
      })
    );

    return success(result.Item || null);
  } catch (error) {
    console.error('getProfile error:', error);
    return serverError('Failed to fetch profile');
  }
}
