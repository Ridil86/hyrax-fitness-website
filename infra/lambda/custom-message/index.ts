import type { CustomMessageTriggerEvent } from 'aws-lambda';
import {
  verificationEmail,
  invitationEmail,
  welcomeEmail,
  forgotPasswordEmail,
} from './templates';

export const handler = async (
  event: CustomMessageTriggerEvent
): Promise<CustomMessageTriggerEvent> => {
  console.log('CustomMessage trigger:', event.triggerSource);

  switch (event.triggerSource) {
    // ── Self-service sign-up verification ──
    case 'CustomMessage_SignUp':
    case 'CustomMessage_ResendCode':
      event.response.emailSubject = 'Verify your Hyrax Fitness account';
      event.response.emailMessage = verificationEmail();
      break;

    // ── Admin-created user (intake wizard or admin invitation) ──
    case 'CustomMessage_AdminCreateUser':
      if (event.request.clientMetadata?.source === 'intake') {
        // Intake wizard welcome email with magic link
        event.response.emailSubject = 'Welcome to Hyrax Fitness!';
        event.response.emailMessage = welcomeEmail();
      } else {
        // Admin-created invitation
        event.response.emailSubject =
          "You're invited to Hyrax Fitness";
        event.response.emailMessage = invitationEmail();
      }
      break;

    // ── Forgot password ──
    case 'CustomMessage_ForgotPassword':
      event.response.emailSubject =
        'Reset your Hyrax Fitness password';
      event.response.emailMessage = forgotPasswordEmail();
      break;

    default:
      // Other trigger sources (e.g. CustomMessage_VerifyUserAttribute)
      // fall through with Cognito defaults
      break;
  }

  return event;
};
