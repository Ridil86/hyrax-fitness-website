/**
 * Trial Expiration Reminder Lambda
 *
 * Runs daily via EventBridge. Scans for users whose free trial is:
 * - Expiring in 2 days → sends "trial expiring" email
 * - Expiring today → sends "trial expired" email
 *
 * Only sends to users who have trial notification preferences enabled.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import {
  trialExpiringEmail,
  trialExpiredEmail,
} from '../custom-message/templates';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const ses = new SESClient({});
const TABLE_NAME = process.env.TABLE_NAME!;
const FROM_EMAIL = process.env.SES_FROM_EMAIL || 'noreply@hyraxfitness.com';

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  await ses.send(
    new SendEmailCommand({
      Source: `Hyrax Fitness <${FROM_EMAIL}>`,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: subject },
        Body: { Html: { Data: html } },
      },
    })
  );
}

function toDateString(date: Date): string {
  return date.toISOString().split('T')[0]; // YYYY-MM-DD
}

export const handler = async (): Promise<void> => {
  console.log('Trial reminder Lambda triggered');

  const now = new Date();
  const todayStr = toDateString(now);
  const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  const twoDaysStr = toDateString(twoDaysFromNow);

  // Scan for users with active trials
  // FilterExpression: trialEndsAt is either today or 2 days from now
  // and the user still has trial active (tier is Iron Dassie via trial)
  let lastKey: Record<string, unknown> | undefined;
  let sent = 0;
  let skipped = 0;

  do {
    const result = await ddb.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression:
          'begins_with(sk, :sk) AND attribute_exists(trialEndsAt) AND trialActive = :active',
        ExpressionAttributeValues: {
          ':sk': 'PROFILE',
          ':active': true,
        },
        ProjectionExpression: 'pk, email, givenName, trialEndsAt, notificationPreferences',
        ExclusiveStartKey: lastKey,
      })
    );

    for (const item of result.Items || []) {
      const trialEndsAt = item.trialEndsAt as string; // ISO string or YYYY-MM-DD
      const trialDateStr = trialEndsAt.split('T')[0];
      const email = item.email as string;
      const name = (item.givenName as string) || 'there';

      // Check notification preferences
      const prefs = item.notificationPreferences as Record<string, boolean> | undefined;
      if (prefs && prefs.trial === false) {
        skipped++;
        continue;
      }

      if (!email) {
        skipped++;
        continue;
      }

      try {
        if (trialDateStr === twoDaysStr) {
          // Trial expires in 2 days
          await sendEmail(
            email,
            'Your free trial ends in 2 days',
            trialExpiringEmail(2, name)
          );
          sent++;
          console.log(`Sent trial-expiring email to ${email}`);
        } else if (trialDateStr === todayStr) {
          // Trial expires today
          await sendEmail(
            email,
            'Your free trial has ended',
            trialExpiredEmail(name)
          );
          sent++;
          console.log(`Sent trial-expired email to ${email}`);
        }
      } catch (err) {
        console.warn(`Failed to send trial reminder to ${email}:`, err);
      }
    }

    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  console.log(`Trial reminder complete: ${sent} emails sent, ${skipped} skipped`);
};
