/**
 * Seed community categories into DynamoDB.
 * Usage: cd infra && MSYS_NO_PATHCONV=1 npx tsx scripts/seed-categories.ts --profile hyrax-fitness
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { fromIni } from '@aws-sdk/credential-providers';

const TABLE_NAME = 'HyraxContent';
const REGION = 'us-east-1';

// Parse --profile flag
const args = process.argv.slice(2);
const profileIndex = args.indexOf('--profile');
const profile = profileIndex !== -1 ? args[profileIndex + 1] : undefined;

const clientConfig: any = { region: REGION };
if (profile) {
  clientConfig.credentials = fromIni({ profile });
}

const client = DynamoDBDocumentClient.from(new DynamoDBClient(clientConfig));

const CATEGORIES = [
  { id: 'general', label: 'General', description: 'Open discussion', icon: '💬', sortOrder: 1 },
  { id: 'workouts', label: 'Workouts', description: 'Workout tips, routines, questions', icon: '✊', sortOrder: 2 },
  { id: 'exercises', label: 'Exercises', description: 'Movement-specific discussion', icon: '🏋️', sortOrder: 3 },
  { id: 'events', label: 'Events', description: 'Upcoming events, meetups', icon: '📅', sortOrder: 4 },
  { id: 'progress', label: 'Progress', description: 'Member progress updates, achievements', icon: '📈', sortOrder: 5 },
  { id: 'tips', label: 'Tips & Modifications', description: 'Form tips, scaling advice', icon: '💡', sortOrder: 6 },
];

async function seed() {
  console.log('Seeding community categories...');

  for (const cat of CATEGORIES) {
    const item = {
      pk: 'COMMUNITY_CONFIG',
      sk: `CATEGORY#${cat.id}`,
      id: cat.id,
      label: cat.label,
      description: cat.description,
      icon: cat.icon,
      sortOrder: cat.sortOrder,
      createdAt: new Date().toISOString(),
    };

    await client.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
    console.log(`  ✓ ${cat.label}`);
  }

  console.log('Done! Seeded', CATEGORIES.length, 'categories.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
