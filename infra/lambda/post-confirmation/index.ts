import {
  CognitoIdentityProviderClient,
  AdminAddUserToGroupCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import type { PostConfirmationTriggerEvent } from 'aws-lambda';

const cognito = new CognitoIdentityProviderClient({});
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TABLE_NAME = process.env.TABLE_NAME || 'HyraxContent';
const TRIAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export const handler = async (
  event: PostConfirmationTriggerEvent
): Promise<PostConfirmationTriggerEvent> => {
  if (event.triggerSource !== 'PostConfirmation_ConfirmSignUp') {
    return event;
  }

  try {
    await cognito.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: event.userPoolId,
        Username: event.userName,
        GroupName: 'Client',
      })
    );
  } catch (error) {
    console.error('post-confirmation: add to Client group failed', error);
  }

  try {
    const sub = event.request.userAttributes.sub;
    const email = event.request.userAttributes.email || '';
    const givenName = event.request.userAttributes.given_name || '';
    const familyName = event.request.userAttributes.family_name || '';

    if (!sub) {
      console.error('post-confirmation: missing sub in user attributes');
      return event;
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const trialEndsAt = new Date(now.getTime() + TRIAL_DURATION_MS).toISOString();

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
          trialStartedAt: nowIso,
          trialEndsAt,
          source: 'cognito',
          createdAt: nowIso,
        },
        ConditionExpression: 'attribute_not_exists(pk)',
      })
    );
  } catch (error: any) {
    if (error?.name !== 'ConditionalCheckFailedException') {
      console.error('post-confirmation: create profile failed', error);
    }
  }

  return event;
};
