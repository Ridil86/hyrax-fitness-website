import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
  AdminListGroupsForUserCommand,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
  AdminGetUserCommand,
  AdminDeleteUserCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, badRequest, notFound, serverError } from '../utils/response';
import { isAdmin } from '../utils/auth';

const cognito = new CognitoIdentityProviderClient({});
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const USER_POOL_ID = process.env.USER_POOL_ID!;
const TABLE_NAME = process.env.TABLE_NAME!;

/**
 * GET /api/users - List Cognito users
 * Query params: limit, token (pagination), filter (email search)
 */
export async function listUsers(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (!isAdmin(event)) return badRequest('Admin access required');

  try {
    const limit = parseInt(event.queryStringParameters?.limit || '25', 10);
    const paginationToken = event.queryStringParameters?.token || undefined;
    const filter = event.queryStringParameters?.filter || undefined;

    const params: any = {
      UserPoolId: USER_POOL_ID,
      Limit: Math.min(limit, 60),
    };

    if (paginationToken) {
      params.PaginationToken = paginationToken;
    }

    if (filter) {
      params.Filter = `email ^= "${filter}"`;
    }

    const result = await cognito.send(new ListUsersCommand(params));

    // Map users and fetch groups in parallel
    const users = await Promise.all(
      (result.Users || []).map(async (user) => {
        const attrs: Record<string, string> = {};
        (user.Attributes || []).forEach((attr) => {
          if (attr.Name && attr.Value) {
            attrs[attr.Name] = attr.Value;
          }
        });

        // Fetch groups for this user
        let groups: string[] = [];
        try {
          const groupsResult = await cognito.send(
            new AdminListGroupsForUserCommand({
              UserPoolId: USER_POOL_ID,
              Username: user.Username!,
            })
          );
          groups = (groupsResult.Groups || []).map((g) => g.GroupName!);
        } catch (err) {
          console.error(`Failed to fetch groups for ${user.Username}:`, err);
        }

        return {
          username: user.Username,
          email: attrs.email || '',
          givenName: attrs.given_name || '',
          familyName: attrs.family_name || '',
          status: user.UserStatus,
          enabled: user.Enabled,
          createdAt: user.UserCreateDate?.toISOString(),
          lastModified: user.UserLastModifiedDate?.toISOString(),
          groups,
        };
      })
    );

    return success({
      users,
      nextToken: result.PaginationToken || null,
    });
  } catch (error) {
    console.error('listUsers error:', error);
    return serverError('Failed to list users');
  }
}

/**
 * GET /api/users/{username}/groups - Get a user's groups
 */
export async function getUserGroups(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (!isAdmin(event)) return badRequest('Admin access required');

  const username = event.pathParameters?.username;
  if (!username) return badRequest('Username is required');

  try {
    const result = await cognito.send(
      new AdminListGroupsForUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: decodeURIComponent(username),
      })
    );

    const groups = (result.Groups || []).map((g) => ({
      name: g.GroupName,
      precedence: g.Precedence,
    }));

    return success({ username: decodeURIComponent(username), groups });
  } catch (error) {
    console.error('getUserGroups error:', error);
    return serverError('Failed to get user groups');
  }
}

/**
 * PUT /api/users/{username}/groups - Update a user's groups
 * Body: { groups: string[] } - The desired group list (Admin, Client)
 */
export async function updateUserGroups(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (!isAdmin(event)) return badRequest('Admin access required');

  const username = event.pathParameters?.username;
  if (!username) return badRequest('Username is required');

  try {
    const body = JSON.parse(event.body || '{}');
    if (!Array.isArray(body.groups)) {
      return badRequest('groups array is required');
    }

    const decodedUsername = decodeURIComponent(username);
    const validGroups = ['Admin', 'Client'];
    const desiredGroups = body.groups.filter((g: string) =>
      validGroups.includes(g)
    );

    // Get current groups
    const currentResult = await cognito.send(
      new AdminListGroupsForUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: decodedUsername,
      })
    );

    const currentGroups = (currentResult.Groups || []).map(
      (g) => g.GroupName!
    );

    // Add missing groups
    const toAdd = desiredGroups.filter(
      (g: string) => !currentGroups.includes(g)
    );
    for (const group of toAdd) {
      await cognito.send(
        new AdminAddUserToGroupCommand({
          UserPoolId: USER_POOL_ID,
          Username: decodedUsername,
          GroupName: group,
        })
      );
    }

    // Remove extra groups
    const toRemove = currentGroups.filter(
      (g) => !desiredGroups.includes(g)
    );
    for (const group of toRemove) {
      await cognito.send(
        new AdminRemoveUserFromGroupCommand({
          UserPoolId: USER_POOL_ID,
          Username: decodedUsername,
          GroupName: group,
        })
      );
    }

    return success({
      username: decodedUsername,
      groups: desiredGroups,
    });
  } catch (error) {
    console.error('updateUserGroups error:', error);
    return serverError('Failed to update user groups');
  }
}

/**
 * DELETE /api/users/{username} - Delete a user (ADMIN)
 * Removes from Cognito and cleans up DynamoDB profile
 */
export async function deleteUser(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (!isAdmin(event)) return badRequest('Admin access required');

  const username = event.pathParameters?.username;
  if (!username) return badRequest('Username is required');

  const decodedUsername = decodeURIComponent(username);

  try {
    // Get user's sub from Cognito before deleting
    let sub = '';
    try {
      const userResult = await cognito.send(
        new AdminGetUserCommand({
          UserPoolId: USER_POOL_ID,
          Username: decodedUsername,
        })
      );
      sub =
        userResult.UserAttributes?.find((a) => a.Name === 'sub')?.Value || '';
    } catch (err: any) {
      if (err.name === 'UserNotFoundException') {
        return notFound('User not found');
      }
      throw err;
    }

    // Delete from Cognito
    await cognito.send(
      new AdminDeleteUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: decodedUsername,
      })
    );

    // Clean up DynamoDB profile if sub was found
    if (sub) {
      await ddb.send(
        new DeleteCommand({
          TableName: TABLE_NAME,
          Key: { pk: `USER#${sub}`, sk: 'PROFILE' },
        })
      );
    }

    return success({ deleted: true, username: decodedUsername });
  } catch (error) {
    console.error('deleteUser error:', error);
    return serverError('Failed to delete user');
  }
}

/**
 * PUT /api/users/{username}/status - Enable or disable a user (ADMIN)
 * Body: { enabled: boolean }
 */
export async function setUserStatus(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (!isAdmin(event)) return badRequest('Admin access required');

  const username = event.pathParameters?.username;
  if (!username) return badRequest('Username is required');

  try {
    const body = JSON.parse(event.body || '{}');
    if (typeof body.enabled !== 'boolean') {
      return badRequest('enabled (boolean) is required');
    }

    const decodedUsername = decodeURIComponent(username);

    if (body.enabled) {
      await cognito.send(
        new AdminEnableUserCommand({
          UserPoolId: USER_POOL_ID,
          Username: decodedUsername,
        })
      );
    } else {
      await cognito.send(
        new AdminDisableUserCommand({
          UserPoolId: USER_POOL_ID,
          Username: decodedUsername,
        })
      );
    }

    return success({ username: decodedUsername, enabled: body.enabled });
  } catch (error: any) {
    if (error.name === 'UserNotFoundException') {
      return notFound('User not found');
    }
    console.error('setUserStatus error:', error);
    return serverError('Failed to update user status');
  }
}
