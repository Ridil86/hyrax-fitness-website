import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, badRequest, serverError } from '../utils/response';
import { isAdmin } from '../utils/auth';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.TABLE_NAME!;

/**
 * GET /api/admin/billing/subscriptions - List all subscriptions (ADMIN)
 */
export async function listSubscriptions(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (!isAdmin(event)) return badRequest('Admin access required');

  try {
    const params = event.queryStringParameters || {};
    const limit = parseInt(params.limit || '50', 10);
    const lastKey = params.lastKey
      ? JSON.parse(Buffer.from(params.lastKey, 'base64').toString())
      : undefined;

    const result = await client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'GSI1',
        KeyConditionExpression: 'gsi1pk = :pk',
        ExpressionAttributeValues: { ':pk': 'SUBSCRIPTION' },
        ScanIndexForward: false,
        Limit: limit,
        ExclusiveStartKey: lastKey,
      })
    );

    // Enrich with profile data (email, name)
    const subscriptions = await Promise.all(
      (result.Items || []).map(async (item) => {
        const userSub = item.pk?.replace('USER#', '');
        let profile: Record<string, unknown> = {};

        try {
          const profileResult = await client.send(
            new GetCommand({
              TableName: TABLE_NAME,
              Key: { pk: item.pk, sk: 'PROFILE' },
            })
          );
          profile = profileResult.Item || {};
        } catch {
          // Profile fetch failed, continue without it
        }

        return {
          userSub,
          email: profile.email || 'Unknown',
          givenName: profile.givenName || '',
          familyName: profile.familyName || '',
          stripeSubscriptionId: item.stripeSubscriptionId,
          stripeCustomerId: item.stripeCustomerId,
          tierId: item.tierId,
          status: item.status,
          currentPeriodEnd: item.currentPeriodEnd,
          cancelAtPeriodEnd: item.cancelAtPeriodEnd || false,
          createdAt: item.createdAt,
        };
      })
    );

    return success({
      subscriptions,
      lastKey: result.LastEvaluatedKey
        ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
        : null,
    });
  } catch (error) {
    console.error('listSubscriptions error:', error);
    return serverError('Failed to fetch subscriptions');
  }
}

/**
 * GET /api/admin/billing/payments - List all payments (ADMIN)
 */
export async function listPayments(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (!isAdmin(event)) return badRequest('Admin access required');

  try {
    const params = event.queryStringParameters || {};
    const limit = parseInt(params.limit || '50', 10);
    const lastKey = params.lastKey
      ? JSON.parse(Buffer.from(params.lastKey, 'base64').toString())
      : undefined;

    const result = await client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'GSI1',
        KeyConditionExpression: 'gsi1pk = :pk',
        ExpressionAttributeValues: { ':pk': 'PAYMENT' },
        ScanIndexForward: false, // newest first
        Limit: limit,
        ExclusiveStartKey: lastKey,
      })
    );

    // Enrich with profile data
    const payments = await Promise.all(
      (result.Items || []).map(async (item) => {
        const userSub = item.pk?.replace('USER#', '');
        let profile: Record<string, unknown> = {};

        try {
          const profileResult = await client.send(
            new GetCommand({
              TableName: TABLE_NAME,
              Key: { pk: item.pk, sk: 'PROFILE' },
            })
          );
          profile = profileResult.Item || {};
        } catch {
          // Profile fetch failed
        }

        return {
          userSub,
          email: profile.email || 'Unknown',
          givenName: profile.givenName || '',
          familyName: profile.familyName || '',
          stripeInvoiceId: item.stripeInvoiceId,
          amount: item.amount,
          currency: item.currency,
          status: item.status,
          paidAt: item.paidAt,
          invoiceUrl: item.invoiceUrl,
          tierName: item.tierName,
          createdAt: item.createdAt,
        };
      })
    );

    return success({
      payments,
      lastKey: result.LastEvaluatedKey
        ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
        : null,
    });
  } catch (error) {
    console.error('listPayments error:', error);
    return serverError('Failed to fetch payments');
  }
}

/**
 * GET /api/admin/billing/payments/{userSub} - Get payment history for a user (ADMIN)
 */
export async function getUserPayments(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (!isAdmin(event)) return badRequest('Admin access required');

  const userSub = event.pathParameters?.userSub;
  if (!userSub) return badRequest('User sub is required');

  try {
    const result = await client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userSub}`,
          ':prefix': 'PAYMENT#',
        },
        ScanIndexForward: false, // newest first
      })
    );

    const payments = (result.Items || []).map((item) => ({
      stripeInvoiceId: item.stripeInvoiceId,
      amount: item.amount,
      currency: item.currency,
      status: item.status,
      paidAt: item.paidAt,
      invoiceUrl: item.invoiceUrl,
      tierName: item.tierName,
      createdAt: item.createdAt,
    }));

    return success({ payments });
  } catch (error) {
    console.error('getUserPayments error:', error);
    return serverError('Failed to fetch user payments');
  }
}

/**
 * GET /api/admin/billing/stats - Aggregate billing statistics (ADMIN)
 */
export async function getBillingStats(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (!isAdmin(event)) return badRequest('Admin access required');

  try {
    // Get all subscriptions
    const subResult = await client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'GSI1',
        KeyConditionExpression: 'gsi1pk = :pk',
        ExpressionAttributeValues: { ':pk': 'SUBSCRIPTION' },
      })
    );

    const subscriptions = subResult.Items || [];
    const activeCount = subscriptions.filter(
      (s) => s.status === 'active' && !s.cancelAtPeriodEnd
    ).length;
    const cancellingCount = subscriptions.filter(
      (s) => s.status === 'active' && s.cancelAtPeriodEnd
    ).length;
    const cancelledCount = subscriptions.filter(
      (s) => s.status === 'cancelled'
    ).length;

    // Calculate MRR from active subscriptions by looking up tier prices
    let mrr = 0;
    const tierPrices: Record<string, number> = {};

    // Fetch tier prices
    const tierResult = await client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'GSI1',
        KeyConditionExpression: 'gsi1pk = :pk',
        ExpressionAttributeValues: { ':pk': 'TIER' },
      })
    );
    for (const tier of tierResult.Items || []) {
      const tierId = tier.sk?.replace('TIER#', '');
      if (tierId) tierPrices[tierId] = tier.priceInCents || 0;
    }

    for (const sub of subscriptions) {
      if (sub.status === 'active' && sub.tierId) {
        mrr += tierPrices[sub.tierId] || 0;
      }
    }

    // Get this month's payments
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const payResult = await client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'GSI1',
        KeyConditionExpression: 'gsi1pk = :pk AND gsi1sk >= :start',
        ExpressionAttributeValues: {
          ':pk': 'PAYMENT',
          ':start': monthStart,
        },
      })
    );

    let revenueThisMonth = 0;
    for (const payment of payResult.Items || []) {
      if (payment.status === 'succeeded') {
        revenueThisMonth += payment.amount || 0;
      }
    }

    return success({
      activeSubscribers: activeCount,
      cancellingSubscribers: cancellingCount,
      cancelledSubscribers: cancelledCount,
      mrr: mrr / 100, // Convert cents to dollars
      revenueThisMonth: revenueThisMonth / 100,
      totalSubscriptions: subscriptions.length,
    });
  } catch (error) {
    console.error('getBillingStats error:', error);
    return serverError('Failed to fetch billing stats');
  }
}
