import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Defense-in-depth for Lambda self-invocation. When the dispatcher detects
 * `event.__asyncRoutineGeneration` (or friends), it also verifies an HMAC
 * signature over the payload. This prevents an attacker who gains the ability
 * to invoke the Lambda from any other source (e.g. a future misconfigured
 * EventBridge rule) from triggering free AI generation on a victim's account.
 *
 * The secret is derived from STRIPE_WEBHOOK_SECRET (already present in
 * the Lambda environment) combined with a fixed salt so we don't need a new
 * deployed env var. The secret never leaves the Lambda.
 */
function secretKey(): Buffer {
  const base = process.env.ASYNC_INVOKE_SECRET
    || process.env.STRIPE_WEBHOOK_SECRET
    || 'hyrax-async-invoke-fallback';
  return Buffer.from(`hyrax:async:${base}`, 'utf-8');
}

export function signAsyncPayload(payload: Record<string, unknown>): string {
  const canonical = JSON.stringify(sortKeys(payload));
  return createHmac('sha256', secretKey()).update(canonical).digest('hex');
}

export function verifyAsyncPayload(
  payload: Record<string, unknown>,
  signature: string | undefined
): boolean {
  if (!signature || typeof signature !== 'string') return false;
  const expected = signAsyncPayload(payload);
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(signature, 'hex');
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function sortKeys(obj: any): any {
  if (Array.isArray(obj)) return obj.map(sortKeys);
  if (obj && typeof obj === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      if (key === '__asyncSignature') continue;
      sorted[key] = sortKeys(obj[key]);
    }
    return sorted;
  }
  return obj;
}
