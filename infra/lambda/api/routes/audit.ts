import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  QueryCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, created, badRequest, serverError } from '../utils/response';
import { isAdmin } from '../utils/auth';
import { randomUUID } from 'crypto';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.TABLE_NAME!;

/**
 * POST /api/audit - Log a compliance/consent event (PUBLIC)
 */
export async function logAuditEvent(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const body = JSON.parse(event.body || '{}');

    if (!body.eventType) {
      return badRequest('eventType is required');
    }

    const now = new Date().toISOString();
    const uuid8 = randomUUID().slice(0, 8);

    const item = {
      pk: 'AUDIT',
      sk: `${now}#${uuid8}`,
      eventType: body.eventType,
      consentValue: body.consentValue || null,
      userAgent:
        event.headers['User-Agent'] ||
        event.headers['user-agent'] ||
        null,
      ipAddress: event.requestContext?.identity?.sourceIp || null,
      metadata: body.metadata || {},
      createdAt: now,
    };

    await client.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: item,
      })
    );

    return created({ logged: true, eventType: item.eventType });
  } catch (error) {
    console.error('logAuditEvent error:', error);
    return serverError('Failed to log audit event');
  }
}

/**
 * GET /api/audit - List audit log entries (ADMIN)
 * Query params: limit (default 50), nextToken, eventType
 */
export async function listAuditLogs(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (!isAdmin(event)) return badRequest('Admin access required');

  try {
    const params = event.queryStringParameters || {};
    const limit = Math.min(parseInt(params.limit || '50', 10) || 50, 200);
    const eventTypeFilter = params.eventType || null;

    const queryParams: Record<string, unknown> = {
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: { ':pk': 'AUDIT' } as Record<string, unknown>,
      ScanIndexForward: false, // newest first
      Limit: limit,
    };

    // Pagination via exclusive start key
    if (params.nextToken) {
      try {
        queryParams.ExclusiveStartKey = JSON.parse(
          Buffer.from(params.nextToken, 'base64').toString('utf-8')
        );
      } catch {
        return badRequest('Invalid nextToken');
      }
    }

    // Optional filter by event type
    if (eventTypeFilter) {
      queryParams.FilterExpression = 'eventType = :eventType';
      (queryParams.ExpressionAttributeValues as Record<string, unknown>)[
        ':eventType'
      ] = eventTypeFilter;
    }

    const result = await client.send(new QueryCommand(queryParams as any));

    const response: Record<string, unknown> = {
      items: result.Items || [],
      count: result.Count || 0,
    };

    if (result.LastEvaluatedKey) {
      response.nextToken = Buffer.from(
        JSON.stringify(result.LastEvaluatedKey)
      ).toString('base64');
    }

    return success(response);
  } catch (error) {
    console.error('listAuditLogs error:', error);
    return serverError('Failed to fetch audit logs');
  }
}

/**
 * GET /api/audit/stats - Get audit summary statistics (ADMIN)
 */
export async function getAuditStats(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (!isAdmin(event)) return badRequest('Admin access required');

  try {
    // Query all audit events (lightweight -- only need eventType and createdAt)
    const result = await client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: { ':pk': 'AUDIT' },
        ProjectionExpression: 'eventType, createdAt',
      })
    );

    const items = result.Items || [];
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    let total = 0;
    let accepts = 0;
    let rejects = 0;
    let last24h = 0;

    for (const item of items) {
      total++;
      if (item.eventType === 'COOKIE_ACCEPT') accepts++;
      if (item.eventType === 'COOKIE_REJECT') rejects++;
      if (item.createdAt && new Date(item.createdAt).getTime() > oneDayAgo) {
        last24h++;
      }
    }

    return success({ total, accepts, rejects, last24h });
  } catch (error) {
    console.error('getAuditStats error:', error);
    return serverError('Failed to fetch audit stats');
  }
}
