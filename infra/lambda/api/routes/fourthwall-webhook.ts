/**
 * Fourthwall Webhook Handler
 *
 * Receives ORDER_PLACED and ORDER_UPDATED events from Fourthwall,
 * verifies HMAC-SHA256 signature, and sends branded email notifications.
 *
 * PUBLIC endpoint (no Cognito auth) — signature verified in handler.
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import * as crypto from 'crypto';
import { sendEmail } from '../utils/email';
import {
  merchOrderConfirmationEmail,
  merchShippingNotificationEmail,
  type MerchItem,
} from '../../custom-message/templates';
import { success, badRequest } from '../utils/response';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
};

// ── Signature verification ──

function verifySignature(rawBody: string, headerSignature: string): boolean {
  const secret = process.env.FOURTHWALL_WEBHOOK_SECRET;
  if (!secret) {
    console.error('FOURTHWALL_WEBHOOK_SECRET not configured');
    return false;
  }

  try {
    const digest = crypto
      .createHmac('sha256', secret)
      .update(rawBody, 'utf-8')
      .digest('base64');

    return crypto.timingSafeEqual(
      Buffer.from(digest, 'utf-8'),
      Buffer.from(headerSignature, 'utf-8')
    );
  } catch (err) {
    console.error('Signature verification error:', err);
    return false;
  }
}

// ── Helpers for extracting order data ──

function formatCurrency(amount: number | undefined, currency = 'USD'): string {
  if (amount === undefined || amount === null) return '';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

function extractItems(order: any): MerchItem[] {
  const items: MerchItem[] = [];
  const lineItems = order?.items || order?.lineItems || order?.line_items || [];
  for (const item of lineItems) {
    items.push({
      name: item.productName || item.product_name || item.name || 'Product',
      variant: item.variantName || item.variant_name || item.variant || undefined,
      quantity: item.quantity || 1,
      price: item.unitPrice
        ? formatCurrency(item.unitPrice.value || item.unitPrice, item.unitPrice.currency)
        : item.price ? formatCurrency(item.price.value || item.price, item.price.currency) : undefined,
    });
  }
  return items;
}

function extractEmail(payload: any): string | null {
  return (
    payload?.email ||
    payload?.customer?.email ||
    payload?.order?.email ||
    payload?.order?.customer?.email ||
    payload?.data?.email ||
    payload?.data?.customer?.email ||
    null
  );
}

function extractOrderNumber(payload: any): string {
  return (
    payload?.orderNumber ||
    payload?.order_number ||
    payload?.order?.orderNumber ||
    payload?.order?.order_number ||
    payload?.data?.orderNumber ||
    payload?.id ||
    payload?.order?.id ||
    payload?.data?.id ||
    'N/A'
  );
}

function extractTotalAmount(payload: any): string {
  const total =
    payload?.total ||
    payload?.order?.total ||
    payload?.data?.total ||
    payload?.totalPrice ||
    payload?.order?.totalPrice;
  if (total?.value !== undefined) return formatCurrency(total.value, total.currency);
  if (typeof total === 'number') return formatCurrency(total);
  return '';
}

function extractTrackingInfo(payload: any): { number: string; url: string } | null {
  // Check various locations Fourthwall might put tracking info
  const fulfillment =
    payload?.fulfillment ||
    payload?.order?.fulfillment ||
    payload?.data?.fulfillment ||
    payload?.fulfillments?.[0] ||
    payload?.order?.fulfillments?.[0] ||
    payload?.data?.fulfillments?.[0];

  const tracking =
    fulfillment?.tracking ||
    fulfillment?.trackingInfo ||
    fulfillment?.tracking_info;

  const trackingNumber =
    tracking?.number ||
    tracking?.trackingNumber ||
    tracking?.tracking_number ||
    fulfillment?.trackingNumber ||
    fulfillment?.tracking_number ||
    payload?.trackingNumber ||
    payload?.tracking_number;

  const trackingUrl =
    tracking?.url ||
    tracking?.trackingUrl ||
    tracking?.tracking_url ||
    fulfillment?.trackingUrl ||
    fulfillment?.tracking_url ||
    payload?.trackingUrl ||
    payload?.tracking_url;

  if (trackingNumber) {
    return {
      number: String(trackingNumber),
      url: trackingUrl || `https://www.google.com/search?q=${encodeURIComponent(trackingNumber)}`,
    };
  }
  return null;
}

// ── Event handlers ──

async function handleOrderPlaced(payload: any): Promise<void> {
  const email = extractEmail(payload);
  if (!email) {
    console.warn('ORDER_PLACED: No customer email found, skipping notification');
    return;
  }

  const orderNumber = extractOrderNumber(payload);
  const orderData = payload?.order || payload?.data || payload;
  const items = extractItems(orderData);
  const totalAmount = extractTotalAmount(payload);

  console.log(`ORDER_PLACED: Order #${orderNumber}, ${items.length} items, email: ${email}`);

  const subject = 'Your Hyrax Fitness order is confirmed';
  const html = merchOrderConfirmationEmail(orderNumber, items, totalAmount);

  try {
    await sendEmail(email, subject, html);
    console.log(`ORDER_PLACED: Confirmation email sent to ${email}`);
  } catch (err) {
    console.error(`ORDER_PLACED: Failed to send email to ${email}:`, err);
  }
}

async function handleOrderUpdated(payload: any): Promise<void> {
  const email = extractEmail(payload);
  if (!email) {
    console.warn('ORDER_UPDATED: No customer email found, skipping notification');
    return;
  }

  // Only send shipping notification if tracking info is present
  const tracking = extractTrackingInfo(payload);
  if (!tracking) {
    console.log('ORDER_UPDATED: No tracking info present, skipping shipping notification');
    return;
  }

  const orderNumber = extractOrderNumber(payload);
  const orderData = payload?.order || payload?.data || payload;
  const items = extractItems(orderData);

  console.log(`ORDER_UPDATED: Order #${orderNumber} shipped, tracking: ${tracking.number}, email: ${email}`);

  const subject = 'Your Hyrax Fitness order has shipped';
  const html = merchShippingNotificationEmail(orderNumber, tracking.number, tracking.url, items);

  try {
    await sendEmail(email, subject, html);
    console.log(`ORDER_UPDATED: Shipping notification sent to ${email}`);
  } catch (err) {
    console.error(`ORDER_UPDATED: Failed to send email to ${email}:`, err);
  }
}

// ── Main webhook handler ──

export async function handleFourthwallWebhook(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  // Extract raw body (handle base64 encoding from API Gateway)
  let rawBody: string;
  if (event.isBase64Encoded && event.body) {
    rawBody = Buffer.from(event.body, 'base64').toString('utf-8');
  } else {
    rawBody = event.body || '';
  }

  // Verify HMAC-SHA256 signature
  const signature =
    event.headers['X-Fourthwall-Hmac-SHA256'] ||
    event.headers['x-fourthwall-hmac-sha256'] ||
    '';

  if (!signature) {
    console.error('Fourthwall webhook: Missing signature header');
    return {
      statusCode: 401,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Missing signature' }),
    };
  }

  if (!verifySignature(rawBody, signature)) {
    console.error('Fourthwall webhook: Invalid signature');
    return {
      statusCode: 401,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Invalid signature' }),
    };
  }

  // Parse payload
  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    console.error('Fourthwall webhook: Invalid JSON body');
    return badRequest('Invalid JSON');
  }

  const eventType = payload?.type || payload?.event || payload?.eventType || '';
  console.log(`Fourthwall webhook: ${eventType}`);

  // Route to handler — respond quickly (Fourthwall requires <2s)
  try {
    switch (eventType) {
      case 'ORDER_PLACED':
        await handleOrderPlaced(payload);
        break;
      case 'ORDER_UPDATED':
        await handleOrderUpdated(payload);
        break;
      default:
        console.log(`Fourthwall webhook: Unhandled event type "${eventType}"`);
    }
  } catch (err) {
    // Log but still return 200 to prevent retries for handler errors
    console.error(`Fourthwall webhook handler error for ${eventType}:`, err);
  }

  return success({ received: true });
}
