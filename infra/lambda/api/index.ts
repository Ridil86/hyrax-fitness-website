import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from 'aws-lambda';
import { listFaq, createFaq, updateFaq, deleteFaq, reorderFaq } from './routes/faq';
import { getContent, updateContent } from './routes/content';
import { listUsers, getUserGroups, updateUserGroups, deleteUser, setUserStatus } from './routes/users';
import { getUploadUrl } from './routes/upload';
import { logAuditEvent, listAuditLogs, getAuditStats } from './routes/audit';
import { createAccount } from './routes/signup';
import { getProfile, createProfile, updateProfile } from './routes/profile';
import { listWorkouts, getWorkout, createWorkout, updateWorkout, deleteWorkout } from './routes/workouts';
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

    // ── Signup Route (public) ──
    if (path === '/api/signup' && method === 'POST') {
      return createAccount(event);
    }

    // ── Profile Route (authenticated) ──
    if (path === '/api/profile') {
      if (method === 'GET') return getProfile(event);
      if (method === 'POST') return createProfile(event);
      if (method === 'PUT') return updateProfile(event);
    }

    // ── Users Routes ──
    if (path === '/api/users' && method === 'GET') {
      return listUsers(event);
    }

    // /api/users/{username}/status
    const userStatusMatch = path.match(
      /^\/api\/users\/([^/]+)\/status$/
    );
    if (userStatusMatch) {
      event.pathParameters = {
        ...event.pathParameters,
        username: userStatusMatch[1],
      };
      if (method === 'PUT') return setUserStatus(event);
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

    // /api/users/{username} DELETE
    const userDeleteMatch = path.match(/^\/api\/users\/([^/]+)$/);
    if (userDeleteMatch && method === 'DELETE') {
      event.pathParameters = {
        ...event.pathParameters,
        username: userDeleteMatch[1],
      };
      return deleteUser(event);
    }

    // ── Workout Routes ──
    if (path === '/api/workouts') {
      if (method === 'GET') return listWorkouts(event);
      if (method === 'POST') return createWorkout(event);
    }

    // /api/workouts/{id}
    const workoutMatch = path.match(/^\/api\/workouts\/([^/]+)$/);
    if (workoutMatch) {
      event.pathParameters = { ...event.pathParameters, id: workoutMatch[1] };
      if (method === 'GET') return getWorkout(event);
      if (method === 'PUT') return updateWorkout(event);
      if (method === 'DELETE') return deleteWorkout(event);
    }

    // ── Upload Route ──
    if (path === '/api/upload' && method === 'POST') {
      return getUploadUrl(event);
    }

    // ── Audit Routes ──
    // Stats must match before the general /api/audit path
    if (path === '/api/audit/stats' && method === 'GET') {
      return getAuditStats(event);
    }

    if (path === '/api/audit') {
      if (method === 'POST') return logAuditEvent(event);
      if (method === 'GET') return listAuditLogs(event);
    }

    return notFound(`No route found for ${method} ${path}`);
  } catch (error) {
    console.error('Unhandled error:', error);
    return serverError('Internal server error');
  }
};
