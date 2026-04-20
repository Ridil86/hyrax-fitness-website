import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.TABLE_NAME!;

/**
 * Atomic DynamoDB-backed rate limiter. Returns true if the caller is under the
 * limit (and has been counted), false if over.
 *
 * Windows are rolling via TTL: each call extends the expiry by the window.
 * Fails CLOSED — a DynamoDB error returns false so callers must treat the
 * failure as "over limit" to avoid silent bypass.
 *
 * key: unique identifier for the bucket, e.g. 'COMMUNITY_THREAD#<sub>'
 * max: max requests per window
 * windowSeconds: window size
 */
export async function checkRateLimit(
  key: string,
  max: number,
  windowSeconds: number
): Promise<boolean> {
  const ttl = Math.floor(Date.now() / 1000) + windowSeconds;
  try {
    const result = await client.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { pk: 'RATE_LIMIT', sk: key },
        UpdateExpression:
          'SET #c = if_not_exists(#c, :zero) + :one, #ttl = if_not_exists(#ttl, :ttl)',
        ExpressionAttributeNames: { '#c': 'count', '#ttl': 'ttl' },
        ExpressionAttributeValues: { ':zero': 0, ':one': 1, ':ttl': ttl },
        ReturnValues: 'UPDATED_NEW',
      })
    );
    const count = (result.Attributes?.count as number) || 0;
    return count <= max;
  } catch (err) {
    console.error(`rateLimit: DynamoDB failure for ${key}, failing closed`, err);
    return false;
  }
}
