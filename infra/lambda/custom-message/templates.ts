/**
 * Branded HTML email templates for Hyrax Fitness.
 *
 * Cognito placeholders (auth emails only):
 *   {####}      -- verification / temporary-password code
 *   {username}  -- the user's username (email)
 *
 * Transactional templates accept parameters directly.
 * All templates use inline CSS for maximum email-client compatibility.
 */

// ── Brand colours ──
const INK = '#1B120A';
const PAPER = '#FBF7E6';
const SAND = '#D3BF97';
const SUNSET = '#F28501';
const SUNRISE = '#FDB90F';
const EARTH = '#654C2B';

const LOGO_URL = 'https://hyraxfitness.com/img/hyrax-fitness-logo-512x512.png';
const SITE_URL = 'https://hyraxfitness.com';

// ── Shared wrapper ──

function wrap(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${PAPER};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 10px 28px rgba(27,18,10,.12);">
        <!-- Header gradient -->
        <tr>
          <td style="background:linear-gradient(135deg,${SUNSET},${SUNRISE});padding:24px 32px;text-align:center;">
            <img src="${LOGO_URL}" alt="Hyrax Fitness" style="display:block;width:100%;max-width:456px;height:auto;margin:0 auto;" />
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px 32px 24px;color:${INK};font-size:15px;line-height:1.6;">
            ${body}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;background:${PAPER};border-top:1px solid ${SAND};text-align:center;font-size:12px;color:${EARTH};">
            &copy; ${new Date().getFullYear()} Hyrax Fitness |
            <a href="${SITE_URL}" style="color:${SUNSET};text-decoration:none;">hyraxfitness.com</a>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Code block (shared) ──

function codeBlock(code: string): string {
  return `<div style="margin:24px 0;text-align:center;">
  <div style="display:inline-block;padding:14px 32px;background:${PAPER};border:2px solid ${SAND};border-radius:12px;font-size:28px;font-weight:700;letter-spacing:.15em;color:${INK};font-family:'Courier New',monospace;">
    ${code}
  </div>
</div>`;
}

// ── Template: Verification Code (sign-up + resend) ──

export function verificationEmail(): string {
  return wrap(`
    <h2 style="margin:0 0 8px;font-size:20px;color:${INK};">Verify your email</h2>
    <p style="margin:0 0 4px;">Welcome to Hyrax Fitness! Enter the code below to verify your email address and complete your registration.</p>
    ${codeBlock('{####}')}
    <p style="margin:0;font-size:13px;color:${EARTH};">This code expires in 24 hours. If you did not create an account, you can safely ignore this email.</p>
  `);
}

// ── Template: Admin-Created User Invitation ──

export function invitationEmail(): string {
  return wrap(`
    <h2 style="margin:0 0 8px;font-size:20px;color:${INK};">You're invited to Hyrax Fitness</h2>
    <p style="margin:0 0 4px;">An administrator has created an account for you. Use the temporary password below to sign in for the first time. You will be prompted to set a new password.</p>
    <p style="margin:12px 0 4px;font-size:13px;color:${EARTH};">Username: <strong>{username}</strong></p>
    ${codeBlock('{####}')}
    <p style="margin:0 0 16px;">
      <a href="${SITE_URL}/login" style="display:inline-block;padding:12px 28px;background:${SUNSET};color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;">Sign In</a>
    </p>
    <p style="margin:0;font-size:13px;color:${EARTH};">If you did not expect this invitation, you can safely ignore this email.</p>
  `);
}

// ── Template: Intake Wizard Welcome Email (magic link) ──

export function welcomeEmail(): string {
  return wrap(`
    <h2 style="margin:0 0 8px;font-size:20px;color:${INK};">Welcome to the colony!</h2>
    <p style="margin:0 0 16px;">Your Hyrax Fitness account has been created. You're one step away from getting started with your training journey.</p>

    <p style="margin:0 0 20px;text-align:center;">
      <a href="${SITE_URL}/welcome?email={username}&amp;code={####}" style="display:inline-block;padding:14px 32px;background:${SUNSET};color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;font-size:16px;">Finish Setting Up Your Account</a>
    </p>

    <div style="margin:20px 0;padding:16px 20px;background:${PAPER};border-radius:12px;border:1px solid ${SAND};">
      <p style="margin:0 0 10px;font-weight:600;font-size:14px;color:${INK};">You can now access:</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:13px;color:${EARTH};line-height:1.8;">
        <tr><td style="padding-right:8px;">&#9670;</td><td><strong>Training Modules</strong>: Scramble, Haul, Sprint, Recover</td></tr>
        <tr><td style="padding-right:8px;">&#9670;</td><td><strong>Signature Workouts</strong> designed for any fitness level</td></tr>
        <tr><td style="padding-right:8px;">&#9670;</td><td><strong>Free Workout Videos</strong> with professional trainers</td></tr>
        <tr><td style="padding-right:8px;">&#9670;</td><td><strong>Downloadable Workouts</strong> you can print and take with you.</td></tr>
        <tr><td style="padding-right:8px;">&#9670;</td><td><strong>Community Acces</strong> to stay updated</td></tr>
      </table>
      <br>
      <p style="margin:0 0 10px;font-weight:600;font-size:14px;color:${INK};">Upgrade to receive:</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:13px;color:${EARTH};line-height:1.8;">
        <tr><td style="padding-right:8px;">&#9670;</td><td><strong>Customized Workouts</strong> designed just for you!</td></tr>
        <tr><td style="padding-right:8px;">&#9670;</td><td><strong>Nutrition Plans</strong> tailored to your needs.</td></tr>
        <tr><td style="padding-right:8px;">&#9670;</td><td><strong>Progress Tracking</strong> to measure your improvement over time</td></tr>
        <tr><td style="padding-right:8px;">&#9670;</td><td><strong>And Much More!</strong></td></tr>
      </table>
    </div>

    <p style="margin:0;font-size:13px;color:${EARTH};">This link expires in 7 days. If you did not create an account, you can safely ignore this email.</p>
  `);
}

// ── Template: Forgot Password ──

export function forgotPasswordEmail(): string {
  return wrap(`
    <h2 style="margin:0 0 8px;font-size:20px;color:${INK};">Reset your password</h2>
    <p style="margin:0 0 4px;">We received a request to reset your Hyrax Fitness password. Enter the code below on the password-reset screen to choose a new password.</p>
    ${codeBlock('{####}')}
    <p style="margin:0;font-size:13px;color:${EARTH};">This code expires in 1 hour. If you did not request a password reset, you can safely ignore this email.</p>
  `);
}

// ═══════════════════════════════════════════════════════════════
//  Transactional Email Templates (sent via SES, not Cognito)
// ═══════════════════════════════════════════════════════════════

// ── Template: Subscription Confirmation ──

export function subscriptionConfirmationEmail(
  tierName: string,
  amount: string
): string {
  return wrap(`
    <h2 style="margin:0 0 8px;font-size:20px;color:${INK};">Your subscription is active!</h2>
    <p style="margin:0 0 16px;">Welcome to the <strong>${tierName}</strong> plan. Your subscription has been confirmed and you now have access to all ${tierName} features.</p>

    <div style="margin:20px 0;padding:16px 20px;background:${PAPER};border-radius:12px;border:1px solid ${SAND};text-align:center;">
      <p style="margin:0 0 4px;font-size:13px;color:${EARTH};">Monthly plan</p>
      <p style="margin:0;font-size:28px;font-weight:700;color:${INK};">${amount}/mo</p>
      <p style="margin:8px 0 0;font-size:13px;color:${EARTH};">${tierName} Tier</p>
    </div>

    <p style="margin:0 0 16px;text-align:center;">
      <a href="${SITE_URL}/portal" style="display:inline-block;padding:12px 28px;background:${SUNSET};color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;">Go to Your Portal</a>
    </p>

    <p style="margin:0;font-size:13px;color:${EARTH};">You can manage your subscription anytime from the Subscription page in your portal.</p>
  `);
}

// ── Template: Subscription Change (upgrade/downgrade) ──

export function subscriptionChangeEmail(
  oldTier: string,
  newTier: string,
  effectiveDate: string
): string {
  return wrap(`
    <h2 style="margin:0 0 8px;font-size:20px;color:${INK};">Your plan has been updated</h2>
    <p style="margin:0 0 16px;">Your subscription has been changed from <strong>${oldTier}</strong> to <strong>${newTier}</strong>.</p>

    <div style="margin:20px 0;padding:16px 20px;background:${PAPER};border-radius:12px;border:1px solid ${SAND};">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="font-size:14px;color:${INK};">
        <tr>
          <td style="padding:8px 0;color:${EARTH};">Previous plan:</td>
          <td style="padding:8px 0;text-align:right;font-weight:600;">${oldTier}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;border-top:1px solid ${SAND};color:${EARTH};">New plan:</td>
          <td style="padding:8px 0;border-top:1px solid ${SAND};text-align:right;font-weight:600;">${newTier}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;border-top:1px solid ${SAND};color:${EARTH};">Effective:</td>
          <td style="padding:8px 0;border-top:1px solid ${SAND};text-align:right;font-weight:600;">${effectiveDate}</td>
        </tr>
      </table>
    </div>

    <p style="margin:0 0 16px;text-align:center;">
      <a href="${SITE_URL}/portal/subscription" style="display:inline-block;padding:12px 28px;background:${SUNSET};color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;">View Subscription</a>
    </p>

    <p style="margin:0;font-size:13px;color:${EARTH};">If you did not make this change, please contact support immediately.</p>
  `);
}

// ── Template: Subscription Cancelled ──

export function subscriptionCancelledEmail(
  tierName: string,
  accessUntil: string
): string {
  return wrap(`
    <h2 style="margin:0 0 8px;font-size:20px;color:${INK};">Your subscription has been cancelled</h2>
    <p style="margin:0 0 16px;">Your <strong>${tierName}</strong> subscription has been cancelled. We're sorry to see you go!</p>

    <div style="margin:20px 0;padding:16px 20px;background:${PAPER};border-radius:12px;border:1px solid ${SAND};text-align:center;">
      <p style="margin:0 0 4px;font-size:13px;color:${EARTH};">You'll retain ${tierName} access until</p>
      <p style="margin:0;font-size:20px;font-weight:700;color:${INK};">${accessUntil}</p>
    </div>

    <p style="margin:0 0 16px;">After that, your account will revert to the free <strong>Pup</strong> tier. You can resubscribe at any time to regain access to premium features.</p>

    <p style="margin:0 0 16px;text-align:center;">
      <a href="${SITE_URL}/portal/subscription" style="display:inline-block;padding:12px 28px;background:${SUNSET};color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;">Resubscribe</a>
    </p>

    <p style="margin:0;font-size:13px;color:${EARTH};">You'll continue to have access to all free features on the Pup tier.</p>
  `);
}

// ── Template: Payment Failed ──

export function paymentFailedEmail(
  amount: string,
  updateUrl: string
): string {
  return wrap(`
    <h2 style="margin:0 0 8px;font-size:20px;color:${INK};">Payment failed</h2>
    <p style="margin:0 0 16px;">We were unable to process your payment of <strong>${amount}</strong>. Please update your payment method to keep your subscription active.</p>

    <div style="margin:20px 0;padding:16px 20px;background:#FFF5F5;border-radius:12px;border:1px solid #E8CCCC;text-align:center;">
      <p style="margin:0;font-size:14px;color:#8B0000;font-weight:600;">Action required: Update your payment method</p>
      <p style="margin:8px 0 0;font-size:13px;color:${EARTH};">Your subscription may be cancelled if payment is not resolved.</p>
    </div>

    <p style="margin:16px 0;text-align:center;">
      <a href="${updateUrl}" style="display:inline-block;padding:12px 28px;background:${SUNSET};color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;">Update Payment Method</a>
    </p>

    <p style="margin:0;font-size:13px;color:${EARTH};">If you believe this is an error, please contact your bank or reach out to our support team.</p>
  `);
}

// ── Template: Support Ticket Reply ──

export function supportReplyEmail(
  ticketTitle: string,
  replyPreview: string
): string {
  return wrap(`
    <h2 style="margin:0 0 8px;font-size:20px;color:${INK};">New reply on your support ticket</h2>
    <p style="margin:0 0 16px;">Your support ticket has received a reply from the Hyrax Fitness team.</p>

    <div style="margin:20px 0;padding:16px 20px;background:${PAPER};border-radius:12px;border:1px solid ${SAND};">
      <p style="margin:0 0 8px;font-size:13px;color:${EARTH};">Ticket:</p>
      <p style="margin:0 0 12px;font-weight:600;color:${INK};">${ticketTitle}</p>
      <p style="margin:0 0 8px;font-size:13px;color:${EARTH};">Reply:</p>
      <p style="margin:0;color:${INK};font-style:italic;">"${replyPreview}${replyPreview.length >= 200 ? '...' : ''}"</p>
    </div>

    <p style="margin:16px 0;text-align:center;">
      <a href="${SITE_URL}/portal/support" style="display:inline-block;padding:12px 28px;background:${SUNSET};color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;">View Full Reply</a>
    </p>

    <p style="margin:0;font-size:13px;color:${EARTH};">You can reply directly from your support portal.</p>
  `);
}

// ── Template: Trial Expiring Soon ──

export function trialExpiringEmail(
  daysLeft: number,
  userName: string
): string {
  return wrap(`
    <h2 style="margin:0 0 8px;font-size:20px;color:${INK};">Your free trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}</h2>
    <p style="margin:0 0 16px;">Hi ${userName}! Your Hyrax Fitness free trial is almost over. Don't lose access to your personalized workouts, nutrition plans, and coaching.</p>

    <div style="margin:20px 0;padding:16px 20px;background:${PAPER};border-radius:12px;border:1px solid ${SAND};">
      <p style="margin:0 0 10px;font-weight:600;font-size:14px;color:${INK};">What you'll keep with a subscription:</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:13px;color:${EARTH};line-height:1.8;">
        <tr><td style="padding-right:8px;">&#9670;</td><td><strong>Custom Routines</strong> tailored to your fitness level</td></tr>
        <tr><td style="padding-right:8px;">&#9670;</td><td><strong>Personalized Nutrition Plans</strong> for your goals</td></tr>
        <tr><td style="padding-right:8px;">&#9670;</td><td><strong>Personal Coach</strong> for guidance and motivation</td></tr>
        <tr><td style="padding-right:8px;">&#9670;</td><td><strong>Progress Tracking</strong> and benchmarks</td></tr>
      </table>
    </div>

    <p style="margin:0 0 16px;text-align:center;">
      <a href="${SITE_URL}/portal/subscription" style="display:inline-block;padding:14px 32px;background:${SUNSET};color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;font-size:16px;">Choose a Plan</a>
    </p>

    <p style="margin:0;font-size:13px;color:${EARTH};">Plans start at just $5/month. You can also continue with the free Pup tier after your trial ends.</p>
  `);
}

// ── Template: Trial Expired ──

// ── Template: Merch Order Confirmation ──

export interface MerchItem {
  name: string;
  variant?: string;
  quantity: number;
  price?: string;
}

export function merchOrderConfirmationEmail(
  orderNumber: string,
  items: MerchItem[],
  totalAmount: string
): string {
  const itemRows = items.map(item => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid ${SAND};color:${INK};font-size:14px;">
        <strong>${item.name}</strong>${item.variant ? `<br><span style="font-size:12px;color:${EARTH};">${item.variant}</span>` : ''}
      </td>
      <td style="padding:10px 0;border-bottom:1px solid ${SAND};text-align:center;color:${INK};font-size:14px;">${item.quantity}</td>
      <td style="padding:10px 0;border-bottom:1px solid ${SAND};text-align:right;color:${INK};font-size:14px;font-weight:600;">${item.price || ''}</td>
    </tr>
  `).join('');

  return wrap(`
    <h2 style="margin:0 0 8px;font-size:20px;color:${INK};">Order confirmed!</h2>
    <p style="margin:0 0 16px;">Thanks for your purchase! Your order <strong>#${orderNumber}</strong> has been received and is being prepared.</p>

    <div style="margin:20px 0;padding:16px 20px;background:${PAPER};border-radius:12px;border:1px solid ${SAND};">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="font-size:13px;">
        <tr>
          <td style="padding:0 0 8px;color:${EARTH};font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Item</td>
          <td style="padding:0 0 8px;text-align:center;color:${EARTH};font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Qty</td>
          <td style="padding:0 0 8px;text-align:right;color:${EARTH};font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Price</td>
        </tr>
        ${itemRows}
        <tr>
          <td colspan="2" style="padding:12px 0 0;text-align:right;font-weight:700;font-size:15px;color:${INK};">Total:</td>
          <td style="padding:12px 0 0;text-align:right;font-weight:700;font-size:15px;color:${INK};">${totalAmount}</td>
        </tr>
      </table>
    </div>

    <p style="margin:0 0 16px;text-align:center;">
      <a href="${SITE_URL}/merch" style="display:inline-block;padding:12px 28px;background:${SUNSET};color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;">Continue Shopping</a>
    </p>

    <p style="margin:0;font-size:13px;color:${EARTH};">You'll receive a shipping confirmation email with tracking info once your order is on its way.</p>
  `);
}

// ── Template: Merch Shipping Notification ──

export function merchShippingNotificationEmail(
  orderNumber: string,
  trackingNumber: string,
  trackingUrl: string,
  items: MerchItem[]
): string {
  const itemList = items.map(item => `
    <tr><td style="padding:4px 8px 4px 0;font-size:13px;color:${INK};">&#9670; ${item.name}${item.variant ? ` (${item.variant})` : ''}</td><td style="padding:4px 0;font-size:13px;color:${EARTH};text-align:right;">x${item.quantity}</td></tr>
  `).join('');

  return wrap(`
    <h2 style="margin:0 0 8px;font-size:20px;color:${INK};">Your order has shipped!</h2>
    <p style="margin:0 0 16px;">Great news! Order <strong>#${orderNumber}</strong> is on its way to you.</p>

    <div style="margin:20px 0;padding:16px 20px;background:${PAPER};border-radius:12px;border:1px solid ${SAND};text-align:center;">
      <p style="margin:0 0 4px;font-size:12px;color:${EARTH};text-transform:uppercase;letter-spacing:0.05em;">Tracking Number</p>
      <p style="margin:0 0 16px;font-size:16px;font-weight:700;color:${INK};font-family:'Courier New',monospace;">${trackingNumber}</p>
      <a href="${trackingUrl}" style="display:inline-block;padding:12px 28px;background:${SUNSET};color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;">Track Your Order</a>
    </div>

    <div style="margin:20px 0;">
      <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:${EARTH};">Items in this shipment:</p>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
        ${itemList}
      </table>
    </div>

    <p style="margin:0;font-size:13px;color:${EARTH};">Delivery times vary by location. If you have questions about your shipment, you can track it using the link above.</p>
  `);
}

// ── Template: Trial Expired ──

export function trialExpiredEmail(userName: string): string {
  return wrap(`
    <h2 style="margin:0 0 8px;font-size:20px;color:${INK};">Your free trial has ended</h2>
    <p style="margin:0 0 16px;">Hi ${userName}, your 7-day Hyrax Fitness free trial has come to an end. Your account has been moved to the free <strong>Pup</strong> tier.</p>

    <div style="margin:20px 0;padding:16px 20px;background:${PAPER};border-radius:12px;border:1px solid ${SAND};">
      <p style="margin:0 0 10px;font-weight:600;font-size:14px;color:${INK};">You still have access to:</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:13px;color:${EARTH};line-height:1.8;">
        <tr><td style="padding-right:8px;">&#9670;</td><td>Signature Workouts and Training Modules</td></tr>
        <tr><td style="padding-right:8px;">&#9670;</td><td>Free Workout Videos</td></tr>
        <tr><td style="padding-right:8px;">&#9670;</td><td>Community Forum</td></tr>
      </table>
      <br>
      <p style="margin:0 0 10px;font-weight:600;font-size:14px;color:${INK};">Subscribe to regain access to:</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:13px;color:${EARTH};line-height:1.8;">
        <tr><td style="padding-right:8px;">&#9670;</td><td>Custom Routines and Nutrition Plans</td></tr>
        <tr><td style="padding-right:8px;">&#9670;</td><td>Personal Coach</td></tr>
        <tr><td style="padding-right:8px;">&#9670;</td><td>Progress Tracking and Benchmarks</td></tr>
      </table>
    </div>

    <p style="margin:0 0 16px;text-align:center;">
      <a href="${SITE_URL}/portal/subscription" style="display:inline-block;padding:14px 32px;background:${SUNSET};color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;font-size:16px;">Subscribe Now</a>
    </p>

    <p style="margin:0;font-size:13px;color:${EARTH};">Plans start at just $5/month. Upgrade anytime from your portal.</p>
  `);
}
