/**
 * Seed script: Loads hardcoded content data from JSON files into DynamoDB.
 * Run: cd infra && MSYS_NO_PATHCONV=1 npx tsx scripts/seed-content.ts --profile hyrax-fitness
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { fromIni } from '@aws-sdk/credential-providers';
import * as fs from 'fs';
import * as path from 'path';

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

function loadJson(filename: string): any {
  const filePath = path.join(__dirname, 'seed-data', filename);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

async function seedFaq(): Promise<void> {
  const faqs: Array<{ q: string; a: string }> = loadJson('faq.json');

  for (let i = 0; i < faqs.length; i++) {
    const id = String(i + 1).padStart(3, '0');
    await client.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          pk: 'FAQ',
          sk: `FAQ#${id}`,
          id,
          q: faqs[i].q,
          a: faqs[i].a,
          sortOrder: i + 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      })
    );
    console.log(`  FAQ#${id}: ${faqs[i].q.slice(0, 40)}...`);
  }
}

async function seedContent(section: string, filename: string): Promise<void> {
  const data = loadJson(filename);

  await client.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: 'CONTENT',
        sk: section,
        data,
        updatedAt: new Date().toISOString(),
      },
    })
  );
  console.log(`  CONTENT#${section}: seeded`);
}

async function main(): Promise<void> {
  console.log(`Seeding DynamoDB table: ${TABLE_NAME}`);
  console.log(`Region: ${REGION}`);
  if (profile) console.log(`Profile: ${profile}`);
  console.log('');

  console.log('Seeding FAQ items...');
  await seedFaq();
  console.log('');

  console.log('Seeding content sections...');
  await seedContent('hero', 'hero.json');
  await seedContent('dassie', 'dassie.json');
  await seedContent('method', 'method.json');
  await seedContent('workouts', 'workouts.json');
  await seedContent('programs', 'programs.json');
  await seedContent('testimonials', 'testimonials.json');
  await seedContent('getstarted', 'getstarted.json');
  console.log('');

  console.log('Done! All content seeded successfully.');
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
