/**
 * Branded HTML email templates for Hyrax Fitness Cognito emails.
 *
 * Cognito placeholders:
 *   {####}      -- verification / temporary-password code
 *   {username}  -- the user's username (email)
 *
 * All templates use inline CSS for maximum email-client compatibility.
 */

// ── Brand colours ──
const INK = '#1B120A';
const PAPER = '#FBF7E6';
const SAND = '#D3BF97';
const SUNSET = '#F28501';
const SUNRISE = '#FDB90F';
const EARTH = '#654C2B';

const LOGO_URL = 'https://hyraxfitness.com/img/hyrax-logo.svg';
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
          <td style="background:linear-gradient(135deg,${SUNSET},${SUNRISE});padding:28px 32px;text-align:center;">
            <img src="${LOGO_URL}" alt="Hyrax Fitness" width="140" style="display:inline-block;" />
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
            &copy; ${new Date().getFullYear()} Hyrax Fitness &mdash;
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

// ── Template: Forgot Password ──

export function forgotPasswordEmail(): string {
  return wrap(`
    <h2 style="margin:0 0 8px;font-size:20px;color:${INK};">Reset your password</h2>
    <p style="margin:0 0 4px;">We received a request to reset your Hyrax Fitness password. Enter the code below on the password-reset screen to choose a new password.</p>
    ${codeBlock('{####}')}
    <p style="margin:0;font-size:13px;color:${EARTH};">This code expires in 1 hour. If you did not request a password reset, you can safely ignore this email.</p>
  `);
}
