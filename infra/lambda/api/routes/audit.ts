import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  QueryCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, created, badRequest, serverError } from '../utils/response';
import { isAdmin } from '../utils/auth';
import { checkRateLimit } from '../utils/rateLimit';
import { randomUUID } from 'crypto';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.TABLE_NAME!;

// Only these event types are acceptable via the PUBLIC /api/audit endpoint.
// Consent events written server-side during signup (TERMS_ACCEPT etc.) must
// NOT be accepted here — otherwise anyone can forge a compliance record.
const PUBLIC_EVENT_TYPES = new Set(['COOKIE_ACCEPT', 'COOKIE_REJECT']);
const PUBLIC_CONSENT_VALUES = new Set(['accepted', 'rejected']);
const ALLOWED_METADATA_KEYS = new Set(['path', 'referrer', 'source']);

/**
 * POST /api/audit - Log a cookie-consent event (PUBLIC, allow-listed)
 */
export async function logAuditEvent(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const ip = event.requestContext?.identity?.sourceIp || 'unknown';
    if (!(await checkRateLimit(`AUDIT#${ip}`, 30, 3600))) {
      return badRequest('Rate limit exceeded');
    }

    const body = JSON.parse(event.body || '{}');

    if (typeof body.eventType !== 'string' || !PUBLIC_EVENT_TYPES.has(body.eventType)) {
      return badRequest('Invalid eventType');
    }

    let consentValue: string | null = null;
    if (body.consentValue !== undefined && body.consentValue !== null) {
      if (typeof body.consentValue !== 'string' || !PUBLIC_CONSENT_VALUES.has(body.consentValue)) {
        return badRequest('Invalid consentValue');
      }
      consentValue = body.consentValue;
    }

    // Strip metadata to allow-listed keys, and cap each value length.
    const metadata: Record<string, string> = {};
    if (body.metadata && typeof body.metadata === 'object') {
      for (const key of Object.keys(body.metadata)) {
        if (!ALLOWED_METADATA_KEYS.has(key)) continue;
        const v = body.metadata[key];
        if (typeof v !== 'string') continue;
        metadata[key] = v.slice(0, 500);
      }
    }

    const now = new Date().toISOString();
    const uuid8 = randomUUID().slice(0, 8);

    const item = {
      pk: 'AUDIT',
      sk: `${now}#${uuid8}`,
      eventType: body.eventType,
      consentValue,
      userAgent: (
        event.headers['User-Agent'] ||
        event.headers['user-agent'] ||
        ''
      ).slice(0, 500),
      ipAddress: event.requestContext?.identity?.sourceIp || null,
      metadata,
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
