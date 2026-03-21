import { apiGet, apiPost } from './client';

/**
 * Send a message to the AI Coach (Iron Dassie only).
 * @param {string} token - Cognito ID token
 * @param {string} message - User's message
 */
export function sendChatMessage(token, message) {
  return apiPost('/api/chat', { message }, token);
}

/**
 * Fetch today's chat history (Iron Dassie only).
 * @param {string} token - Cognito ID token
 */
export function fetchChatHistory(token) {
  return apiGet('/api/chat/history', token);
}
