import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
  AdminLinkProviderForUserCommand,
  AdminAddUserToGroupCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import type { PreSignUpTriggerEvent } from 'aws-lambda';

const client = new CognitoIdentityProviderClient({});

/**
 * Pre Sign-up Lambda Trigger
 *
 * Handles two scenarios:
 *
 * 1. Google user signs in (PreSignUp_ExternalProvider):
 *    - If a native (email/password) user exists with the same email,
 *      link the Google identity to the existing user so they share one account.
 *    - If no native user exists, allow the sign-up and add to Client group.
 *
 * 2. Native sign-up (PreSignUp_AdminCreateUser or PreSignUp_SignUp):
 *    - If a Google-federated user already exists with the same email,
 *      reject the sign-up with a clear error message.
 */
export const handler = async (
  event: PreSignUpTriggerEvent
): Promise<PreSignUpTriggerEvent> => {
  const { triggerSource, userPoolId, userName } = event;
  const email = event.request.userAttributes.email;

  if (!email) {
    return event;
  }

  // ── Google federated sign-in ──
  if (triggerSource === 'PreSignUp_ExternalProvider') {
    try {
      // Find existing users with this email
      const existing = await client.send(
        new ListUsersCommand({
          UserPoolId: userPoolId,
          Filter: `email = "${email}"`,
          Limit: 10,
        })
      );

      // Look for a native (non-federated) user with this email
      const nativeUser = existing.Users?.find(
        (u) =>
          u.UserStatus !== 'EXTERNAL_PROVIDER' &&
          !u.Username?.startsWith('Google_') &&
          !u.Username?.startsWith('google_')
      );

      if (nativeUser && nativeUser.Username) {
        // Link the Google identity to the existing native user
        // Extract the Google sub from the userName (format: "Google_<sub>")
        const providerSub = userName.includes('_')
          ? userName.split('_').slice(1).join('_')
          : userName;

        await client.send(
          new AdminLinkProviderForUserCommand({
            UserPoolId: userPoolId,
            DestinationUser: {
              ProviderName: 'Cognito',
              ProviderAttributeValue: nativeUser.Username,
            },
            SourceUser: {
              ProviderName: 'Google',
              ProviderAttributeName: 'Cognito_Subject',
              ProviderAttributeValue: providerSub,
            },
          })
        );

        console.log(
          `Linked Google identity ${userName} to existing user ${nativeUser.Username}`
        );
      } else {
        // No native user exists — new Google-only user
        // Add them to the Client group after confirmation
        // (We also do this after sign-up completes, but set flags here)
        console.log(`New Google user: ${userName} (${email})`);

        // Try to add to Client group now (the user record is being created)
        try {
          await client.send(
            new AdminAddUserToGroupCommand({
              UserPoolId: userPoolId,
              Username: userName,
              GroupName: 'Client',
            })
          );
        } catch {
          // User might not be fully created yet; Post-Confirmation will handle it
          console.log('Could not add to Client group in pre-signup, will retry in post-confirmation');
        }
      }

      // Auto-confirm and auto-verify the external provider user
      event.response.autoConfirmUser = true;
      event.response.autoVerifyEmail = true;
    } catch (error) {
      console.error('Pre-signup external provider error:', error);
      // Don't block sign-in on unexpected errors — let it through
      event.response.autoConfirmUser = true;
      event.response.autoVerifyEmail = true;
    }

    return event;
  }

  // ── Native sign-up (AdminCreateUser or self-signup) ──
  if (
    triggerSource === 'PreSignUp_AdminCreateUser' ||
    triggerSource === 'PreSignUp_SignUp'
  ) {
    try {
      const existing = await client.send(
        new ListUsersCommand({
          UserPoolId: userPoolId,
          Filter: `email = "${email}"`,
          Limit: 10,
        })
      );

      // Check if a Google-federated user with this email already exists
      const federatedUser = existing.Users?.find(
        (u) =>
          u.UserStatus === 'EXTERNAL_PROVIDER' ||
          u.Username?.startsWith('Google_') ||
          u.Username?.startsWith('google_')
      );

      if (federatedUser) {
        throw new Error(
          'An account with this email already exists via Google. Please sign in with Google instead.'
        );
      }
    } catch (error: any) {
      // Re-throw our custom error; swallow unexpected errors
      if (error.message?.includes('already exists via Google')) {
        throw error;
      }
      console.error('Pre-signup native check error:', error);
    }
  }

  return event;
};
