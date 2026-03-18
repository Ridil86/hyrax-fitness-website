import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import Stripe from 'stripe';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, badRequest, serverError } from '../utils/response';
import { isAdmin } from '../utils/auth';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.TABLE_NAME!;

function getStripe(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-04-30.basil' });
}

/**
 * GET /api/tiers - List all tiers sorted by sortOrder (PUBLIC)
 * Returns { tiers: [...], comparisonFeatures: [...] }
 */
export async function listTiers(): Promise<APIGatewayProxyResult> {
  try {
    const result = await client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'GSI1',
        KeyConditionExpression: 'gsi1pk = :pk',
        ExpressionAttributeValues: { ':pk': 'TIER' },
        ScanIndexForward: true,
      })
    );

    const allItems = result.Items || [];

    // Separate comparison record from tier records
    const comparisonItem = allItems.find((item) => item.sk === 'TIER#COMPARISON');
    const comparisonFeatures = comparisonItem?.comparisonFeatures || [];

    const tiers = allItems
      .filter((item) => item.sk !== 'TIER#COMPARISON')
      .map((item) => ({
        id: item.sk?.replace('TIER#', ''),
        name: item.name,
        level: item.level,
        description: item.description,
        price: item.price,
        priceInCents: item.priceInCents,
        billingInterval: item.billingInterval || 'month',
        features: item.features || [],
        logoUrl: item.logoUrl || null,
        sortOrder: item.sortOrder,
        stripeProductId: item.stripeProductId || null,
        stripePriceId: item.stripePriceId || null,
      }));

    return success({ tiers, comparisonFeatures });
  } catch (error) {
    console.error('listTiers error:', error);
    return serverError('Failed to fetch tiers');
  }
}

/**
 * PUT /api/tiers/{id} - Update a tier (ADMIN)
 * Syncs changes to Stripe Products/Prices.
 */
export async function updateTier(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (!isAdmin(event)) {
    return badRequest('Admin access required');
  }

  const tierId = event.pathParameters?.id;
  if (!tierId) {
    return badRequest('Tier ID is required');
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const allowedFields = ['name', 'description', 'price', 'priceInCents', 'features', 'logoUrl'];

    const expressionParts: string[] = [];
    const expressionValues: Record<string, unknown> = {};
    const expressionNames: Record<string, string> = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        const alias = `#${field}`;
        const valAlias = `:${field}`;
        expressionParts.push(`${alias} = ${valAlias}`);
        expressionValues[valAlias] = body[field];
        expressionNames[alias] = field;
      }
    }

    if (expressionParts.length === 0) {
      return badRequest('No fields to update');
    }

    // Add updatedAt
    expressionParts.push('#ua = :ua');
    expressionValues[':ua'] = new Date().toISOString();
    expressionNames['#ua'] = 'updatedAt';

    // If price changed, create a new Stripe Price and archive the old one
    if (body.priceInCents !== undefined && body.priceInCents > 0) {
      const stripe = getStripe();

      // Get current tier to find existing Stripe IDs
      const current = await client.send(
        new GetCommand({
          TableName: TABLE_NAME,
          Key: { pk: 'TIER', sk: `TIER#${tierId}` },
        })
      );

      if (current.Item?.stripeProductId) {
        // Update product name/description if changed
        const productUpdates: Record<string, string> = {};
        if (body.name) productUpdates.name = body.name;
        if (body.description) productUpdates.description = body.description;
        if (Object.keys(productUpdates).length > 0) {
          await stripe.products.update(current.Item.stripeProductId, productUpdates);
        }

        // Create new price (Stripe Prices are immutable)
        if (body.priceInCents !== current.Item.priceInCents) {
          const newPrice = await stripe.prices.create({
            product: current.Item.stripeProductId,
            unit_amount: body.priceInCents,
            currency: 'usd',
            recurring: { interval: 'month' },
          });

          // Archive old price
          if (current.Item.stripePriceId) {
            await stripe.prices.update(current.Item.stripePriceId, { active: false });
          }

          // Update default price on product
          await stripe.products.update(current.Item.stripeProductId, {
            default_price: newPrice.id,
          });

          expressionParts.push('#spi = :spi');
          expressionValues[':spi'] = newPrice.id;
          expressionNames['#spi'] = 'stripePriceId';
        }
      } else if (body.name) {
        // Update product name/description only
        // (no Stripe product for Pup tier)
      }
    } else if (body.name || body.description) {
      // Update Stripe product metadata even if price didn't change
      const current = await client.send(
        new GetCommand({
          TableName: TABLE_NAME,
          Key: { pk: 'TIER', sk: `TIER#${tierId}` },
        })
      );

      if (current.Item?.stripeProductId) {
        const stripe = getStripe();
        const productUpdates: Record<string, string> = {};
        if (body.name) productUpdates.name = body.name;
        if (body.description) productUpdates.description = body.description;
        if (Object.keys(productUpdates).length > 0) {
          await stripe.products.update(current.Item.stripeProductId, productUpdates);
        }
      }
    }

    const result = await client.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { pk: 'TIER', sk: `TIER#${tierId}` },
        UpdateExpression: `SET ${expressionParts.join(', ')}`,
        ExpressionAttributeValues: expressionValues,
        ExpressionAttributeNames: expressionNames,
        ReturnValues: 'ALL_NEW',
      })
    );

    return success(result.Attributes);
  } catch (error) {
    console.error('updateTier error:', error);
    return serverError('Failed to update tier');
  }
}

/**
 * PUT /api/tiers/comparison - Update comparison features (ADMIN)
 */
export async function updateComparisonFeatures(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (!isAdmin(event)) {
    return badRequest('Admin access required');
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { comparisonFeatures } = body;

    if (!Array.isArray(comparisonFeatures)) {
      return badRequest('comparisonFeatures must be an array');
    }

    const now = new Date().toISOString();

    await client.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          pk: 'TIER',
          sk: 'TIER#COMPARISON',
          comparisonFeatures,
          gsi1pk: 'TIER',
          gsi1sk: '999',
          updatedAt: now,
        },
      })
    );

    return success({ comparisonFeatures, updatedAt: now });
  } catch (error) {
    console.error('updateComparisonFeatures error:', error);
    return serverError('Failed to update comparison features');
  }
}
