import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminAddUserToGroupCommand,
  ListUsersCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { created, badRequest, serverError } from '../utils/response';
import { buildTrialFields } from '../utils/trial';
import { randomUUID } from 'crypto';

const cognito = new CognitoIdentityProviderClient({});
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.TABLE_NAME!;
const USER_POOL_ID = process.env.USER_POOL_ID!;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_SIGNUPS_PER_HOUR = 5;

/** IP-based rate limiting using DynamoDB with TTL */
async function checkSignupRateLimit(ip: string): Promise<boolean> {
  const key = { pk: 'RATE_LIMIT', sk: `SIGNUP#${ip}` };
  const now = Math.floor(Date.now() / 1000);
  const ttl = now + 3600; // 1 hour

  try {
    const result = await ddb.send(new GetCommand({ TableName: TABLE_NAME, Key: key }));
    const item = result.Item;

    if (item && item.expiresAt > now && item.count >= MAX_SIGNUPS_PER_HOUR) {
      return false; // rate limited
    }

    if (item && item.expiresAt > now) {
      await ddb.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: key,
        UpdateExpression: 'SET #c = #c + :one',
        ExpressionAttributeNames: { '#c': 'count' },
        ExpressionAttributeValues: { ':one': 1 },
      }));
    } else {
      await ddb.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: { ...key, count: 1, expiresAt: ttl },
      }));
    }
    return true;
  } catch {
    return true; // fail open to avoid blocking legitimate signups
  }
}

/**
 * Generate a URL-safe temporary password that satisfies the Cognito password
 * policy (8+ chars, uppercase, lowercase, digit, no symbols required).
 */
function generateTempPassword(): string {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const all = upper + lower + digits;

  // Start with guaranteed upper + lower
  let pwd = 'Hx';
  for (let i = 0; i < 10; i++) {
    pwd += all[Math.floor(Math.random() * all.length)];
  }
  // Ensure at least one digit
  pwd += digits[Math.floor(Math.random() * digits.length)];
  return pwd;
}

/**
 * POST /api/signup - Create a new user account via intake wizard (PUBLIC)
 */
export async function createAccount(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const body = JSON.parse(event.body || '{}');

    const { givenName, familyName, email, termsAccepted, privacyAccepted } = body;

    if (!givenName || !familyName || !email) {
      return badRequest('givenName, familyName, and email are required');
    }

    if (!EMAIL_REGEX.test(email)) {
      return badRequest('Invalid email address format');
    }

    if (!termsAccepted || !privacyAccepted) {
      return badRequest('You must accept the Terms of Use and Privacy Policy');
    }

    // IP-based rate limiting
    const sourceIp = event.requestContext?.identity?.sourceIp || 'unknown';
    const allowed = await checkSignupRateLimit(sourceIp);
    if (!allowed) {
      return badRequest('Too many signup attempts. Please try again later.');
    }

    // Check if a user with this email already exists (e.g. Google-federated)
    const existingUsers = await cognito.send(
      new ListUsersCommand({
        UserPoolId: USER_POOL_ID,
        Filter: `email = "${email}"`,
        Limit: 5,
      })
    );

    if (existingUsers.Users && existingUsers.Users.length > 0) {
      const hasGoogleUser = existingUsers.Users.some(
        (u) =>
          u.UserStatus === 'EXTERNAL_PROVIDER' ||
          u.Username?.startsWith('Google_') ||
          u.Username?.startsWith('google_')
      );

      if (hasGoogleUser) {
        return badRequest(
          'An account with this email already exists via Google. Please sign in with Google instead.'
        );
      }

      // Native user already exists
      return badRequest('An account with this email already exists');
    }

    const tempPassword = generateTempPassword();

    // Create user in Cognito
    const createResult = await cognito.send(
      new AdminCreateUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: email,
        TemporaryPassword: tempPassword,
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'given_name', Value: givenName },
          { Name: 'family_name', Value: familyName },
        ],
        DesiredDeliveryMediums: ['EMAIL'],
        ClientMetadata: { source: 'intake' },
      })
    );

    // Extract Cognito sub from response
    const sub =
      createResult.User?.Attributes?.find((a) => a.Name === 'sub')?.Value || '';

    if (!sub) {
      console.error('No sub found in AdminCreateUser response');
      return serverError('Account created but failed to retrieve user ID');
    }

    // Add user to Client group
    await cognito.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: USER_POOL_ID,
        Username: email,
        GroupName: 'Client',
      })
    );

    const now = new Date().toISOString();
    const trialFields = buildTrialFields();

    // Write user profile to DynamoDB
    await ddb.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          pk: `USER#${sub}`,
          sk: 'PROFILE',
          email,
          givenName,
          familyName,
          tier: 'Pup',
          ...trialFields,
          termsAcceptedAt: now,
          privacyAcceptedAt: now,
          createdAt: now,
        },
      })
    );

    // Log audit events for Terms and Privacy acceptance
    const uuid1 = randomUUID().slice(0, 8);
    const uuid2 = randomUUID().slice(0, 8);

    await Promise.all([
      ddb.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            pk: 'AUDIT',
            sk: `${now}#${uuid1}`,
            eventType: 'TERMS_ACCEPT',
            consentValue: 'accepted',
            userAgent:
              event.headers['User-Agent'] ||
              event.headers['user-agent'] ||
              null,
            ipAddress: event.requestContext?.identity?.sourceIp || null,
            metadata: { email, cognitoSub: sub },
            createdAt: now,
          },
        })
      ),
      ddb.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            pk: 'AUDIT',
            sk: `${now}#${uuid2}`,
            eventType: 'PRIVACY_ACCEPT',
            consentValue: 'accepted',
            userAgent:
              event.headers['User-Agent'] ||
              event.headers['user-agent'] ||
              null,
            ipAddress: event.requestContext?.identity?.sourceIp || null,
            metadata: { email, cognitoSub: sub },
            createdAt: now,
          },
        })
      ),
    ]);

    return created({ success: true, email });
  } catch (error: any) {
    if (error.name === 'UsernameExistsException') {
      return badRequest('An account with this email already exists');
    }
    console.error('createAccount error:', error);
    return serverError('Failed to create account');
  }
}
