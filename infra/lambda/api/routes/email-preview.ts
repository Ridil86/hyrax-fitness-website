/**
 * Admin Email Preview & Test Sending
 *
 * GET  /api/admin/email-preview?type=...  - Returns rendered HTML + subject for preview
 * POST /api/admin/email-preview           - Sends a test email via SES
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { isAdmin } from '../utils/auth';
import { sendEmail } from '../utils/email';
import { success, badRequest, forbidden, serverError } from '../utils/response';
import {
  verificationEmail,
  invitationEmail,
  welcomeEmail,
  forgotPasswordEmail,
  subscriptionConfirmationEmail,
  subscriptionChangeEmail,
  subscriptionCancelledEmail,
  paymentFailedEmail,
  supportReplyEmail,
  trialExpiringEmail,
  trialExpiredEmail,
} from '../../custom-message/templates';

const SITE_URL = 'https://hyraxfitness.com';

interface TemplateEntry {
  subject: string;
  render: () => string;
}

function getTemplates(): Record<string, TemplateEntry> {
  return {
    verification: {
      subject: 'Verify your Hyrax Fitness account',
      render: () =>
        verificationEmail()
          .replace(/\{####\}/g, '123456')
          .replace(/\{username\}/g, 'demo@hyraxfitness.com'),
    },
    invitation: {
      subject: "You're invited to Hyrax Fitness",
      render: () =>
        invitationEmail()
          .replace(/\{####\}/g, 'TmpPass!23')
          .replace(/\{username\}/g, 'demo@hyraxfitness.com'),
    },
    welcome: {
      subject: 'Welcome to Hyrax Fitness!',
      render: () =>
        welcomeEmail()
          .replace(/\{####\}/g, 'TmpPass!23')
          .replace(/\{username\}/g, 'demo@hyraxfitness.com'),
    },
    'forgot-password': {
      subject: 'Reset your Hyrax Fitness password',
      render: () =>
        forgotPasswordEmail()
          .replace(/\{####\}/g, '789012')
          .replace(/\{username\}/g, 'demo@hyraxfitness.com'),
    },
    'subscription-confirmation': {
      subject: 'Your subscription is active!',
      render: () => subscriptionConfirmationEmail('Rock Runner', '$5.00'),
    },
    'subscription-change': {
      subject: 'Your plan has been updated',
      render: () => subscriptionChangeEmail('Rock Runner', 'Iron Dassie', 'Immediately'),
    },
    'subscription-cancelled': {
      subject: 'Your subscription has been cancelled',
      render: () =>
        subscriptionCancelledEmail(
          'Rock Runner',
          new Date(Date.now() + 30 * 86400000).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })
        ),
    },
    'payment-failed': {
      subject: 'Payment failed',
      render: () => paymentFailedEmail('$5.00', `${SITE_URL}/portal/subscription`),
    },
    'support-reply': {
      subject: 'New reply on your support ticket',
      render: () =>
        supportReplyEmail(
          'Cannot access workout videos',
          'Thanks for reaching out! I have looked into this and it appears the issue was related to a temporary CDN cache. I have cleared the cache and your videos should now load correctly. Please let me know if you continue to experience any issues.'
        ),
    },
    'trial-expiring': {
      subject: 'Your free trial ends in 2 days',
      render: () => trialExpiringEmail(2, 'Demo User'),
    },
    'trial-expired': {
      subject: 'Your free trial has ended',
      render: () => trialExpiredEmail('Demo User'),
    },
  };
}

export async function getEmailPreview(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (!isAdmin(event)) return forbidden('Admin access required');

  const type = event.queryStringParameters?.type;
  if (!type) return badRequest('Missing "type" query parameter');

  const templates = getTemplates();
  const entry = templates[type];
  if (!entry) {
    return badRequest(
      `Invalid type "${type}". Valid types: ${Object.keys(templates).join(', ')}`
    );
  }

  return success({
    type,
    subject: entry.subject,
    html: entry.render(),
    availableTypes: Object.keys(templates),
  });
}

export async function sendTestEmail(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (!isAdmin(event)) return forbidden('Admin access required');

  try {
    const body = JSON.parse(event.body || '{}');
    const { type, recipientEmail } = body;

    if (!type) return badRequest('Missing "type" in request body');
    if (!recipientEmail || !recipientEmail.includes('@')) {
      return badRequest('Invalid or missing "recipientEmail"');
    }

    const templates = getTemplates();
    const entry = templates[type];
    if (!entry) {
      return badRequest(
        `Invalid type "${type}". Valid types: ${Object.keys(templates).join(', ')}`
      );
    }

    const subject = `[TEST] ${entry.subject}`;
    const html = entry.render();

    await sendEmail(recipientEmail, subject, html);

    return success({
      message: 'Test email sent successfully',
      recipientEmail,
      type,
      subject,
    });
  } catch (error: any) {
    console.error('sendTestEmail error:', error);

    // Provide helpful SES-specific error messages
    if (error.name === 'MessageRejected') {
      return badRequest(
        'Email rejected by SES. Ensure the sender identity is verified in SES.'
      );
    }
    if (error.name === 'MailFromDomainNotVerifiedException') {
      return badRequest(
        'The sender domain is not verified in SES. Verify hyraxfitness.com in the SES console.'
      );
    }
    if (error.message?.includes('Email address is not verified')) {
      return badRequest(
        'In SES sandbox mode, both sender and recipient must be verified. Verify the recipient email in the SES console.'
      );
    }

    return serverError('Failed to send test email');
  }
}
