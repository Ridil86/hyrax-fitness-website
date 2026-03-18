/**
 * Seed the 3 default tiers into DynamoDB and create corresponding Stripe Products + Prices.
 *
 * Usage:
 *   cd infra && MSYS_NO_PATHCONV=1 npx tsx scripts/seed-tiers.ts --profile hyrax-fitness
 *   cd infra && MSYS_NO_PATHCONV=1 npx tsx scripts/seed-tiers.ts --update --profile hyrax-fitness
 *
 * Flags:
 *   --update    Update existing tiers' features, logoUrl, and comparison data (preserves Stripe IDs)
 *   --profile   AWS CLI profile name
 *
 * Environment variables:
 *   STRIPE_SECRET_KEY - Your Stripe test secret key (sk_test_...)
 *
 * This script is idempotent — it will skip tiers that already exist in DynamoDB (unless --update).
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { fromIni } from '@aws-sdk/credential-providers';
import Stripe from 'stripe';

const TABLE_NAME = 'HyraxContent';

// Parse flags
const profileIdx = process.argv.indexOf('--profile');
const profile = profileIdx !== -1 ? process.argv[profileIdx + 1] : undefined;
const isUpdate = process.argv.includes('--update');

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
    description: 'Curious newcomers testing the terrain. Dip in, explore the movements, and see if the Hyrax way clicks.',
    price: 'Free',
    priceInCents: 0,
    logoUrl: '/img/tier-1-logo-256.png',
    features: [
      'Limited workout video library',
      'Downloadable PDF guides',
      'Movement tutorials',
      'Community access',
    ],
    sortOrder: 1,
    needsStripe: false,
  },
  {
    id: '2',
    name: 'Rock Runner',
    level: 2,
    description: "Self-starters who want structure and accountability. You know you'll show up and be ready to train.",
    price: '$5/mo',
    priceInCents: 500,
    logoUrl: '/img/tier-2-logo-256.png',
    features: [
      'Customized workout routines',
      'Benchmark tracking',
      'Progress analytics',
      'Full workout video library',
      'Downloadable PDF guides',
      'Movement tutorials',
      'Community access',
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
    description: 'No half measures. Expert guidance, peak nutrition, and a system fully customized around your life.',
    price: '$20/mo',
    priceInCents: 2000,
    logoUrl: '/img/tier-3-logo-256.png',
    features: [
      'Digital Personal Trainer',
      'Customized diet plans',
      'Customized workout routines',
      'Benchmark tracking',
      'Progress analytics',
      'Full workout video library',
      'Downloadable PDF guides',
      'Movement tutorials',
      'Community access',
      'Priority support',
    ],
    sortOrder: 3,
    needsStripe: true,
    existingStripeProductId: 'prod_UAWxOiFJWRo4A2',
    existingStripePriceId: 'price_1TCBtoGymHmmAGZQAqOVA79q',
  },
];

const COMPARISON_FEATURES = [
  {
    category: 'Content Library',
    items: [
      { name: 'Workout Video Library', detail: 'Access to Hyrax workout videos covering all five modules with scaling options for every fitness level. Pup members get a curated starter selection.', pup: 'limited', runner: true, sentinel: true },
      { name: 'Downloadable PDF Guides', detail: 'Printable workout sheets, equipment checklists, and session planners you can take to the gym or the trail.', pup: true, runner: true, sentinel: true },
      { name: 'Movement Tutorials', detail: 'Step-by-step breakdowns for every Hyrax movement pattern. Learn proper form for carries, crawls, bolts, and scrambles.', pup: true, runner: true, sentinel: true },
    ],
  },
  {
    category: 'Community',
    items: [
      { name: 'Community Access', detail: 'Join the Hyrax community to share progress, ask questions, and connect with other athletes training the same system.', pup: true, runner: true, sentinel: true },
    ],
  },
  {
    category: 'Personalization',
    items: [
      { name: 'Customized Workout Routines', detail: 'Training plans built around your intake assessment. Workouts are tailored to your fitness level, equipment access, and weekly schedule.', pup: false, runner: true, sentinel: true },
      { name: 'Customized Diet Plans', detail: 'Nutrition guidance matched to your training load and goals. Covers meal timing, macros, and practical food choices that support performance.', pup: false, runner: false, sentinel: true },
    ],
  },
  {
    category: 'Tracking & Analytics',
    items: [
      { name: 'Benchmark Tracking', detail: 'Log your Outcrop Challenge scores, carry loads, and session times. See exactly where you stand and how far you have come.', pup: false, runner: true, sentinel: true },
      { name: 'Progress Analytics', detail: 'Charts and insights that break down your improvement over weeks and months. Spot trends, plateaus, and breakthroughs at a glance.', pup: false, runner: true, sentinel: true },
    ],
  },
  {
    category: 'Coaching & Support',
    items: [
      { name: 'Digital Personal Trainer', detail: 'An adaptive coaching system that adjusts your program week to week based on your performance, recovery, and feedback.', pup: false, runner: false, sentinel: true },
      { name: 'Priority Support', detail: 'Fast-track access to help with your training, form questions, and program adjustments. Get answers when you need them.', pup: false, runner: false, sentinel: true },
    ],
  },
];

async function main() {
  console.log(isUpdate ? 'Updating tiers in DynamoDB...' : 'Seeding tiers into DynamoDB...');

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

    if (existing.Item && !isUpdate) {
      console.log(`  SKIP: Tier "${tier.name}" already exists. Use --update to refresh.`);
      continue;
    }

    if (existing.Item && isUpdate) {
      // Update features, description, and logoUrl only (preserve Stripe IDs, price, etc.)
      const now = new Date().toISOString();
      await ddbClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { pk: 'TIER', sk: `TIER#${tier.id}` },
          UpdateExpression: 'SET #f = :f, #d = :d, #l = :l, #ua = :ua',
          ExpressionAttributeNames: {
            '#f': 'features',
            '#d': 'description',
            '#l': 'logoUrl',
            '#ua': 'updatedAt',
          },
          ExpressionAttributeValues: {
            ':f': tier.features,
            ':d': tier.description,
            ':l': tier.logoUrl,
            ':ua': now,
          },
        })
      );
      console.log(`  UPDATED: Tier "${tier.name}" — features, description, logoUrl`);
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
          logoUrl: tier.logoUrl,
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

  // Seed/update comparison features
  console.log('\nSeeding comparison features...');
  const now = new Date().toISOString();
  await ddbClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: 'TIER',
        sk: 'TIER#COMPARISON',
        comparisonFeatures: COMPARISON_FEATURES,
        gsi1pk: 'TIER',
        gsi1sk: '999',
        updatedAt: now,
      },
    })
  );
  console.log('  Comparison features seeded.');

  console.log('\nDone! All tiers seeded.');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
