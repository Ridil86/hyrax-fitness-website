import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from 'aws-lambda';
import { listFaq, createFaq, updateFaq, deleteFaq, reorderFaq } from './routes/faq';
import { getContent, updateContent } from './routes/content';
import { listUsers, getUserGroups, updateUserGroups, deleteUser, setUserStatus } from './routes/users';
import { getUploadUrl } from './routes/upload';
import { getUserUploadUrl } from './routes/user-upload';
import { logAuditEvent, listAuditLogs, getAuditStats } from './routes/audit';
import { createAccount } from './routes/signup';
import { getProfile, createProfile, updateProfile, getFitnessProfile, updateFitnessProfile, getNutritionProfile, updateNutritionProfile, getAdminUserFitnessProfile } from './routes/profile';
import { listEquipment, getEquipment, createEquipment, updateEquipment, deleteEquipment } from './routes/equipment';
import { listExercises, getExercise, createExercise, updateExercise, deleteExercise } from './routes/exercises';
import { listWorkouts, getWorkout, createWorkout, updateWorkout, deleteWorkout } from './routes/workouts';
import { listVideos, getVideo, createVideo, updateVideo, deleteVideo } from './routes/videos';
import { listTiers, updateTier, updateComparisonFeatures } from './routes/tiers';
import { getStripeConfig, getSubscription, createCheckoutSession, createPortalSession, cancelSubscription } from './routes/stripe';
import { handleWebhook } from './routes/stripe-webhook';
import { listSubscriptions, listPayments, getUserPayments, getBillingStats } from './routes/billing';
import {
  listThreads, getThread, createThread, updateThread, deleteThread,
  createReply, updateReply, deleteReply,
  toggleReaction, createReport,
  getAdminQueue, moderateThread, resolveReport, togglePin, getCommunityStats,
} from './routes/community';
import {
  listTickets, createTicket, getTicket, updateTicket,
  addMessage, assignTicket, getSupportStats,
} from './routes/support';
import {
  createLog, createWorkoutLog, listUserLogs, getLogStats, getExerciseHistory, getCalendarData, deleteLog, getBenchmarkHistory,
} from './routes/completion-log';
import { getAnalyticsOverview, getAnalyticsTrends } from './routes/admin-analytics';
import {
  generateDailyWorkout, generateRoutineAsync, swapDailyWorkout, swapRoutineAsync,
  previewPrompts, getTodayWorkout, listWorkoutHistory, getWorkoutByDate, getAdminUserRoutines,
} from './routes/routine';
import { sendChatMessage, getChatHistory } from './routes/chat';
import {
  generateDailyNutrition, generateNutritionAsync,
  getTodayNutrition, listNutritionHistory, getNutritionByDate,
} from './routes/nutrition';
import {
  createMealLog, createMealPlanLog, listMealLogs, getMealLogStats, deleteMealLog,
} from './routes/meal-log';
import { notFound, serverError } from './utils/response';

export const handler = async (
  event: any,
  _context: Context
): Promise<APIGatewayProxyResult> => {
  // Handle async self-invocations (not from API Gateway)
  if (event.__asyncRoutineGeneration) {
    console.log('Async routine generation for', event.userSub);
    await generateRoutineAsync(event);
    return { statusCode: 200, headers: {}, body: 'ok' };
  }
  if (event.__asyncRoutineSwap) {
    console.log('Async routine swap for', event.userSub);
    await swapRoutineAsync(event);
    return { statusCode: 200, headers: {}, body: 'ok' };
  }
  if (event.__asyncNutritionGeneration) {
    console.log('Async nutrition generation for', event.userSub);
    await generateNutritionAsync(event);
    return { statusCode: 200, headers: {}, body: 'ok' };
  }

  const method = event.httpMethod;
  const path = event.path;

  console.log(`${method} ${path}`);

  // OPTIONS catch-all: return CORS headers for any preflight request
  if (method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      },
      body: '',
    };
  }

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

    // ── Profile Routes (authenticated) ──
    // Fitness sub-route must match BEFORE generic /api/profile
    if (path === '/api/profile/fitness') {
      if (method === 'GET') return getFitnessProfile(event);
      if (method === 'PUT') return updateFitnessProfile(event);
    }
    if (path === '/api/profile/nutrition') {
      if (method === 'GET') return getNutritionProfile(event);
      if (method === 'PUT') return updateNutritionProfile(event);
    }

    if (path === '/api/profile') {
      if (method === 'GET') return getProfile(event);
      if (method === 'POST') return createProfile(event);
      if (method === 'PUT') return updateProfile(event);
    }

    // ── Users Routes ──
    if (path === '/api/users' && method === 'GET') {
      return listUsers(event);
    }

    // /api/users/{username}/fitness-profile (admin-only)
    const userFitnessMatch = path.match(
      /^\/api\/users\/([^/]+)\/fitness-profile$/
    );
    if (userFitnessMatch && method === 'GET') {
      event.pathParameters = {
        ...event.pathParameters,
        username: userFitnessMatch[1],
      };
      return getAdminUserFitnessProfile(event);
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

    // ── Equipment Routes ──
    if (path === '/api/equipment') {
      if (method === 'GET') return listEquipment(event);
      if (method === 'POST') return createEquipment(event);
    }

    const equipmentMatch = path.match(/^\/api\/equipment\/([^/]+)$/);
    if (equipmentMatch) {
      event.pathParameters = { ...event.pathParameters, id: equipmentMatch[1] };
      if (method === 'GET') return getEquipment(event);
      if (method === 'PUT') return updateEquipment(event);
      if (method === 'DELETE') return deleteEquipment(event);
    }

    // ── Exercise Routes ──
    if (path === '/api/exercises') {
      if (method === 'GET') return listExercises(event);
      if (method === 'POST') return createExercise(event);
    }

    const exerciseMatch = path.match(/^\/api\/exercises\/([^/]+)$/);
    if (exerciseMatch) {
      event.pathParameters = { ...event.pathParameters, id: exerciseMatch[1] };
      if (method === 'GET') return getExercise(event);
      if (method === 'PUT') return updateExercise(event);
      if (method === 'DELETE') return deleteExercise(event);
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

    // ── Video Routes ──
    if (path === '/api/videos') {
      if (method === 'GET') return listVideos(event);
      if (method === 'POST') return createVideo(event);
    }

    const videoMatch = path.match(/^\/api\/videos\/([^/]+)$/);
    if (videoMatch) {
      event.pathParameters = { ...event.pathParameters, id: videoMatch[1] };
      if (method === 'GET') return getVideo(event);
      if (method === 'PUT') return updateVideo(event);
      if (method === 'DELETE') return deleteVideo(event);
    }

    // ── Upload Route ──
    if (path === '/api/upload' && method === 'POST') {
      return getUploadUrl(event);
    }

    if (path === '/api/user-upload' && method === 'POST') {
      return getUserUploadUrl(event);
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

    // ── Tier Routes ──
    if (path === '/api/tiers' && method === 'GET') {
      return listTiers();
    }

    // Comparison route must match before the generic tiers/{id} route
    if (path === '/api/tiers/comparison' && method === 'PUT') {
      return updateComparisonFeatures(event);
    }

    const tierMatch = path.match(/^\/api\/tiers\/([^/]+)$/);
    if (tierMatch) {
      event.pathParameters = { ...event.pathParameters, id: tierMatch[1] };
      if (method === 'PUT') return updateTier(event);
    }

    // ── Stripe Routes ──
    // Webhook must come first (public, no auth)
    if (path === '/api/stripe/webhook' && method === 'POST') {
      return handleWebhook(event);
    }

    if (path === '/api/stripe/config' && method === 'GET') {
      return getStripeConfig();
    }

    if (path === '/api/stripe/subscription' && method === 'GET') {
      return getSubscription(event);
    }

    if (path === '/api/stripe/create-checkout-session' && method === 'POST') {
      return createCheckoutSession(event);
    }

    if (path === '/api/stripe/create-portal-session' && method === 'POST') {
      return createPortalSession(event);
    }

    if (path === '/api/stripe/cancel-subscription' && method === 'POST') {
      return cancelSubscription(event);
    }

    // ── Admin Analytics Routes ──
    if (path === '/api/admin/analytics/overview' && method === 'GET') {
      return getAnalyticsOverview(event);
    }

    if (path === '/api/admin/analytics/trends' && method === 'GET') {
      return getAnalyticsTrends(event);
    }

    // ── Admin Billing Routes ──
    if (path === '/api/admin/billing/stats' && method === 'GET') {
      return getBillingStats(event);
    }

    if (path === '/api/admin/billing/subscriptions' && method === 'GET') {
      return listSubscriptions(event);
    }

    // /api/admin/billing/payments/{userSub}
    const userPaymentsMatch = path.match(/^\/api\/admin\/billing\/payments\/([^/]+)$/);
    if (userPaymentsMatch) {
      event.pathParameters = { ...event.pathParameters, userSub: userPaymentsMatch[1] };
      if (method === 'GET') return getUserPayments(event);
    }

    if (path === '/api/admin/billing/payments' && method === 'GET') {
      return listPayments(event);
    }

    // ── Community Routes ──
    // Admin routes must match before generic community routes
    if (path === '/api/community/admin/queue' && method === 'GET') {
      return getAdminQueue(event);
    }

    if (path === '/api/community/stats' && method === 'GET') {
      return getCommunityStats(event);
    }

    const communityModerateMatch = path.match(/^\/api\/community\/admin\/moderate\/([^/]+)$/);
    if (communityModerateMatch && method === 'PUT') {
      event.pathParameters = { ...event.pathParameters, id: communityModerateMatch[1] };
      return moderateThread(event);
    }

    const communityReportResolveMatch = path.match(/^\/api\/community\/admin\/reports\/([^/]+)$/);
    if (communityReportResolveMatch && method === 'PUT') {
      event.pathParameters = { ...event.pathParameters, id: communityReportResolveMatch[1] };
      return resolveReport(event);
    }

    const communityPinMatch = path.match(/^\/api\/community\/admin\/pin\/([^/]+)$/);
    if (communityPinMatch && method === 'PUT') {
      event.pathParameters = { ...event.pathParameters, id: communityPinMatch[1] };
      return togglePin(event);
    }

    if (path === '/api/community/reactions' && method === 'POST') {
      return toggleReaction(event);
    }

    if (path === '/api/community/reports' && method === 'POST') {
      return createReport(event);
    }

    // /api/community/replies/{id}
    const communityReplyMatch = path.match(/^\/api\/community\/replies\/([^/]+)$/);
    if (communityReplyMatch) {
      event.pathParameters = { ...event.pathParameters, id: communityReplyMatch[1] };
      if (method === 'PUT') return updateReply(event);
      if (method === 'DELETE') return deleteReply(event);
    }

    // /api/community/threads/{id}/replies
    const threadRepliesMatch = path.match(/^\/api\/community\/threads\/([^/]+)\/replies$/);
    if (threadRepliesMatch && method === 'POST') {
      event.pathParameters = { ...event.pathParameters, id: threadRepliesMatch[1] };
      return createReply(event);
    }

    // /api/community/threads
    if (path === '/api/community/threads') {
      if (method === 'GET') return listThreads(event);
      if (method === 'POST') return createThread(event);
    }

    // /api/community/threads/{id}
    const communityThreadMatch = path.match(/^\/api\/community\/threads\/([^/]+)$/);
    if (communityThreadMatch) {
      event.pathParameters = { ...event.pathParameters, id: communityThreadMatch[1] };
      if (method === 'GET') return getThread(event);
      if (method === 'PUT') return updateThread(event);
      if (method === 'DELETE') return deleteThread(event);
    }

    // ── Support Ticket Routes ──
    if (path === '/api/support/stats' && method === 'GET') {
      return getSupportStats(event);
    }

    const supportAssignMatch = path.match(/^\/api\/support\/admin\/assign\/([^/]+)$/);
    if (supportAssignMatch && method === 'PUT') {
      event.pathParameters = { ...event.pathParameters, id: supportAssignMatch[1] };
      return assignTicket(event);
    }

    // /api/support/tickets/{id}/messages
    const supportMsgMatch = path.match(/^\/api\/support\/tickets\/([^/]+)\/messages$/);
    if (supportMsgMatch && method === 'POST') {
      event.pathParameters = { ...event.pathParameters, id: supportMsgMatch[1] };
      return addMessage(event);
    }

    if (path === '/api/support/tickets') {
      if (method === 'GET') return listTickets(event);
      if (method === 'POST') return createTicket(event);
    }

    const supportTicketMatch = path.match(/^\/api\/support\/tickets\/([^/]+)$/);
    if (supportTicketMatch) {
      event.pathParameters = { ...event.pathParameters, id: supportTicketMatch[1] };
      if (method === 'GET') return getTicket(event);
      if (method === 'PUT') return updateTicket(event);
    }

    // ── Completion Log Routes ──
    if (path === '/api/logs/workout' && method === 'POST') {
      return createWorkoutLog(event);
    }

    if (path === '/api/logs/stats' && method === 'GET') {
      return getLogStats(event);
    }

    if (path === '/api/logs/benchmarks' && method === 'GET') {
      return getBenchmarkHistory(event);
    }
    if (path === '/api/logs/exercise-history' && method === 'GET') {
      return getExerciseHistory(event);
    }

    if (path === '/api/logs/calendar' && method === 'GET') {
      return getCalendarData(event);
    }

    if (path === '/api/logs') {
      if (method === 'GET') return listUserLogs(event);
      if (method === 'POST') return createLog(event);
    }

    const logMatch = path.match(/^\/api\/logs\/([^/]+)$/);
    if (logMatch) {
      event.pathParameters = { ...event.pathParameters, id: logMatch[1] };
      if (method === 'DELETE') return deleteLog(event);
    }

    // ── AI Chat Routes (Iron Dassie only) ──
    if (path === '/api/chat/history' && method === 'GET') {
      return getChatHistory(event);
    }
    if (path === '/api/chat' && method === 'POST') {
      return sendChatMessage(event);
    }

    // ── Admin User Routines (before generic routine routes) ──
    const adminUserRoutinesMatch = path.match(/^\/api\/admin\/users\/([^/]+)\/routines$/);
    if (adminUserRoutinesMatch && method === 'GET') {
      event.pathParameters = { ...event.pathParameters, username: adminUserRoutinesMatch[1] };
      return getAdminUserRoutines(event);
    }

    // ── AI Routine Routes (authenticated) ──
    if (path === '/api/routine/generate' && method === 'POST') {
      return generateDailyWorkout(event);
    }
    if (path === '/api/routine/swap' && method === 'POST') {
      return swapDailyWorkout(event);
    }
    if (path === '/api/routine/preview' && method === 'POST') {
      return previewPrompts(event);
    }
    if (path === '/api/routine/today' && method === 'GET') {
      return getTodayWorkout(event);
    }
    if (path === '/api/routine/history' && method === 'GET') {
      return listWorkoutHistory(event);
    }

    const routineDateMatch = path.match(/^\/api\/routine\/([^/]+)$/);
    if (routineDateMatch) {
      event.pathParameters = { ...event.pathParameters, date: routineDateMatch[1] };
      if (method === 'GET') return getWorkoutByDate(event);
    }

    // ── AI Nutrition Routes (authenticated, Iron Dassie only) ──
    if (path === '/api/nutrition/generate' && method === 'POST') {
      return generateDailyNutrition(event);
    }
    if (path === '/api/nutrition/today' && method === 'GET') {
      return getTodayNutrition(event);
    }
    if (path === '/api/nutrition/history' && method === 'GET') {
      return listNutritionHistory(event);
    }
    const nutritionDateMatch = path.match(/^\/api\/nutrition\/([^/]+)$/);
    if (nutritionDateMatch) {
      event.pathParameters = { ...event.pathParameters, date: nutritionDateMatch[1] };
      if (method === 'GET') return getNutritionByDate(event);
    }

    // ── Meal Logging Routes (authenticated) ──
    if (path === '/api/meal-logs/plan' && method === 'POST') {
      return createMealPlanLog(event);
    }
    if (path === '/api/meal-logs/stats' && method === 'GET') {
      return getMealLogStats(event);
    }
    if (path === '/api/meal-logs' && method === 'GET') {
      return listMealLogs(event);
    }
    if (path === '/api/meal-logs' && method === 'POST') {
      return createMealLog(event);
    }
    const mealLogIdMatch = path.match(/^\/api\/meal-logs\/([^/]+)$/);
    if (mealLogIdMatch && method === 'DELETE') {
      event.pathParameters = { ...event.pathParameters, id: mealLogIdMatch[1] };
      return deleteMealLog(event);
    }

    return notFound(`No route found for ${method} ${path}`);
  } catch (error) {
    console.error('Unhandled error:', error);
    return serverError('Internal server error');
  }
};
