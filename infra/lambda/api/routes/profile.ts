import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, created, badRequest, forbidden, serverError } from '../utils/response';
import { extractClaims } from '../utils/auth';
import { randomUUID } from 'crypto';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.TABLE_NAME!;

/**
 * GET /api/profile - Get the current user's profile (AUTHENTICATED)
 */
export async function getProfile(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const claims = extractClaims(event);
  if (!claims?.sub) {
    return forbidden('Authentication required');
  }

  try {
    const result = await client.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          pk: `USER#${claims.sub}`,
          sk: 'PROFILE',
        },
      })
    );

    return success(result.Item || null);
  } catch (error) {
    console.error('getProfile error:', error);
    return serverError('Failed to fetch profile');
  }
}

/**
 * POST /api/profile - Create profile for Google-authenticated users (AUTHENTICATED)
 *
 * Google users sign in via Cognito federated identity and bypass /api/signup,
 * so they need a separate way to create their DynamoDB profile after accepting
 * Terms of Use and Privacy Policy.
 */
export async function createProfile(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const claims = extractClaims(event);
  if (!claims?.sub) {
    return forbidden('Authentication required');
  }

  try {
    const body = JSON.parse(event.body || '{}');

    const { termsAccepted, privacyAccepted } = body;

    if (!termsAccepted || !privacyAccepted) {
      return badRequest('You must accept the Terms of Use and Privacy Policy');
    }

    // Check if profile already exists (idempotent)
    const existing = await client.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          pk: `USER#${claims.sub}`,
          sk: 'PROFILE',
        },
      })
    );

    if (existing.Item) {
      return success(existing.Item);
    }

    // Extract user info from Cognito claims
    const email = claims.email || '';
    const givenName = claims.given_name || claims['custom:given_name'] || '';
    const familyName = claims.family_name || claims['custom:family_name'] || '';

    const now = new Date().toISOString();

    // Create profile
    await client.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          pk: `USER#${claims.sub}`,
          sk: 'PROFILE',
          email,
          givenName,
          familyName,
          tier: 'Pup',
          source: 'google',
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
      client.send(
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
            metadata: { email, cognitoSub: claims.sub, source: 'google' },
            createdAt: now,
          },
        })
      ),
      client.send(
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
            metadata: { email, cognitoSub: claims.sub, source: 'google' },
            createdAt: now,
          },
        })
      ),
    ]);

    return created({ success: true, email });
  } catch (error) {
    console.error('createProfile error:', error);
    return serverError('Failed to create profile');
  }
}

/**
 * PUT /api/profile - Update the current user's profile (AUTHENTICATED)
 */
export async function updateProfile(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const claims = extractClaims(event);
  if (!claims?.sub) {
    return forbidden('Authentication required');
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { givenName, familyName } = body;

    const now = new Date().toISOString();

    const expressionParts: string[] = [];
    const expressionValues: Record<string, string> = {};
    const expressionNames: Record<string, string> = {};

    if (givenName !== undefined) {
      expressionParts.push('#gn = :gn');
      expressionValues[':gn'] = givenName;
      expressionNames['#gn'] = 'givenName';
    }

    if (familyName !== undefined) {
      expressionParts.push('#fn = :fn');
      expressionValues[':fn'] = familyName;
      expressionNames['#fn'] = 'familyName';
    }

    if (expressionParts.length === 0) {
      return badRequest('No fields to update');
    }

    expressionParts.push('#ua = :ua');
    expressionValues[':ua'] = now;
    expressionNames['#ua'] = 'updatedAt';

    const result = await client.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          pk: `USER#${claims.sub}`,
          sk: 'PROFILE',
        },
        UpdateExpression: `SET ${expressionParts.join(', ')}`,
        ExpressionAttributeValues: expressionValues,
        ExpressionAttributeNames: expressionNames,
        ReturnValues: 'ALL_NEW',
      })
    );

    return success(result.Attributes);
  } catch (error) {
    console.error('updateProfile error:', error);
    return serverError('Failed to update profile');
  }
}
