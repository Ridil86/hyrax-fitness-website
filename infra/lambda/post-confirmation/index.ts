import {
  CognitoIdentityProviderClient,
  AdminAddUserToGroupCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import type { PostConfirmationTriggerEvent } from 'aws-lambda';

const client = new CognitoIdentityProviderClient({});

export const handler = async (
  event: PostConfirmationTriggerEvent
): Promise<PostConfirmationTriggerEvent> => {
  // Only run on actual user sign-up confirmation (not admin-created users)
  if (event.triggerSource === 'PostConfirmation_ConfirmSignUp') {
    try {
      await client.send(
        new AdminAddUserToGroupCommand({
          UserPoolId: event.userPoolId,
          Username: event.userName,
          GroupName: 'Client',
        })
      );
      console.log(`Added user ${event.userName} to Client group`);
    } catch (error) {
      console.error('Error adding user to Client group:', error);
      // Don't throw - let the user sign up even if group assignment fails
    }
  }

  return event;
};
