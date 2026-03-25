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
import { randomUUID } from 'crypto';
import { sendNotification } from '../utils/email';
import {
  subscriptionConfirmationEmail,
  subscriptionChangeEmail,
  subscriptionCancelledEmail,
  paymentFailedEmail,
} from '../../custom-message/templates';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.TABLE_NAME!;
const SITE_URL = 'https://hyraxfitness.com';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
};

function getStripe(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-04-30.basil' });
}

/**
 * Look up the Cognito sub from a Stripe Customer ID using the reverse mapping.
 */
async function getCognitoSub(stripeCustomerId: string): Promise<string | null> {
  const result = await client.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { pk: 'STRIPE_CUSTOMER', sk: stripeCustomerId },
    })
  );
  return result.Item?.cognitoSub || null;
}

/**
 * Look up tier name from tier ID (e.g., "2" → "Rock Runner")
 */
async function getTierName(tierId: string): Promise<string> {
  const result = await client.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { pk: 'TIER', sk: `TIER#${tierId}` },
    })
  );
  return result.Item?.name || 'Pup';
}

/**
 * Find the tier ID that matches a given Stripe Price ID
 */
async function getTierByPriceId(stripePriceId: string): Promise<{ id: string; name: string } | null> {
  const result = await client.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'GSI1',
      KeyConditionExpression: 'gsi1pk = :pk',
      ExpressionAttributeValues: { ':pk': 'TIER' },
    })
  );

  for (const item of result.Items || []) {
    if (item.stripePriceId === stripePriceId) {
      return {
        id: item.sk?.replace('TIER#', '') || '',
        name: item.name || 'Unknown',
      };
    }
  }
  return null;
}

/**
 * POST /api/stripe/webhook - Handle Stripe webhook events (PUBLIC, no auth)
 */
export async function handleWebhook(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  // Get the raw body for signature verification
  let rawBody: string;
  if (event.isBase64Encoded && event.body) {
    rawBody = Buffer.from(event.body, 'base64').toString('utf-8');
  } else {
    rawBody = event.body || '';
  }

  const sig =
    event.headers['Stripe-Signature'] ||
    event.headers['stripe-signature'] ||
    '';

  let stripeEvent: Stripe.Event;
  try {
    stripeEvent = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Invalid signature' }),
    };
  }

  console.log(`Stripe webhook: ${stripeEvent.type} (${stripeEvent.id})`);

  try {
    switch (stripeEvent.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(stripeEvent.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(stripeEvent.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(stripeEvent.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(stripeEvent.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(stripeEvent.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`Unhandled event type: ${stripeEvent.type}`);
    }
  } catch (error) {
    console.error(`Error processing ${stripeEvent.type}:`, error);
    // Return 500 for transient errors so Stripe retries
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Webhook processing failed' }),
    };
  }

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({ received: true }),
  };
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const cognitoSub =
    session.metadata?.cognitoSub ||
    (session.customer ? await getCognitoSub(session.customer as string) : null);

  if (!cognitoSub) {
    console.error('No cognitoSub found for checkout session:', session.id);
    return;
  }

  const tierId = session.metadata?.tierId || '';
  const tierName = tierId ? await getTierName(tierId) : 'Pup';
  const now = new Date().toISOString();

  // Retrieve the subscription to get period details (guarded against null fields)
  let currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  let cancelAtPeriodEnd = false;
  const stripeSubId = session.subscription as string;

  if (stripeSubId) {
    try {
      const stripe = getStripe();
      const subscription = await stripe.subscriptions.retrieve(stripeSubId);
      if (subscription.current_period_end) {
        currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();
      }
      cancelAtPeriodEnd = subscription.cancel_at_period_end || false;
    } catch (err) {
      console.warn('Could not retrieve subscription details, using defaults:', err);
    }
  }

  // Update subscription record
  await client.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: `USER#${cognitoSub}`,
        sk: 'SUBSCRIPTION',
        stripeCustomerId: session.customer as string,
        stripeSubscriptionId: stripeSubId || '',
        tierId,
        status: 'active',
        currentPeriodEnd,
        cancelAtPeriodEnd,
        gsi1pk: 'SUBSCRIPTION',
        gsi1sk: `active#${cognitoSub}`,
        createdAt: now,
        updatedAt: now,
      },
    })
  );

  // Store reverse mapping (idempotent)
  await client.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: 'STRIPE_CUSTOMER',
        sk: session.customer as string,
        cognitoSub,
        createdAt: now,
      },
    })
  );

  // Update user profile tier
  await client.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { pk: `USER#${cognitoSub}`, sk: 'PROFILE' },
      UpdateExpression: 'SET tier = :tier, updatedAt = :now',
      ExpressionAttributeValues: {
        ':tier': tierName,
        ':now': now,
      },
    })
  );

  console.log(`User ${cognitoSub} subscribed to ${tierName} (${tierId})`);

  // Send subscription confirmation email
  try {
    const amount = session.amount_total
      ? `$${(session.amount_total / 100).toFixed(2)}`
      : '$0.00';
    await sendNotification(
      cognitoSub,
      'subscription',
      'Your subscription is active!',
      subscriptionConfirmationEmail(tierName, amount)
    );
  } catch (err) {
    console.warn('Failed to send subscription confirmation email:', err);
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const cognitoSub =
    subscription.metadata?.cognitoSub ||
    (await getCognitoSub(subscription.customer as string));

  if (!cognitoSub) {
    console.error('No cognitoSub for subscription:', subscription.id);
    return;
  }

  const now = new Date().toISOString();
  const status = subscription.status;
  const cancelAtPeriodEnd = subscription.cancel_at_period_end;

  // Determine current tier from the subscription's price
  const priceId = subscription.items.data[0]?.price?.id;
  let tierId = subscription.metadata?.tierId || '';
  let tierName = '';

  if (priceId) {
    const tier = await getTierByPriceId(priceId);
    if (tier) {
      tierId = tier.id;
      tierName = tier.name;
    }
  }

  if (!tierName && tierId) {
    tierName = await getTierName(tierId);
  }

  const gsiStatus = cancelAtPeriodEnd ? 'cancelling' : status;

  // Update subscription record
  await client.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { pk: `USER#${cognitoSub}`, sk: 'SUBSCRIPTION' },
      UpdateExpression:
        'SET #st = :st, currentPeriodEnd = :cpe, cancelAtPeriodEnd = :cap, tierId = :tid, gsi1sk = :gsi, updatedAt = :now',
      ExpressionAttributeValues: {
        ':st': status,
        ':cpe': subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        ':cap': cancelAtPeriodEnd,
        ':tid': tierId,
        ':gsi': `${gsiStatus}#${cognitoSub}`,
        ':now': now,
      },
      ExpressionAttributeNames: {
        '#st': 'status',
      },
    })
  );

  // Update profile tier if the plan changed
  if (tierName && status === 'active') {
    await client.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { pk: `USER#${cognitoSub}`, sk: 'PROFILE' },
        UpdateExpression: 'SET tier = :tier, updatedAt = :now',
        ExpressionAttributeValues: {
          ':tier': tierName,
          ':now': now,
        },
      })
    );
  }

  console.log(`Subscription updated for ${cognitoSub}: ${status}, tier=${tierName}`);

  // Send subscription change notifications
  try {
    if (cancelAtPeriodEnd) {
      // Pending cancellation
      const accessUntil = subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toLocaleDateString('en-US', {
            month: 'long', day: 'numeric', year: 'numeric',
          })
        : 'end of billing period';
      await sendNotification(
        cognitoSub,
        'subscription',
        'Your subscription has been cancelled',
        subscriptionCancelledEmail(tierName || 'your plan', accessUntil)
      );
    } else if (tierName && status === 'active') {
      // Plan change (upgrade/downgrade) - get previous tier from profile
      const profileResult = await client.send(
        new GetCommand({
          TableName: TABLE_NAME,
          Key: { pk: `USER#${cognitoSub}`, sk: 'PROFILE' },
        })
      );
      const previousTier = profileResult.Item?.tier || 'Pup';
      if (previousTier !== tierName) {
        await sendNotification(
          cognitoSub,
          'subscription',
          'Your plan has been updated',
          subscriptionChangeEmail(previousTier, tierName, 'Immediately')
        );
      }
    }
  } catch (err) {
    console.warn('Failed to send subscription update email:', err);
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const cognitoSub =
    subscription.metadata?.cognitoSub ||
    (await getCognitoSub(subscription.customer as string));

  if (!cognitoSub) {
    console.error('No cognitoSub for deleted subscription:', subscription.id);
    return;
  }

  const now = new Date().toISOString();

  // Mark subscription as cancelled
  await client.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { pk: `USER#${cognitoSub}`, sk: 'SUBSCRIPTION' },
      UpdateExpression:
        'SET #st = :st, cancelAtPeriodEnd = :cap, gsi1sk = :gsi, updatedAt = :now',
      ExpressionAttributeValues: {
        ':st': 'cancelled',
        ':cap': false,
        ':gsi': `cancelled#${cognitoSub}`,
        ':now': now,
      },
      ExpressionAttributeNames: {
        '#st': 'status',
      },
    })
  );

  // Revert user tier to Pup
  await client.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { pk: `USER#${cognitoSub}`, sk: 'PROFILE' },
      UpdateExpression: 'SET tier = :tier, updatedAt = :now',
      ExpressionAttributeValues: {
        ':tier': 'Pup',
        ':now': now,
      },
    })
  );

  console.log(`Subscription deleted for ${cognitoSub}, reverted to Pup`);

  // Send cancellation confirmation email
  try {
    await sendNotification(
      cognitoSub,
      'subscription',
      'Your subscription has been cancelled',
      subscriptionCancelledEmail('your plan', 'now')
    );
  } catch (err) {
    console.warn('Failed to send cancellation email:', err);
  }
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const cognitoSub = await getCognitoSub(invoice.customer as string);
  if (!cognitoSub) {
    console.log('No cognitoSub for invoice payment:', invoice.id);
    return;
  }

  const now = new Date().toISOString();
  const uuid = randomUUID().slice(0, 8);

  // Determine tier name from subscription
  let tierName = '';
  if (invoice.subscription) {
    const subResult = await client.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { pk: `USER#${cognitoSub}`, sk: 'SUBSCRIPTION' },
      })
    );
    if (subResult.Item?.tierId) {
      tierName = await getTierName(subResult.Item.tierId);
    }
  }

  await client.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: `USER#${cognitoSub}`,
        sk: `PAYMENT#${now}#${uuid}`,
        stripeInvoiceId: invoice.id,
        amount: invoice.amount_paid,
        currency: invoice.currency,
        status: 'succeeded',
        paidAt: now,
        invoiceUrl: invoice.hosted_invoice_url || null,
        tierName,
        gsi1pk: 'PAYMENT',
        gsi1sk: `${now}#${cognitoSub}`,
        createdAt: now,
      },
    })
  );

  console.log(`Payment recorded for ${cognitoSub}: $${(invoice.amount_paid / 100).toFixed(2)}`);
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const cognitoSub = await getCognitoSub(invoice.customer as string);
  if (!cognitoSub) {
    console.log('No cognitoSub for failed invoice:', invoice.id);
    return;
  }

  const now = new Date().toISOString();
  const uuid = randomUUID().slice(0, 8);

  await client.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: `USER#${cognitoSub}`,
        sk: `PAYMENT#${now}#${uuid}`,
        stripeInvoiceId: invoice.id,
        amount: invoice.amount_due,
        currency: invoice.currency,
        status: 'failed',
        invoiceUrl: invoice.hosted_invoice_url || null,
        gsi1pk: 'PAYMENT',
        gsi1sk: `${now}#${cognitoSub}`,
        createdAt: now,
      },
    })
  );

  console.log(`Payment FAILED for ${cognitoSub}: $${(invoice.amount_due / 100).toFixed(2)}`);

  // Send payment failure notification email
  try {
    const amount = `$${(invoice.amount_due / 100).toFixed(2)}`;
    await sendNotification(
      cognitoSub,
      'subscription',
      'Payment failed',
      paymentFailedEmail(amount, `${SITE_URL}/portal/subscription`)
    );
  } catch (err) {
    console.warn('Failed to send payment failure email:', err);
  }
}
