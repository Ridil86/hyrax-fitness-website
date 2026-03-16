import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from 'aws-lambda';
import { listFaq, createFaq, updateFaq, deleteFaq, reorderFaq } from './routes/faq';
import { getContent, updateContent } from './routes/content';
import { listUsers, getUserGroups, updateUserGroups } from './routes/users';
import { getUploadUrl } from './routes/upload';
import { notFound, serverError } from './utils/response';

export const handler = async (
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> => {
  const method = event.httpMethod;
  const path = event.path;

  console.log(`${method} ${path}`);

  try {
    // ── FAQ Routes ──
    if (path === '/api/faq') {
      if (method === 'GET') return listFaq();
      if (method === 'POST') return createFaq(event);
    }

    if (path === '/api/faq/reorder' && method === 'PUT') {
      return reorderFaq(event);
    }

    // /api/faq/{id}
    const faqMatch = path.match(/^\/api\/faq\/([^/]+)$/);
    if (faqMatch) {
      event.pathParameters = { ...event.pathParameters, id: faqMatch[1] };
      if (method === 'PUT') return updateFaq(event);
      if (method === 'DELETE') return deleteFaq(event);
    }

    // ── Content Routes ──
    // /api/content/{section}
    const contentMatch = path.match(/^\/api\/content\/([^/]+)$/);
    if (contentMatch) {
      event.pathParameters = {
        ...event.pathParameters,
        section: contentMatch[1],
      };
      if (method === 'GET') return getContent(event);
      if (method === 'PUT') return updateContent(event);
    }

    // ── Users Routes ──
    if (path === '/api/users' && method === 'GET') {
      return listUsers(event);
    }

    // /api/users/{username}/groups
    const userGroupsMatch = path.match(
      /^\/api\/users\/([^/]+)\/groups$/
    );
    if (userGroupsMatch) {
      event.pathParameters = {
        ...event.pathParameters,
        username: userGroupsMatch[1],
      };
      if (method === 'GET') return getUserGroups(event);
      if (method === 'PUT') return updateUserGroups(event);
    }

    // ── Upload Route ──
    if (path === '/api/upload' && method === 'POST') {
      return getUploadUrl(event);
    }

    return notFound(`No route found for ${method} ${path}`);
  } catch (error) {
    console.error('Unhandled error:', error);
    return serverError('Internal server error');
  }
};
