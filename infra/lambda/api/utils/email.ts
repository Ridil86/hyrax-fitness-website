/**
 * Shared SES email utility for sending transactional emails.
 *
 * Used by: email-preview, stripe-webhook, support, trial-reminder.
 * Checks user notification preferences before sending (unless skipPrefs is true).
 */

import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

const ses = new SESClient({});
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.TABLE_NAME!;
const FROM_EMAIL = process.env.SES_FROM_EMAIL || 'noreply@hyraxfitness.com';

export type NotificationCategory = 'subscription' | 'support' | 'trial';

/**
 * Send an HTML email via SES.
 */
export async function sendEmail(
  to: string,
  subject: string,
  htmlBody: string
): Promise<void> {
  await ses.send(
    new SendEmailCommand({
      Source: `Hyrax Fitness <${FROM_EMAIL}>`,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: subject },
        Body: { Html: { Data: htmlBody } },
      },
    })
  );
}

/**
 * Check whether a user has opted in to a notification category.
 * Defaults to true if no preferences are set (new users get all notifications).
 */
export async function shouldNotify(
  cognitoSub: string,
  category: NotificationCategory
): Promise<boolean> {
  try {
    const result = await ddb.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { pk: `USER#${cognitoSub}`, sk: 'PROFILE' },
        ProjectionExpression: 'notificationPreferences',
      })
    );
    const prefs = result.Item?.notificationPreferences;
    if (!prefs) return true; // default: all on
    return prefs[category] !== false;
  } catch {
    // If we can't read prefs, default to sending
    return true;
  }
}

/**
 * Look up a user's email from their profile record.
 */
export async function getUserEmail(
  cognitoSub: string
): Promise<string | null> {
  try {
    const result = await ddb.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { pk: `USER#${cognitoSub}`, sk: 'PROFILE' },
        ProjectionExpression: 'email',
      })
    );
    return result.Item?.email || null;
  } catch {
    return null;
  }
}

/**
 * Send a notification email if the user has opted in to the category.
 * Returns true if sent, false if skipped or failed.
 */
export async function sendNotification(
  cognitoSub: string,
  category: NotificationCategory,
  subject: string,
  htmlBody: string
): Promise<boolean> {
  try {
    const [email, allowed] = await Promise.all([
      getUserEmail(cognitoSub),
      shouldNotify(cognitoSub, category),
    ]);

    if (!email || !allowed) return false;

    await sendEmail(email, subject, htmlBody);
    return true;
  } catch (err) {
    console.warn(`Failed to send ${category} notification to ${cognitoSub}:`, err);
    return false;
  }
}
