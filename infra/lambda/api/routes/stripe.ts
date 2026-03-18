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

    // If user has an active subscription, redirect to portal for plan changes
    if (subResult.Item?.stripeSubscriptionId && subResult.Item?.status === 'active') {
      // Update the subscription to the new price instead of creating a new checkout
      const subscription = await stripe.subscriptions.retrieve(
        subResult.Item.stripeSubscriptionId
      );

      if (subscription.status === 'active') {
        // Update the subscription with the new price (immediate proration for upgrades)
        await stripe.subscriptions.update(subResult.Item.stripeSubscriptionId, {
          items: [
            {
              id: subscription.items.data[0].id,
              price: tierResult.Item.stripePriceId,
            },
          ],
          proration_behavior: 'create_prorations',
        });

        // Update DynamoDB subscription record
        await client.send(
          new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { pk: `USER#${claims.sub}`, sk: 'SUBSCRIPTION' },
            UpdateExpression:
              'SET tierId = :tid, cancelAtPeriodEnd = :cap, updatedAt = :now',
            ExpressionAttributeValues: {
              ':tid': tierId,
              ':cap': false,
              ':now': new Date().toISOString(),
            },
          })
        );

        // Update profile tier
        await client.send(
          new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { pk: `USER#${claims.sub}`, sk: 'PROFILE' },
            UpdateExpression: 'SET tier = :tier, updatedAt = :now',
            ExpressionAttributeValues: {
              ':tier': tierResult.Item.name,
              ':now': new Date().toISOString(),
            },
          })
        );

        return success({ updated: true, tierId });
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
