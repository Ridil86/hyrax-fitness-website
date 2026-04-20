import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import Stripe from 'stripe';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, badRequest, forbidden, notFound, serverError } from '../utils/response';
import { extractClaims } from '../utils/auth';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.TABLE_NAME!;

const TIER_RANK: Record<string, number> = { 'Pup': 1, 'Rock Runner': 2, 'Iron Dassie': 3 };

async function getTierItem(tierId: string) {
  const result = await client.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { pk: 'TIER', sk: `TIER#${tierId}` },
    })
  );
  return result.Item;
}

function getStripe(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-04-30.basil' });
}

/**
 * GET /api/stripe/config - Return Stripe publishable key (PUBLIC)
 */
export async function getStripeConfig(): Promise<APIGatewayProxyResult> {
  return success({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
  });
}

/**
 * GET /api/stripe/subscription - Get current user's subscription (AUTHENTICATED)
 */
export async function getSubscription(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const claims = extractClaims(event);
  if (!claims?.sub) return forbidden('Authentication required');

  try {
    const result = await client.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { pk: `USER#${claims.sub}`, sk: 'SUBSCRIPTION' },
      })
    );

    if (!result.Item) {
      return success({ subscription: null });
    }

    // Enrich with tier info
    let tierInfo = null;
    if (result.Item.tierId) {
      const tierResult = await client.send(
        new GetCommand({
          TableName: TABLE_NAME,
          Key: { pk: 'TIER', sk: `TIER#${result.Item.tierId}` },
        })
      );
      if (tierResult.Item) {
        tierInfo = {
          name: tierResult.Item.name,
          price: tierResult.Item.price,
          priceInCents: tierResult.Item.priceInCents,
        };
      }
    }

    return success({
      subscription: {
        stripeSubscriptionId: result.Item.stripeSubscriptionId,
        tierId: result.Item.tierId,
        status: result.Item.status,
        currentPeriodEnd: result.Item.currentPeriodEnd,
        cancelAtPeriodEnd: result.Item.cancelAtPeriodEnd || false,
        tier: tierInfo,
      },
    });
  } catch (error) {
    console.error('getSubscription error:', error);
    return serverError('Failed to fetch subscription');
  }
}

/**
 * POST /api/stripe/create-checkout-session - Create Stripe Checkout (AUTHENTICATED)
 */
export async function createCheckoutSession(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const claims = extractClaims(event);
  if (!claims?.sub) return forbidden('Authentication required');

  try {
    const body = JSON.parse(event.body || '{}');
    const { tierId } = body;

    if (!tierId) return badRequest('tierId is required');

    // Look up the tier to get the Stripe Price ID
    const tierResult = await client.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { pk: 'TIER', sk: `TIER#${tierId}` },
      })
    );

    if (!tierResult.Item || !tierResult.Item.stripePriceId) {
      return badRequest('Invalid tier or tier has no Stripe price');
    }

    const stripe = getStripe();

    // Check if user already has a Stripe Customer
    const subResult = await client.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { pk: `USER#${claims.sub}`, sk: 'SUBSCRIPTION' },
      })
    );

    let stripeCustomerId = subResult.Item?.stripeCustomerId;

    // If user has an active subscription, update it in-place instead of
    // creating a new checkout.
    if (subResult.Item?.stripeSubscriptionId && subResult.Item?.status === 'active') {
      const subscription = await stripe.subscriptions.retrieve(
        subResult.Item.stripeSubscriptionId
      );

      if (subscription.status === 'active') {
        const newTierName = tierResult.Item.name as string;
        const currentTierId = subResult.Item.tierId as string | undefined;
        const currentTierItem = currentTierId ? await getTierItem(currentTierId) : null;
        const currentTierName = (currentTierItem?.name as string) || 'Pup';
        const currentRank = TIER_RANK[currentTierName] || 0;
        const newRank = TIER_RANK[newTierName] || 0;

        // No-op: asking for the tier they already have
        if (newRank === currentRank && currentTierId === tierId) {
          return success({ updated: false, noop: true, tierId });
        }

        const now = new Date().toISOString();

        if (newRank > currentRank) {
          // UPGRADE — apply immediately with proration credit/charge
          await stripe.subscriptions.update(subResult.Item.stripeSubscriptionId, {
            items: [
              { id: subscription.items.data[0].id, price: tierResult.Item.stripePriceId },
            ],
            proration_behavior: 'create_prorations',
          });

          await client.send(
            new UpdateCommand({
              TableName: TABLE_NAME,
              Key: { pk: `USER#${claims.sub}`, sk: 'SUBSCRIPTION' },
              UpdateExpression:
                'SET tierId = :tid, cancelAtPeriodEnd = :cap, updatedAt = :now REMOVE pendingTierId, pendingTierChangeAt',
              ExpressionAttributeValues: {
                ':tid': tierId,
                ':cap': false,
                ':now': now,
              },
            })
          );

          await client.send(
            new UpdateCommand({
              TableName: TABLE_NAME,
              Key: { pk: `USER#${claims.sub}`, sk: 'PROFILE' },
              UpdateExpression: 'SET tier = :tier, updatedAt = :now',
              ExpressionAttributeValues: { ':tier': newTierName, ':now': now },
            })
          );

          return success({ updated: true, effective: 'immediate', tierId });
        }

        // DOWNGRADE — defer to period end via a Stripe Subscription Schedule.
        // profile.tier is NOT changed here; the renewal webhook promotes it.
        const periodEndIso = subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null;

        let scheduleId = (subscription.schedule as string | null) || null;
        if (!scheduleId) {
          const created = await stripe.subscriptionSchedules.create({
            from_subscription: subscription.id,
          });
          scheduleId = created.id;
        }

        const schedule = await stripe.subscriptionSchedules.retrieve(scheduleId);
        const currentPhase =
          schedule.phases[schedule.phases.length - 1];

        await stripe.subscriptionSchedules.update(scheduleId, {
          end_behavior: 'release',
          phases: [
            {
              items: currentPhase.items.map((it) => ({
                price: (it.price as string) || '',
                quantity: it.quantity ?? 1,
              })),
              start_date: currentPhase.start_date,
              end_date: currentPhase.end_date,
              proration_behavior: 'none',
            },
            {
              items: [{ price: tierResult.Item.stripePriceId, quantity: 1 }],
              proration_behavior: 'none',
            },
          ],
        });

        await client.send(
          new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { pk: `USER#${claims.sub}`, sk: 'SUBSCRIPTION' },
            UpdateExpression:
              'SET pendingTierId = :ptid, pendingTierChangeAt = :pta, updatedAt = :now',
            ExpressionAttributeValues: {
              ':ptid': tierId,
              ':pta': periodEndIso,
              ':now': now,
            },
          })
        );

        return success({
          updated: true,
          effective: 'period_end',
          pendingTierId: tierId,
          pendingTierChangeAt: periodEndIso,
        });
      }
    }

    // Create or reuse Stripe Customer
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: claims.email,
        metadata: {
          cognitoSub: claims.sub,
        },
      });
      stripeCustomerId = customer.id;

      // Store reverse mapping
      await client.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            pk: 'STRIPE_CUSTOMER',
            sk: customer.id,
            cognitoSub: claims.sub,
            email: claims.email,
            createdAt: new Date().toISOString(),
          },
        })
      );

      // Store customer ID on subscription record (create placeholder)
      await client.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            pk: `USER#${claims.sub}`,
            sk: 'SUBSCRIPTION',
            stripeCustomerId: customer.id,
            status: 'pending',
            gsi1pk: 'SUBSCRIPTION',
            gsi1sk: `pending#${claims.sub}`,
            createdAt: new Date().toISOString(),
          },
        })
      );
    }

    // Determine return URLs
    const origin =
      event.headers['Origin'] ||
      event.headers['origin'] ||
      'https://hyraxfitness.com';

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      line_items: [
        {
          price: tierResult.Item.stripePriceId,
          quantity: 1,
        },
      ],
      success_url: `${origin}/portal/subscription?status=success`,
      cancel_url: `${origin}/portal/subscription?status=cancelled`,
      metadata: {
        cognitoSub: claims.sub,
        tierId,
      },
      subscription_data: {
        metadata: {
          cognitoSub: claims.sub,
          tierId,
        },
      },
    });

    return success({ url: session.url });
  } catch (error) {
    console.error('createCheckoutSession error:', error);
    return serverError('Failed to create checkout session');
  }
}

/**
 * POST /api/stripe/create-portal-session - Open Stripe Customer Portal (AUTHENTICATED)
 */
export async function createPortalSession(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const claims = extractClaims(event);
  if (!claims?.sub) return forbidden('Authentication required');

  try {
    const subResult = await client.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { pk: `USER#${claims.sub}`, sk: 'SUBSCRIPTION' },
      })
    );

    if (!subResult.Item?.stripeCustomerId) {
      return badRequest('No billing account found. Subscribe to a plan first.');
    }

    const stripe = getStripe();

    const origin =
      event.headers['Origin'] ||
      event.headers['origin'] ||
      'https://hyraxfitness.com';

    const session = await stripe.billingPortal.sessions.create({
      customer: subResult.Item.stripeCustomerId,
      return_url: `${origin}/portal/subscription`,
    });

    return success({ url: session.url });
  } catch (error) {
    console.error('createPortalSession error:', error);
    return serverError('Failed to create portal session');
  }
}

/**
 * POST /api/stripe/cancel-subscription - Cancel subscription at period end (AUTHENTICATED)
 */
export async function cancelSubscription(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const claims = extractClaims(event);
  if (!claims?.sub) return forbidden('Authentication required');

  try {
    const subResult = await client.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { pk: `USER#${claims.sub}`, sk: 'SUBSCRIPTION' },
      })
    );

    if (
      !subResult.Item?.stripeSubscriptionId ||
      subResult.Item.status !== 'active'
    ) {
      return badRequest('No active subscription to cancel');
    }

    const stripe = getStripe();

    // Cancel at end of period (user keeps access until then)
    await stripe.subscriptions.update(subResult.Item.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    // Update DynamoDB
    await client.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { pk: `USER#${claims.sub}`, sk: 'SUBSCRIPTION' },
        UpdateExpression:
          'SET cancelAtPeriodEnd = :cap, updatedAt = :now, gsi1sk = :gsi',
        ExpressionAttributeValues: {
          ':cap': true,
          ':now': new Date().toISOString(),
          ':gsi': `cancelling#${claims.sub}`,
        },
      })
    );

    return success({ cancelled: true, effectiveAt: subResult.Item.currentPeriodEnd });
  } catch (error) {
    console.error('cancelSubscription error:', error);
    return serverError('Failed to cancel subscription');
  }
}
