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

/* ── Helper: look up user profile to get authorName, tier, memberSince ── */
async function getAuthorInfo(sub: string) {
  const result = await client.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { pk: `USER#${sub}`, sk: 'PROFILE' },
    })
  );
  const profile = result.Item;
  if (!profile) return { authorName: 'Unknown', authorTier: 'Pup', authorMemberSince: '' };

  const name = [profile.givenName, profile.familyName].filter(Boolean).join(' ') || profile.email || 'Unknown';
  return {
    authorName: name,
    authorTier: profile.tier || 'Pup',
    authorMemberSince: profile.createdAt || '',
  };
}

/* ── Helper: strip author identity for anonymous posts (non-admin view) ── */
function maskAnonymous(item: Record<string, unknown>, viewerIsAdmin: boolean) {
  if (item.anonymous && !viewerIsAdmin) {
    return { ...item, authorName: 'Anonymous', authorTier: undefined, authorMemberSince: undefined, authorId: undefined };
  }
  return item;
}

/* ── Helper: compute reaction counts for a target ── */
async function getReactionCounts(targetType: string, targetId: string) {
  const result = await client.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: { ':pk': `REACTIONS#${targetType}#${targetId}` },
    })
  );
  const items = result.Items || [];
  const likes = items.filter((i) => i.type === 'like').length;
  const helpful = items.filter((i) => i.type === 'helpful').length;
  return { likes, helpful, total: items.length };
}

// ─────────────────────────────────────────────────
// THREADS
// ─────────────────────────────────────────────────

/**
 * GET /api/community/threads
 * List threads. Query params: ?category=&search=
 */
export async function listThreads(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const admin = isAdmin(event);
    const category = event.queryStringParameters?.category;
    const search = event.queryStringParameters?.search?.toLowerCase();

    let items: Record<string, unknown>[];

    if (category && category !== 'all') {
      // Query by category using GSI1
      const result = await client.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: 'GSI1',
          KeyConditionExpression: 'gsi1pk = :gsi1pk',
          ExpressionAttributeValues: { ':gsi1pk': `CATEGORY#${category}` },
          ScanIndexForward: false, // newest first
        })
      );
      items = (result.Items || []) as Record<string, unknown>[];
    } else {
      // Query all threads
      const result = await client.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: 'pk = :pk',
          ExpressionAttributeValues: { ':pk': 'COMMUNITY' },
        })
      );
      items = (result.Items || []) as Record<string, unknown>[];
    }

    // Filter by status for non-admin
    if (!admin) {
      items = items.filter((item) => item.status === 'approved');
    }

    // Client-side search
    if (search) {
      items = items.filter((item) => {
        const title = String(item.title || '').toLowerCase();
        const content = String(item.content || '').toLowerCase();
        return title.includes(search) || content.includes(search);
      });
    }

    // Sort: pinned first, then newest
    items.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });

    // Mask anonymous posts
    items = items.map((item) => maskAnonymous(item, admin));

    return success(items);
  } catch (error) {
    console.error('listThreads error:', error);
    return serverError('Failed to fetch threads');
  }
}

/**
 * GET /api/community/threads/{id}
 * Get thread + replies
 */
export async function getThread(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const id = event.pathParameters?.id;
  if (!id) return badRequest('Thread ID is required');

  try {
    const admin = isAdmin(event);
    const claims = extractClaims(event);

    // Get thread
    const threadResult = await client.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { pk: 'COMMUNITY', sk: `THREAD#${id}` },
      })
    );

    if (!threadResult.Item) return notFound('Thread not found');
    if (threadResult.Item.status !== 'approved' && !admin) return notFound('Thread not found');

    // Get replies
    const repliesResult = await client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
        ExpressionAttributeValues: {
          ':pk': `THREAD#${id}`,
          ':sk': 'REPLY#',
        },
        ScanIndexForward: true, // oldest first (chronological)
      })
    );

    let replies = (repliesResult.Items || []) as Record<string, unknown>[];
    if (!admin) {
      replies = replies.filter((r) => r.status === 'approved');
    }
    replies = replies.map((r) => maskAnonymous(r, admin));

    // Get reaction counts for thread
    const threadReactions = await getReactionCounts('THREAD', id);

    // Check if current user reacted
    let userReaction: string | null = null;
    if (claims?.sub) {
      const userReactResult = await client.send(
        new GetCommand({
          TableName: TABLE_NAME,
          Key: { pk: `REACTIONS#THREAD#${id}`, sk: `USER#${claims.sub}` },
        })
      );
      if (userReactResult.Item) {
        userReaction = userReactResult.Item.type as string;
      }
    }

    const thread = maskAnonymous(threadResult.Item as Record<string, unknown>, admin);

    return success({
      ...thread,
      reactions: threadReactions,
      userReaction,
      replies,
    });
  } catch (error) {
    console.error('getThread error:', error);
    return serverError('Failed to fetch thread');
  }
}

/**
 * POST /api/community/threads
 * Create a new thread (any authenticated user)
 */
export async function createThread(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const claims = extractClaims(event);
  if (!claims) return badRequest('Authentication required');

  try {
    const body = JSON.parse(event.body || '{}');
    if (!body.title || !body.content) return badRequest('Title and content are required');

    const id = randomUUID().slice(0, 8);
    const now = new Date().toISOString();
    const authorInfo = await getAuthorInfo(claims.sub);

    const item = {
      pk: 'COMMUNITY',
      sk: `THREAD#${id}`,
      gsi1pk: `CATEGORY#${body.category || 'general'}`,
      gsi1sk: now,
      id,
      title: body.title,
      content: body.content,
      category: body.category || 'general',
      authorId: claims.sub,
      authorName: body.anonymous ? 'Anonymous' : authorInfo.authorName,
      authorTier: authorInfo.authorTier,
      authorMemberSince: authorInfo.authorMemberSince,
      anonymous: !!body.anonymous,
      status: 'approved', // auto-approve
      pinned: false,
      replyCount: 0,
      lastReplyAt: now,
      imageUrl: body.imageUrl || '',
      createdAt: now,
      updatedAt: now,
    };

    await client.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
    return created(item);
  } catch (error) {
    console.error('createThread error:', error);
    return serverError('Failed to create thread');
  }
}

/**
 * PUT /api/community/threads/{id}
 * Edit thread (author or admin only)
 */
export async function updateThread(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const claims = extractClaims(event);
  if (!claims) return badRequest('Authentication required');

  const id = event.pathParameters?.id;
  if (!id) return badRequest('Thread ID is required');

  try {
    // Verify ownership or admin
    const existing = await client.send(
      new GetCommand({ TableName: TABLE_NAME, Key: { pk: 'COMMUNITY', sk: `THREAD#${id}` } })
    );
    if (!existing.Item) return notFound('Thread not found');
    if (existing.Item.authorId !== claims.sub && !isAdmin(event)) {
      return badRequest('Not authorized to edit this thread');
    }

    const body = JSON.parse(event.body || '{}');
    const updateFields: string[] = ['#updatedAt = :updatedAt'];
    const exprNames: Record<string, string> = { '#updatedAt': 'updatedAt' };
    const exprValues: Record<string, unknown> = { ':updatedAt': new Date().toISOString() };

    const allowedFields = ['title', 'content', 'category', 'imageUrl'];
    // Admin can also update status and pinned
    if (isAdmin(event)) {
      allowedFields.push('status', 'pinned');
    }

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
        Key: { pk: 'COMMUNITY', sk: `THREAD#${id}` },
        UpdateExpression: `SET ${updateFields.join(', ')}`,
        ExpressionAttributeNames: exprNames,
        ExpressionAttributeValues: exprValues,
        ConditionExpression: 'attribute_exists(pk)',
        ReturnValues: 'ALL_NEW',
      })
    );

    return success(result.Attributes);
  } catch (error: any) {
    if (error.name === 'ConditionalCheckFailedException') return notFound('Thread not found');
    console.error('updateThread error:', error);
    return serverError('Failed to update thread');
  }
}

/**
 * DELETE /api/community/threads/{id}
 * Admin only
 */
export async function deleteThread(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (!isAdmin(event)) return badRequest('Admin access required');

  const id = event.pathParameters?.id;
  if (!id) return badRequest('Thread ID is required');

  try {
    await client.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { pk: 'COMMUNITY', sk: `THREAD#${id}` },
        ConditionExpression: 'attribute_exists(pk)',
      })
    );

    // Also delete all replies for this thread
    const replies = await client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: { ':pk': `THREAD#${id}` },
        ProjectionExpression: 'pk, sk',
      })
    );
    for (const reply of replies.Items || []) {
      await client.send(new DeleteCommand({ TableName: TABLE_NAME, Key: { pk: reply.pk as string, sk: reply.sk as string } }));
    }

    return success({ deleted: true, id });
  } catch (error: any) {
    if (error.name === 'ConditionalCheckFailedException') return notFound('Thread not found');
    console.error('deleteThread error:', error);
    return serverError('Failed to delete thread');
  }
}

// ─────────────────────────────────────────────────
// REPLIES
// ─────────────────────────────────────────────────

/**
 * POST /api/community/threads/{id}/replies
 * Post a reply to a thread
 */
export async function createReply(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const claims = extractClaims(event);
  if (!claims) return badRequest('Authentication required');

  const threadId = event.pathParameters?.id;
  if (!threadId) return badRequest('Thread ID is required');

  try {
    const body = JSON.parse(event.body || '{}');
    if (!body.content) return badRequest('Content is required');

    // Verify thread exists
    const threadResult = await client.send(
      new GetCommand({ TableName: TABLE_NAME, Key: { pk: 'COMMUNITY', sk: `THREAD#${threadId}` } })
    );
    if (!threadResult.Item) return notFound('Thread not found');

    const replyId = randomUUID().slice(0, 8);
    const now = new Date().toISOString();
    const authorInfo = await getAuthorInfo(claims.sub);

    const reply = {
      pk: `THREAD#${threadId}`,
      sk: `REPLY#${now}#${replyId}`,
      id: replyId,
      threadId,
      content: body.content,
      authorId: claims.sub,
      authorName: body.anonymous ? 'Anonymous' : authorInfo.authorName,
      authorTier: authorInfo.authorTier,
      authorMemberSince: authorInfo.authorMemberSince,
      anonymous: !!body.anonymous,
      status: 'approved', // auto-approve
      imageUrl: body.imageUrl || '',
      createdAt: now,
      updatedAt: now,
    };

    await client.send(new PutCommand({ TableName: TABLE_NAME, Item: reply }));

    // Update thread replyCount and lastReplyAt
    await client.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { pk: 'COMMUNITY', sk: `THREAD#${threadId}` },
        UpdateExpression: 'SET replyCount = replyCount + :one, lastReplyAt = :now',
        ExpressionAttributeValues: { ':one': 1, ':now': now },
      })
    );

    return created(reply);
  } catch (error) {
    console.error('createReply error:', error);
    return serverError('Failed to create reply');
  }
}

/**
 * PUT /api/community/replies/{id}
 * Edit a reply (author or admin)
 */
export async function updateReply(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const claims = extractClaims(event);
  if (!claims) return badRequest('Authentication required');

  const replyId = event.pathParameters?.id;
  if (!replyId) return badRequest('Reply ID is required');

  try {
    const body = JSON.parse(event.body || '{}');

    // We need threadId and the full SK to find the reply
    // The client must pass threadId in the body
    if (!body.threadId) return badRequest('threadId is required');

    // Find the reply by scanning the thread's replies
    const repliesResult = await client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
        ExpressionAttributeValues: {
          ':pk': `THREAD#${body.threadId}`,
          ':sk': 'REPLY#',
        },
      })
    );

    const reply = (repliesResult.Items || []).find((r) => r.id === replyId);
    if (!reply) return notFound('Reply not found');

    // Check ownership
    if (reply.authorId !== claims.sub && !isAdmin(event)) {
      return badRequest('Not authorized to edit this reply');
    }

    const updateFields: string[] = ['#updatedAt = :updatedAt'];
    const exprNames: Record<string, string> = { '#updatedAt': 'updatedAt' };
    const exprValues: Record<string, unknown> = { ':updatedAt': new Date().toISOString() };

    const allowedFields = ['content', 'imageUrl'];
    if (isAdmin(event)) allowedFields.push('status');

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
        Key: { pk: reply.pk as string, sk: reply.sk as string },
        UpdateExpression: `SET ${updateFields.join(', ')}`,
        ExpressionAttributeNames: exprNames,
        ExpressionAttributeValues: exprValues,
        ReturnValues: 'ALL_NEW',
      })
    );

    return success(result.Attributes);
  } catch (error) {
    console.error('updateReply error:', error);
    return serverError('Failed to update reply');
  }
}

/**
 * DELETE /api/community/replies/{id}
 * Admin only. Requires ?threadId= query param.
 */
export async function deleteReply(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (!isAdmin(event)) return badRequest('Admin access required');

  const replyId = event.pathParameters?.id;
  const threadId = event.queryStringParameters?.threadId;
  if (!replyId || !threadId) return badRequest('Reply ID and threadId are required');

  try {
    // Find the reply
    const repliesResult = await client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
        ExpressionAttributeValues: {
          ':pk': `THREAD#${threadId}`,
          ':sk': 'REPLY#',
        },
      })
    );

    const reply = (repliesResult.Items || []).find((r) => r.id === replyId);
    if (!reply) return notFound('Reply not found');

    await client.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { pk: reply.pk as string, sk: reply.sk as string },
      })
    );

    // Decrement thread replyCount
    await client.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { pk: 'COMMUNITY', sk: `THREAD#${threadId}` },
        UpdateExpression: 'SET replyCount = replyCount - :one',
        ExpressionAttributeValues: { ':one': 1 },
      })
    );

    return success({ deleted: true, id: replyId });
  } catch (error) {
    console.error('deleteReply error:', error);
    return serverError('Failed to delete reply');
  }
}

// ─────────────────────────────────────────────────
// REACTIONS
// ─────────────────────────────────────────────────

/**
 * POST /api/community/reactions
 * Toggle a reaction. Body: { targetType, targetId, type }
 * If same reaction exists, removes it. Otherwise creates/updates.
 */
export async function toggleReaction(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const claims = extractClaims(event);
  if (!claims) return badRequest('Authentication required');

  try {
    const body = JSON.parse(event.body || '{}');
    if (!body.targetType || !body.targetId || !body.type) {
      return badRequest('targetType, targetId, and type are required');
    }

    const pk = `REACTIONS#${body.targetType}#${body.targetId}`;
    const sk = `USER#${claims.sub}`;

    // Check if reaction already exists
    const existing = await client.send(
      new GetCommand({ TableName: TABLE_NAME, Key: { pk, sk } })
    );

    if (existing.Item && existing.Item.type === body.type) {
      // Remove reaction (toggle off)
      await client.send(new DeleteCommand({ TableName: TABLE_NAME, Key: { pk, sk } }));
    } else {
      // Create or update reaction
      await client.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            pk,
            sk,
            type: body.type,
            userId: claims.sub,
            createdAt: new Date().toISOString(),
          },
        })
      );
    }

    // Return updated counts
    const counts = await getReactionCounts(body.targetType, body.targetId);
    return success(counts);
  } catch (error) {
    console.error('toggleReaction error:', error);
    return serverError('Failed to toggle reaction');
  }
}

// ─────────────────────────────────────────────────
// REPORTS
// ─────────────────────────────────────────────────

/**
 * POST /api/community/reports
 * Report content. Body: { targetType, targetId, reason }
 */
export async function createReport(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const claims = extractClaims(event);
  if (!claims) return badRequest('Authentication required');

  try {
    const body = JSON.parse(event.body || '{}');
    if (!body.targetType || !body.targetId || !body.reason) {
      return badRequest('targetType, targetId, and reason are required');
    }

    const id = randomUUID().slice(0, 8);
    const now = new Date().toISOString();

    const item = {
      pk: 'REPORT',
      sk: `REPORT#${id}`,
      gsi1pk: 'REPORT_STATUS',
      gsi1sk: `pending#${now}`,
      id,
      targetType: body.targetType,
      targetId: body.targetId,
      reporterId: claims.sub,
      reporterEmail: claims.email,
      reason: body.reason,
      status: 'pending',
      resolvedBy: '',
      createdAt: now,
    };

    await client.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
    return created(item);
  } catch (error) {
    console.error('createReport error:', error);
    return serverError('Failed to create report');
  }
}

// ─────────────────────────────────────────────────
// ADMIN: MODERATION
// ─────────────────────────────────────────────────

/**
 * GET /api/community/admin/queue
 * Returns pending reports and hidden/flagged threads
 */
export async function getAdminQueue(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (!isAdmin(event)) return badRequest('Admin access required');

  try {
    // Get pending reports via GSI1
    const reportsResult = await client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'GSI1',
        KeyConditionExpression: 'gsi1pk = :gsi1pk AND begins_with(gsi1sk, :prefix)',
        ExpressionAttributeValues: {
          ':gsi1pk': 'REPORT_STATUS',
          ':prefix': 'pending#',
        },
        ScanIndexForward: false,
      })
    );

    // Get all threads (admin can see all statuses)
    const threadsResult = await client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: { ':pk': 'COMMUNITY' },
      })
    );

    const hiddenThreads = (threadsResult.Items || []).filter(
      (t) => t.status === 'hidden' || t.status === 'rejected'
    );

    return success({
      reports: reportsResult.Items || [],
      hiddenThreads,
      reportCount: (reportsResult.Items || []).length,
    });
  } catch (error) {
    console.error('getAdminQueue error:', error);
    return serverError('Failed to fetch admin queue');
  }
}

/**
 * PUT /api/community/admin/moderate/{id}
 * Set thread status: approved, hidden, rejected
 */
export async function moderateThread(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (!isAdmin(event)) return badRequest('Admin access required');

  const id = event.pathParameters?.id;
  if (!id) return badRequest('Thread ID is required');

  try {
    const body = JSON.parse(event.body || '{}');
    if (!body.status) return badRequest('Status is required');

    const result = await client.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { pk: 'COMMUNITY', sk: `THREAD#${id}` },
        UpdateExpression: 'SET #status = :status, #updatedAt = :updatedAt',
        ExpressionAttributeNames: { '#status': 'status', '#updatedAt': 'updatedAt' },
        ExpressionAttributeValues: {
          ':status': body.status,
          ':updatedAt': new Date().toISOString(),
        },
        ConditionExpression: 'attribute_exists(pk)',
        ReturnValues: 'ALL_NEW',
      })
    );

    return success(result.Attributes);
  } catch (error: any) {
    if (error.name === 'ConditionalCheckFailedException') return notFound('Thread not found');
    console.error('moderateThread error:', error);
    return serverError('Failed to moderate thread');
  }
}

/**
 * PUT /api/community/admin/reports/{id}
 * Resolve or dismiss a report
 */
export async function resolveReport(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (!isAdmin(event)) return badRequest('Admin access required');

  const id = event.pathParameters?.id;
  if (!id) return badRequest('Report ID is required');

  try {
    const body = JSON.parse(event.body || '{}');
    if (!body.status) return badRequest('Status is required (resolved or dismissed)');

    const claims = extractClaims(event);
    const now = new Date().toISOString();

    const result = await client.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { pk: 'REPORT', sk: `REPORT#${id}` },
        UpdateExpression: 'SET #status = :status, resolvedBy = :resolvedBy, gsi1sk = :gsi1sk',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':status': body.status,
          ':resolvedBy': claims?.email || 'admin',
          ':gsi1sk': `${body.status}#${now}`,
        },
        ConditionExpression: 'attribute_exists(pk)',
        ReturnValues: 'ALL_NEW',
      })
    );

    return success(result.Attributes);
  } catch (error: any) {
    if (error.name === 'ConditionalCheckFailedException') return notFound('Report not found');
    console.error('resolveReport error:', error);
    return serverError('Failed to resolve report');
  }
}

/**
 * PUT /api/community/admin/pin/{id}
 * Toggle pin on a thread
 */
export async function togglePin(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (!isAdmin(event)) return badRequest('Admin access required');

  const id = event.pathParameters?.id;
  if (!id) return badRequest('Thread ID is required');

  try {
    // Get current pinned state
    const existing = await client.send(
      new GetCommand({ TableName: TABLE_NAME, Key: { pk: 'COMMUNITY', sk: `THREAD#${id}` } })
    );
    if (!existing.Item) return notFound('Thread not found');

    const newPinned = !existing.Item.pinned;

    const result = await client.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { pk: 'COMMUNITY', sk: `THREAD#${id}` },
        UpdateExpression: 'SET pinned = :pinned, #updatedAt = :updatedAt',
        ExpressionAttributeNames: { '#updatedAt': 'updatedAt' },
        ExpressionAttributeValues: {
          ':pinned': newPinned,
          ':updatedAt': new Date().toISOString(),
        },
        ReturnValues: 'ALL_NEW',
      })
    );

    return success(result.Attributes);
  } catch (error) {
    console.error('togglePin error:', error);
    return serverError('Failed to toggle pin');
  }
}

/**
 * GET /api/community/stats
 * Community stats for admin dashboard
 */
export async function getCommunityStats(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (!isAdmin(event)) return badRequest('Admin access required');

  try {
    const [threadsResult, reportsResult] = await Promise.all([
      client.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: 'pk = :pk',
          ExpressionAttributeValues: { ':pk': 'COMMUNITY' },
        })
      ),
      client.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: 'GSI1',
          KeyConditionExpression: 'gsi1pk = :gsi1pk AND begins_with(gsi1sk, :prefix)',
          ExpressionAttributeValues: {
            ':gsi1pk': 'REPORT_STATUS',
            ':prefix': 'pending#',
          },
          Select: 'COUNT',
        })
      ),
    ]);

    const threads = threadsResult.Items || [];
    const totalThreads = threads.length;
    const totalReplies = threads.reduce((sum, t) => sum + (Number(t.replyCount) || 0), 0);
    const uniqueAuthors = new Set(threads.map((t) => t.authorId).filter(Boolean));
    const activeUsers = uniqueAuthors.size;

    return success({
      totalThreads,
      totalReplies,
      activeUsers,
      pendingReports: reportsResult.Count || 0,
    });
  } catch (error) {
    console.error('getCommunityStats error:', error);
    return serverError('Failed to fetch community stats');
  }
}
