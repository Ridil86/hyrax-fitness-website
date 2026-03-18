/**
 * Seed the 3 default tiers into DynamoDB and create corresponding Stripe Products + Prices.
 *
 * Usage:
 *   cd infra && MSYS_NO_PATHCONV=1 npx tsx scripts/seed-tiers.ts --profile hyrax-fitness
 *
 * Environment variables:
 *   STRIPE_SECRET_KEY - Your Stripe test secret key (sk_test_...)
 *
 * This script is idempotent — it will skip tiers that already exist in DynamoDB.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { fromIni } from '@aws-sdk/credential-providers';
import Stripe from 'stripe';

const TABLE_NAME = 'HyraxContent';

// Parse --profile flag
const profileIdx = process.argv.indexOf('--profile');
const profile = profileIdx !== -1 ? process.argv[profileIdx + 1] : undefined;

const ddbClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region: 'us-east-1',
    ...(profile ? { credentials: fromIni({ profile }) } : {}),
  })
);

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

const TIERS = [
  {
    id: '1',
    name: 'Pup',
    level: 1,
    description: 'Free access to basic workouts and community features.',
    price: 'Free',
    priceInCents: 0,
    features: [
      'Basic workout library',
      'Community access',
      'Progress tracking',
    ],
    sortOrder: 1,
    needsStripe: false,
  },
  {
    id: '2',
    name: 'Rock Runner',
    level: 2,
    description: 'Unlock premium workouts and personalized training plans.',
    price: '$5/mo',
    priceInCents: 500,
    features: [
      'All Pup features',
      'Premium workout library',
      'Personalized training plans',
      'Priority community support',
      'Downloadable workout PDFs',
    ],
    sortOrder: 2,
    needsStripe: true,
    existingStripeProductId: 'prod_UAWrfzLkyrpYwe',
    existingStripePriceId: 'price_1TCBnoGymHmmAGZQWQZ5o2Bv',
  },
  {
    id: '3',
    name: 'Iron Dassie',
    level: 3,
    description: 'The ultimate Hyrax experience with coaching and exclusive content.',
    price: '$20/mo',
    priceInCents: 2000,
    features: [
      'All Rock Runner features',
      'Exclusive elite workouts',
      'Direct coaching access',
      'Custom programming',
      'Event priority registration',
      'Advanced analytics',
    ],
    sortOrder: 3,
    needsStripe: true,
    existingStripeProductId: 'prod_UAWxOiFJWRo4A2',
    existingStripePriceId: 'price_1TCBtoGymHmmAGZQAqOVA79q',
  },
];

async function main() {
  console.log('Seeding tiers into DynamoDB...');

  let stripe: Stripe | null = null;
  if (STRIPE_SECRET_KEY && !STRIPE_SECRET_KEY.includes('placeholder')) {
    stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2025-04-30.basil' });
    console.log('Stripe SDK initialized — will create Products/Prices.');
  } else {
    console.log(
      'No STRIPE_SECRET_KEY set — skipping Stripe Product/Price creation.',
      '\nSet STRIPE_SECRET_KEY=sk_test_... to create Stripe objects.'
    );
  }

  for (const tier of TIERS) {
    // Check if tier already exists
    const existing = await ddbClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { pk: 'TIER', sk: `TIER#${tier.id}` },
      })
    );

    if (existing.Item) {
      console.log(`  SKIP: Tier "${tier.name}" already exists.`);
      continue;
    }

    let stripeProductId: string | null = (tier as any).existingStripeProductId || null;
    let stripePriceId: string | null = (tier as any).existingStripePriceId || null;

    // Use existing Stripe IDs if provided, otherwise create new ones
    if (tier.needsStripe && !stripeProductId && stripe) {
      console.log(`  Creating Stripe Product for "${tier.name}"...`);
      const product = await stripe.products.create({
        name: tier.name,
        description: tier.description,
        metadata: { tierId: tier.id, level: String(tier.level) },
      });
      stripeProductId = product.id;

      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: tier.priceInCents,
        currency: 'usd',
        recurring: { interval: 'month' },
      });
      stripePriceId = price.id;

      // Set default price on product
      await stripe.products.update(product.id, { default_price: price.id });

      console.log(`    Product: ${product.id}, Price: ${price.id}`);
    } else if (stripeProductId) {
      console.log(`  Using existing Stripe Product: ${stripeProductId}, Price: ${stripePriceId}`);
    }

    // Write to DynamoDB
    const now = new Date().toISOString();
    await ddbClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          pk: 'TIER',
          sk: `TIER#${tier.id}`,
          name: tier.name,
          level: tier.level,
          description: tier.description,
          price: tier.price,
          priceInCents: tier.priceInCents,
          billingInterval: 'month',
          features: tier.features,
          sortOrder: tier.sortOrder,
          stripeProductId,
          stripePriceId,
          gsi1pk: 'TIER',
          gsi1sk: String(tier.sortOrder).padStart(3, '0'),
          createdAt: now,
        },
      })
    );

    console.log(`  CREATED: Tier "${tier.name}" (level ${tier.level})`);
  }

  console.log('\nDone! All tiers seeded.');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
