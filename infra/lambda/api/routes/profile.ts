import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, created, badRequest, forbidden, notFound, serverError } from '../utils/response';
import { extractClaims, isAdmin } from '../utils/auth';
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

    if (result.Item) {
      return success(result.Item);
    }

    // Auto-create profile from Cognito claims for pre-existing accounts
    // (e.g., admin account created via CLI before signup flow existed)
    const email = claims.email || '';
    const givenName = claims.given_name || '';
    const familyName = claims.family_name || '';
    const now = new Date().toISOString();

    const profile = {
      pk: `USER#${claims.sub}`,
      sk: 'PROFILE',
      email,
      givenName,
      familyName,
      tier: 'Pup',
      source: 'manual',
      createdAt: now,
    };

    await client.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: profile,
      })
    );

    return success(profile);
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

/**
 * GET /api/profile/fitness - Get the current user's fitness profile (AUTHENTICATED)
 */
export async function getFitnessProfile(
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
        ProjectionExpression: 'fitnessProfile, fitnessProfileCompletedAt',
      })
    );

    return success({
      fitnessProfile: result.Item?.fitnessProfile || null,
      fitnessProfileCompletedAt: result.Item?.fitnessProfileCompletedAt || null,
    });
  } catch (error) {
    console.error('getFitnessProfile error:', error);
    return serverError('Failed to fetch fitness profile');
  }
}

/**
 * PUT /api/profile/fitness - Save/update the current user's fitness profile (AUTHENTICATED)
 */
export async function updateFitnessProfile(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const claims = extractClaims(event);
  if (!claims?.sub) {
    return forbidden('Authentication required');
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { fitnessProfile } = body;

    if (!fitnessProfile || typeof fitnessProfile !== 'object') {
      return badRequest('fitnessProfile object is required');
    }

    // Validate required fields
    const validExperienceLevels = ['beginner', 'intermediate', 'advanced', 'elite'];
    if (fitnessProfile.experienceLevel && !validExperienceLevels.includes(fitnessProfile.experienceLevel)) {
      return badRequest('Invalid experience level');
    }

    const now = new Date().toISOString();

    const result = await client.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          pk: `USER#${claims.sub}`,
          sk: 'PROFILE',
        },
        UpdateExpression: 'SET #fp = :fp, #fpca = :fpca, #ua = :ua',
        ExpressionAttributeNames: {
          '#fp': 'fitnessProfile',
          '#fpca': 'fitnessProfileCompletedAt',
          '#ua': 'updatedAt',
        },
        ExpressionAttributeValues: {
          ':fp': fitnessProfile,
          ':fpca': now,
          ':ua': now,
        },
        ReturnValues: 'ALL_NEW',
      })
    );

    return success({
      fitnessProfile: result.Attributes?.fitnessProfile,
      fitnessProfileCompletedAt: result.Attributes?.fitnessProfileCompletedAt,
    });
  } catch (error) {
    console.error('updateFitnessProfile error:', error);
    return serverError('Failed to update fitness profile');
  }
}

/**
 * GET /api/profile/nutrition - Get the current user's nutrition profile (AUTHENTICATED)
 */
export async function getNutritionProfile(
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
        ProjectionExpression: 'nutritionProfile, nutritionProfileCompletedAt',
      })
    );

    return success({
      nutritionProfile: result.Item?.nutritionProfile || null,
      nutritionProfileCompletedAt: result.Item?.nutritionProfileCompletedAt || null,
    });
  } catch (error) {
    console.error('getNutritionProfile error:', error);
    return serverError('Failed to fetch nutrition profile');
  }
}

/**
 * PUT /api/profile/nutrition - Save/update the current user's nutrition profile (AUTHENTICATED)
 */
export async function updateNutritionProfile(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const claims = extractClaims(event);
  if (!claims?.sub) {
    return forbidden('Authentication required');
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { nutritionProfile } = body;

    if (!nutritionProfile || typeof nutritionProfile !== 'object') {
      return badRequest('nutritionProfile object is required');
    }

    const now = new Date().toISOString();

    const result = await client.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          pk: `USER#${claims.sub}`,
          sk: 'PROFILE',
        },
        UpdateExpression: 'SET #np = :np, #npca = :npca, #ua = :ua',
        ExpressionAttributeNames: {
          '#np': 'nutritionProfile',
          '#npca': 'nutritionProfileCompletedAt',
          '#ua': 'updatedAt',
        },
        ExpressionAttributeValues: {
          ':np': nutritionProfile,
          ':npca': now,
          ':ua': now,
        },
        ReturnValues: 'ALL_NEW',
      })
    );

    return success({
      nutritionProfile: result.Attributes?.nutritionProfile,
      nutritionProfileCompletedAt: result.Attributes?.nutritionProfileCompletedAt,
    });
  } catch (error) {
    console.error('updateNutritionProfile error:', error);
    return serverError('Failed to update nutrition profile');
  }
}

/**
 * GET /api/users/{username}/fitness-profile - Admin-only: get a user's fitness profile
 */
export async function getAdminUserFitnessProfile(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (!isAdmin(event)) {
    return forbidden('Admin access required');
  }

  const username = event.pathParameters?.username;
  if (!username) {
    return badRequest('Username is required');
  }

  try {
    const result = await client.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          pk: `USER#${username}`,
          sk: 'PROFILE',
        },
        ProjectionExpression: 'fitnessProfile, fitnessProfileCompletedAt',
      })
    );

    if (!result.Item) {
      return notFound('User profile not found');
    }

    return success({
      fitnessProfile: result.Item.fitnessProfile || null,
      fitnessProfileCompletedAt: result.Item.fitnessProfileCompletedAt || null,
    });
  } catch (error) {
    console.error('getAdminUserFitnessProfile error:', error);
    return serverError('Failed to fetch user fitness profile');
  }
}
