const FW_BASE = 'https://storefront-api.fourthwall.com/v1';
const FW_TOKEN = import.meta.env.VITE_FOURTHWALL_TOKEN;
const CHECKOUT_DOMAIN = 'shop.hyraxfitness.com';

function buildUrl(path, extraParams = {}) {
  const url = new URL(`${FW_BASE}${path}`);
  url.searchParams.set('storefront_token', FW_TOKEN);
  Object.entries(extraParams).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  });
  return url.toString();
}

async function fwGet(path, params) {
  const res = await fetch(buildUrl(path, params));
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Fourthwall API error: ${res.status}`);
  }
  return res.json();
}

async function fwPost(path, body, params) {
  const res = await fetch(buildUrl(path, params), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Fourthwall API error: ${res.status}`);
  }
  return res.json();
}

export function fetchProducts(page = 0, size = 50) {
  return fwGet('/collections/all/products', { page, size, currency: 'USD' });
}

export function fetchProduct(slug) {
  return fwGet(`/products/${encodeURIComponent(slug)}`, { currency: 'USD' });
}

export function createCart() {
  return fwPost('/carts', { currency: 'USD' });
}

export function addToCart(cartId, variantId, quantity = 1) {
  return fwPost(`/carts/${cartId}/items`, { variantId, quantity });
}

export function getCart(cartId) {
  return fwGet(`/carts/${cartId}`);
}

export function updateCartQuantity(cartId, items) {
  return fwPost(`/carts/${cartId}/change`, { items });
}

export function getCheckoutUrl(cartId) {
  return `https://${CHECKOUT_DOMAIN}/checkout/?cartCurrency=USD&cartId=${cartId}`;
}
