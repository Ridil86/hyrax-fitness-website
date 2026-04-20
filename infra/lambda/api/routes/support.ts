import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  QueryCommand,
  PutCommand,
  UpdateCommand,
  GetCommand,
} from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, created, badRequest, notFound, serverError } from '../utils/response';
import { isAdmin, extractClaims } from '../utils/auth';
import {
  limitString,
  limitStringOptional,
  limitEnum,
  limitEnumOptional,
  ValidationError,
} from '../utils/validate';
import { checkRateLimit } from '../utils/rateLimit';
import { randomUUID } from 'crypto';
import { sendNotification } from '../utils/email';
import { supportReplyEmail } from '../../custom-message/templates';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.TABLE_NAME!;

const TICKET_CATEGORIES = [
  'general',
  'billing',
  'technical',
  'account',
  'feature',
  'bug',
] as const;
const TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;
const TICKET_PRIORITIES = ['low', 'medium', 'high'] as const;

/* ── Helpers ── */

async function getUserProfile(sub: string) {
  const result = await client.send(
    new GetCommand({ TableName: TABLE_NAME, Key: { pk: `USER#${sub}`, sk: 'PROFILE' } })
  );
  const p = result.Item;
  if (!p) return { userName: 'Unknown', userEmail: '', userTier: 'Pup' };
  const name = [p.givenName, p.familyName].filter(Boolean).join(' ') || p.email || 'Unknown';
  return { userName: name, userEmail: p.email || '', userTier: p.tier || 'Pup' };
}

function tierToPriority(tier: string): string {
  if (tier === 'Iron Dassie') return 'high';
  if (tier === 'Rock Runner') return 'medium';
  return 'low';
}

function priorityRank(priority: string): number {
  if (priority === 'high') return 0;
  if (priority === 'medium') return 1;
  return 2;
}

async function getNextRefNumber(): Promise<string> {
  const result = await client.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { pk: 'TICKET_CONFIG', sk: 'COUNTER' },
      UpdateExpression: 'ADD lastNumber :inc',
      ExpressionAttributeValues: { ':inc': 1 },
      ReturnValues: 'ALL_NEW',
    })
  );
  const num = (result.Attributes?.lastNumber as number) || 1;
  return `HF-${String(num).padStart(5, '0')}`;
}

// ─────────────────────────────────────────────────
// TICKETS
// ─────────────────────────────────────────────────

/**
 * GET /api/support/tickets
 * Users see only their own tickets. Admin sees all.
 * Query params: ?status=&priority=&category=
 */
export async function listTickets(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const claims = extractClaims(event);
  if (!claims) return badRequest('Authentication required');

  try {
    const admin = isAdmin(event);
    let items: Record<string, unknown>[];

    if (admin) {
      // Admin sees all tickets
      const result = await client.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: 'pk = :pk',
          ExpressionAttributeValues: { ':pk': 'TICKET' },
        })
      );
      items = (result.Items || []) as Record<string, unknown>[];
    } else {
      // User sees only their own via GSI1
      const result = await client.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: 'GSI1',
          KeyConditionExpression: 'gsi1pk = :gsi1pk',
          ExpressionAttributeValues: { ':gsi1pk': `TICKET_USER#${claims.sub}` },
          ScanIndexForward: false,
        })
      );
      items = (result.Items || []) as Record<string, unknown>[];
    }

    // Optional filters
    const status = event.queryStringParameters?.status;
    const priority = event.queryStringParameters?.priority;
    const category = event.queryStringParameters?.category;
    const assignedTo = event.queryStringParameters?.assignedTo;

    if (status && status !== 'all') {
      items = items.filter((t) => t.status === status);
    }
    if (priority && priority !== 'all') {
      items = items.filter((t) => t.priority === priority);
    }
    if (category && category !== 'all') {
      items = items.filter((t) => t.category === category);
    }
    if (assignedTo) {
      items = items.filter((t) => t.assignedTo === assignedTo);
    }

    // Sort: priority first (high→medium→low), then newest
    items.sort((a, b) => {
      const pa = priorityRank(String(a.priority || 'low'));
      const pb = priorityRank(String(b.priority || 'low'));
      if (pa !== pb) return pa - pb;
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });

    return success(items);
  } catch (error) {
    console.error('listTickets error:', error);
    return serverError('Failed to fetch tickets');
  }
}

/**
 * POST /api/support/tickets
 * Create a new support ticket
 */
export async function createTicket(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const claims = extractClaims(event);
  if (!claims) return badRequest('Authentication required');

  try {
    if (!(await checkRateLimit(`SUPPORT_TICKET#${claims.sub}`, 5, 86400))) {
      return badRequest('Rate limit exceeded: 5 support tickets per day');
    }

    const body = JSON.parse(event.body || '{}');
    const title = limitString(body.title, 200, 'title');
    const description = limitString(body.description, 10000, 'description');
    const category = body.category
      ? limitEnum(body.category, TICKET_CATEGORIES, 'category')
      : 'general';
    const attachmentUrl = limitStringOptional(body.attachmentUrl, 500, 'attachmentUrl');

    const id = randomUUID().slice(0, 8);
    const now = new Date().toISOString();
    const profile = await getUserProfile(claims.sub);
    const refNumber = await getNextRefNumber();
    const priority = tierToPriority(profile.userTier);

    const item = {
      pk: 'TICKET',
      sk: `TICKET#${id}`,
      gsi1pk: `TICKET_USER#${claims.sub}`,
      gsi1sk: now,
      id,
      refNumber,
      title,
      description,
      category,
      status: 'open',
      priority,
      userId: claims.sub,
      userName: profile.userName,
      userEmail: profile.userEmail,
      userTier: profile.userTier,
      assignedTo: '',
      assignedName: '',
      messageCount: 0,
      lastMessageAt: now,
      attachmentUrl: attachmentUrl || '',
      createdAt: now,
      updatedAt: now,
      resolvedAt: '',
    };

    await client.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
    return created(item);
  } catch (error) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error('createTicket error:', error);
    return serverError('Failed to create ticket');
  }
}

/**
 * GET /api/support/tickets/{id}
 * Get ticket + messages. Owner or admin only.
 */
export async function getTicket(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const claims = extractClaims(event);
  if (!claims) return badRequest('Authentication required');

  const id = event.pathParameters?.id;
  if (!id) return badRequest('Ticket ID is required');

  try {
    const admin = isAdmin(event);

    // Get ticket
    const ticketResult = await client.send(
      new GetCommand({ TableName: TABLE_NAME, Key: { pk: 'TICKET', sk: `TICKET#${id}` } })
    );
    if (!ticketResult.Item) return notFound('Ticket not found');

    // Ownership check
    if (ticketResult.Item.userId !== claims.sub && !admin) {
      return notFound('Ticket not found');
    }

    // Get messages
    const messagesResult = await client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
        ExpressionAttributeValues: {
          ':pk': `TICKET#${id}`,
          ':sk': 'MESSAGE#',
        },
        ScanIndexForward: true,
      })
    );

    let messages = (messagesResult.Items || []) as Record<string, unknown>[];

    // Non-admin users can't see internal notes
    if (!admin) {
      messages = messages.filter((m) => !m.internal);
    }

    return success({
      ...ticketResult.Item,
      messages,
    });
  } catch (error) {
    console.error('getTicket error:', error);
    return serverError('Failed to fetch ticket');
  }
}

/**
 * PUT /api/support/tickets/{id}
 * Update ticket. Users can reopen/close. Admin can change status/priority/assignment.
 */
export async function updateTicket(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const claims = extractClaims(event);
  if (!claims) return badRequest('Authentication required');

  const id = event.pathParameters?.id;
  if (!id) return badRequest('Ticket ID is required');

  try {
    const admin = isAdmin(event);

    // Verify ownership or admin
    const existing = await client.send(
      new GetCommand({ TableName: TABLE_NAME, Key: { pk: 'TICKET', sk: `TICKET#${id}` } })
    );
    if (!existing.Item) return notFound('Ticket not found');
    if (existing.Item.userId !== claims.sub && !admin) {
      return notFound('Ticket not found');
    }

    const body = JSON.parse(event.body || '{}');
    const updateFields: string[] = ['#updatedAt = :updatedAt'];
    const exprNames: Record<string, string> = { '#updatedAt': 'updatedAt' };
    const exprValues: Record<string, unknown> = { ':updatedAt': new Date().toISOString() };

    const validated: Record<string, unknown> = {};
    if (body.status !== undefined) {
      validated.status = limitEnum(body.status, TICKET_STATUSES, 'status');
    }
    if (admin) {
      if (body.priority !== undefined) {
        validated.priority = limitEnum(body.priority, TICKET_PRIORITIES, 'priority');
      }
      if (body.category !== undefined) {
        validated.category = limitEnum(body.category, TICKET_CATEGORIES, 'category');
      }
      if (body.assignedTo !== undefined) {
        validated.assignedTo = limitStringOptional(body.assignedTo, 100, 'assignedTo') || '';
      }
      if (body.assignedName !== undefined) {
        validated.assignedName = limitStringOptional(body.assignedName, 100, 'assignedName') || '';
      }
    }

    // Validate user status transitions
    if (!admin && validated.status) {
      const current = existing.Item.status;
      const next = validated.status;
      const allowed =
        (current === 'resolved' && next === 'open') ||
        (current === 'open' && next === 'closed') ||
        (current === 'in_progress' && next === 'closed') ||
        (current === 'resolved' && next === 'closed');
      if (!allowed) {
        return badRequest(`Cannot change status from ${current} to ${next}`);
      }
    }

    for (const field of Object.keys(validated)) {
      updateFields.push(`#${field} = :${field}`);
      exprNames[`#${field}`] = field;
      exprValues[`:${field}`] = validated[field];
    }

    // Track resolvedAt
    if (body.status === 'resolved') {
      updateFields.push('resolvedAt = :resolvedAt');
      exprValues[':resolvedAt'] = new Date().toISOString();
    }
    if (body.status === 'open' && existing.Item.status === 'resolved') {
      updateFields.push('resolvedAt = :resolvedAt');
      exprValues[':resolvedAt'] = '';
    }

    const result = await client.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { pk: 'TICKET', sk: `TICKET#${id}` },
        UpdateExpression: `SET ${updateFields.join(', ')}`,
        ExpressionAttributeNames: exprNames,
        ExpressionAttributeValues: exprValues,
        ConditionExpression: 'attribute_exists(pk)',
        ReturnValues: 'ALL_NEW',
      })
    );

    return success(result.Attributes);
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    if (error.name === 'ConditionalCheckFailedException') return notFound('Ticket not found');
    console.error('updateTicket error:', error);
    return serverError('Failed to update ticket');
  }
}

// ─────────────────────────────────────────────────
// MESSAGES
// ─────────────────────────────────────────────────

/**
 * POST /api/support/tickets/{id}/messages
 * Add a message to a ticket
 */
export async function addMessage(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const claims = extractClaims(event);
  if (!claims) return badRequest('Authentication required');

  const ticketId = event.pathParameters?.id;
  if (!ticketId) return badRequest('Ticket ID is required');

  try {
    const admin = isAdmin(event);

    // Verify ticket exists and ownership
    const ticketResult = await client.send(
      new GetCommand({ TableName: TABLE_NAME, Key: { pk: 'TICKET', sk: `TICKET#${ticketId}` } })
    );
    if (!ticketResult.Item) return notFound('Ticket not found');
    if (ticketResult.Item.userId !== claims.sub && !admin) {
      return notFound('Ticket not found');
    }

    if (!admin && !(await checkRateLimit(`SUPPORT_MSG#${claims.sub}`, 30, 3600))) {
      return badRequest('Rate limit exceeded: 30 ticket messages per hour');
    }

    const body = JSON.parse(event.body || '{}');
    const content = limitString(body.content, 10000, 'content');
    const attachmentUrl = limitStringOptional(body.attachmentUrl, 500, 'attachmentUrl');

    const msgId = randomUUID().slice(0, 8);
    const now = new Date().toISOString();

    const authorName = admin
      ? (claims.given_name ? `${claims.given_name} ${claims.family_name || ''}`.trim() : claims.email)
      : (ticketResult.Item.userName || 'User');

    const message = {
      pk: `TICKET#${ticketId}`,
      sk: `MESSAGE#${now}#${msgId}`,
      id: msgId,
      ticketId,
      content,
      authorId: claims.sub,
      authorName,
      authorType: admin ? 'admin' : 'user',
      internal: admin ? !!body.internal : false,
      attachmentUrl: attachmentUrl || '',
      createdAt: now,
    };

    await client.send(new PutCommand({ TableName: TABLE_NAME, Item: message }));

    // Update ticket messageCount, lastMessageAt, and auto-set status
    const statusUpdate = admin && !body.internal
      ? ', #status = :status'
      : ticketResult.Item.status === 'resolved' && !admin
      ? ', #status = :status'
      : '';

    const updateExpr = `SET messageCount = messageCount + :one, lastMessageAt = :now, #updatedAt = :now${statusUpdate}`;
    const updateNames: Record<string, string> = { '#updatedAt': 'updatedAt' };
    const updateValues: Record<string, unknown> = { ':one': 1, ':now': now };

    if (statusUpdate) {
      updateNames['#status'] = 'status';
      updateValues[':status'] = admin ? 'in_progress' : 'open';
    }

    await client.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { pk: 'TICKET', sk: `TICKET#${ticketId}` },
        UpdateExpression: updateExpr,
        ExpressionAttributeNames: updateNames,
        ExpressionAttributeValues: updateValues,
      })
    );

    // Send email notification when admin replies (non-internal messages only)
    if (admin && !body.internal && ticketResult.Item.userId) {
      try {
        const preview = content.slice(0, 200);
        await sendNotification(
          ticketResult.Item.userId,
          'support',
          `Re: ${ticketResult.Item.title || 'Your support ticket'}`,
          supportReplyEmail(
            ticketResult.Item.title || 'Your support ticket',
            preview
          )
        );
      } catch (emailErr) {
        console.warn('Support reply notification email failed:', emailErr);
      }
    }

    return created(message);
  } catch (error) {
    if (error instanceof ValidationError) return badRequest(error.message);
    console.error('addMessage error:', error);
    return serverError('Failed to add message');
  }
}

// ─────────────────────────────────────────────────
// ADMIN
// ─────────────────────────────────────────────────

/**
 * PUT /api/support/admin/assign/{id}
 * Assign a ticket to an admin
 */
export async function assignTicket(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (!isAdmin(event)) return badRequest('Admin access required');

  const id = event.pathParameters?.id;
  if (!id) return badRequest('Ticket ID is required');

  try {
    const body = JSON.parse(event.body || '{}');
    const assignedTo = limitStringOptional(body.assignedTo, 100, 'assignedTo');
    const assignedName = limitStringOptional(body.assignedName, 100, 'assignedName');

    const result = await client.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { pk: 'TICKET', sk: `TICKET#${id}` },
        UpdateExpression: 'SET assignedTo = :assignedTo, assignedName = :assignedName, #updatedAt = :now',
        ExpressionAttributeNames: { '#updatedAt': 'updatedAt' },
        ExpressionAttributeValues: {
          ':assignedTo': assignedTo || '',
          ':assignedName': assignedName || '',
          ':now': new Date().toISOString(),
        },
        ConditionExpression: 'attribute_exists(pk)',
        ReturnValues: 'ALL_NEW',
      })
    );

    return success(result.Attributes);
  } catch (error: any) {
    if (error instanceof ValidationError) return badRequest(error.message);
    if (error.name === 'ConditionalCheckFailedException') return notFound('Ticket not found');
    console.error('assignTicket error:', error);
    return serverError('Failed to assign ticket');
  }
}

/**
 * GET /api/support/stats
 * Support stats for admin dashboard
 */
export async function getSupportStats(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (!isAdmin(event)) return badRequest('Admin access required');

  try {
    const result = await client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: { ':pk': 'TICKET' },
      })
    );

    const tickets = result.Items || [];
    const openCount = tickets.filter((t) => t.status === 'open' || t.status === 'in_progress').length;
    const unassignedCount = tickets.filter(
      (t) => (t.status === 'open' || t.status === 'in_progress') && !t.assignedTo
    ).length;
    const highPriorityCount = tickets.filter(
      (t) => t.priority === 'high' && (t.status === 'open' || t.status === 'in_progress')
    ).length;
    const resolvedCount = tickets.filter((t) => t.status === 'resolved' || t.status === 'closed').length;

    return success({
      totalTickets: tickets.length,
      openCount,
      unassignedCount,
      highPriorityCount,
      resolvedCount,
    });
  } catch (error) {
    console.error('getSupportStats error:', error);
    return serverError('Failed to fetch support stats');
  }
}
