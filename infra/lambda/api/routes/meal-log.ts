import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  QueryCommand,
  PutCommand,
  DeleteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, created, badRequest, forbidden, notFound, serverError } from '../utils/response';
import { extractClaims } from '../utils/auth';
import { randomUUID } from 'crypto';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.TABLE_NAME!;

/* ── Aggregate helpers ── */

async function updateMealAggregates(
  log: { userSub: string; calories?: number; macros?: any; completedAt?: string },
  delta: number
) {
  const date = (log.completedAt || new Date().toISOString()).slice(0, 10);
  const month = date.slice(0, 7);
  const cal = (log.calories || 0) * delta;
  const protein = parseFloat(log.macros?.protein) || 0;
  const carbs = parseFloat(log.macros?.carbs) || 0;
  const fat = parseFloat(log.macros?.fat) || 0;

  const updates = [
    // User daily
    client.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { pk: `USER#${log.userSub}`, sk: `MEAL_STATS#DAILY#${date}` },
      UpdateExpression: 'ADD #cnt :d, #cal :c, #p :p, #carb :carb, #f :f',
      ExpressionAttributeNames: { '#cnt': 'mealsLogged', '#cal': 'totalCalories', '#p': 'totalProtein', '#carb': 'totalCarbs', '#f': 'totalFat' },
      ExpressionAttributeValues: { ':d': delta, ':c': cal, ':p': protein * delta, ':carb': carbs * delta, ':f': fat * delta },
    })),
    // User monthly
    client.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { pk: `USER#${log.userSub}`, sk: `MEAL_STATS#MONTHLY#${month}` },
      UpdateExpression: 'ADD #cnt :d, #cal :c, #p :p, #carb :carb, #f :f',
      ExpressionAttributeNames: { '#cnt': 'mealsLogged', '#cal': 'totalCalories', '#p': 'totalProtein', '#carb': 'totalCarbs', '#f': 'totalFat' },
      ExpressionAttributeValues: { ':d': delta, ':c': cal, ':p': protein * delta, ':carb': carbs * delta, ':f': fat * delta },
    })),
  ];

  await Promise.allSettled(updates);
}

/* ── POST /api/meal-logs ── */

export async function createMealLog(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const claims = extractClaims(event);
  if (!claims?.sub) return forbidden('Authentication required');

  let body: any;
  try { body = JSON.parse(event.body || '{}'); } catch { return badRequest('Invalid JSON'); }

  const mealName = body.mealName || body.name || 'Meal';
  const now = new Date().toISOString();
  const id = randomUUID().slice(0, 12);

  const item: any = {
    pk: `USER#${claims.sub}`,
    sk: `MEAL_LOG#${now}#${id}`,
    gsi1pk: 'MEAL_LOG',
    gsi1sk: `${now}#${claims.sub}`,
    id,
    userSub: claims.sub,
    userEmail: claims.email || '',
    completedAt: now,
    source: body.source || 'plan',
    planDate: body.planDate || null,
    mealNumber: body.mealNumber ?? null,
    mealName,
    items: body.items || [],
    calories: body.calories || 0,
    macros: body.macros || null,
    modifications: body.modifications || null,
    skipped: body.skipped || false,
    notes: body.notes || '',
    rating: body.rating ?? null,
  };

  try {
    await client.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
    await updateMealAggregates(item, 1);
    return created(item);
  } catch (error) {
    console.error('createMealLog error:', error);
    return serverError('Failed to create meal log');
  }
}

/* ── POST /api/meal-logs/plan ── Batch log multiple meals from a plan */

export async function createMealPlanLog(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const claims = extractClaims(event);
  if (!claims?.sub) return forbidden('Authentication required');

  let body: any;
  try { body = JSON.parse(event.body || '{}'); } catch { return badRequest('Invalid JSON'); }

  const meals = body.meals;
  if (!Array.isArray(meals) || meals.length === 0) {
    return badRequest('meals array is required');
  }

  const now = new Date().toISOString();
  const results: any[] = [];

  try {
    for (const meal of meals) {
      const id = randomUUID().slice(0, 12);
      const mealName = meal.mealName || meal.name || `Meal ${meal.mealNumber || ''}`.trim();
      const item: any = {
        pk: `USER#${claims.sub}`,
        sk: `MEAL_LOG#${now}#${id}`,
        gsi1pk: 'MEAL_LOG',
        gsi1sk: `${now}#${claims.sub}`,
        id,
        userSub: claims.sub,
        userEmail: claims.email || '',
        completedAt: now,
        source: meal.source || 'plan',
        planDate: meal.planDate || body.planDate || null,
        mealNumber: meal.mealNumber ?? null,
        mealName,
        items: meal.items || [],
        calories: meal.calories || 0,
        macros: meal.macros || null,
        modifications: meal.modifications || null,
        skipped: meal.skipped || false,
        notes: meal.notes || '',
        rating: meal.rating ?? null,
      };

      await client.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
      await updateMealAggregates(item, 1);
      results.push(item);
    }

    return created({ logged: results.length, meals: results });
  } catch (error) {
    console.error('createMealPlanLog error:', error);
    return serverError('Failed to batch log meals');
  }
}

/* ── GET /api/meal-logs ── */

export async function listMealLogs(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const claims = extractClaims(event);
  if (!claims?.sub) return forbidden('Authentication required');

  const qs = event.queryStringParameters || {};
  const limit = Math.min(parseInt(qs.limit || '50', 10), 200);

  let skStart = 'MEAL_LOG#';
  let skEnd = 'MEAL_LOG$';

  // Filter by date
  if (qs.date) {
    const datePrefix = `MEAL_LOG#${qs.date}`;
    skStart = datePrefix;
    skEnd = datePrefix + '\uffff';
  } else if (qs.from || qs.to) {
    if (qs.from) skStart = `MEAL_LOG#${qs.from}`;
    if (qs.to) skEnd = `MEAL_LOG#${qs.to}\uffff`;
  }

  try {
    const result = await client.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk AND sk BETWEEN :start AND :end',
      ExpressionAttributeValues: {
        ':pk': `USER#${claims.sub}`,
        ':start': skStart,
        ':end': skEnd,
      },
      ScanIndexForward: false,
      Limit: limit,
    }));

    return success({ logs: result.Items || [] });
  } catch (error) {
    console.error('listMealLogs error:', error);
    return serverError('Failed to list meal logs');
  }
}

/* ── GET /api/meal-logs/stats ── */

export async function getMealLogStats(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const claims = extractClaims(event);
  if (!claims?.sub) return forbidden('Authentication required');

  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);

  try {
    const [dailyResult, monthlyResult] = await Promise.all([
      client.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
        ExpressionAttributeValues: {
          ':pk': `USER#${claims.sub}`,
          ':prefix': 'MEAL_STATS#DAILY#',
        },
        ScanIndexForward: false,
        Limit: 30,
      })),
      client.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk AND sk = :sk',
        ExpressionAttributeValues: {
          ':pk': `USER#${claims.sub}`,
          ':sk': `MEAL_STATS#MONTHLY#${month}`,
        },
      })),
    ]);

    const dailyItems = dailyResult.Items || [];
    const monthlyItem = monthlyResult.Items?.[0] || {};

    // Calculate streak
    let streak = 0;
    const sortedDays = dailyItems
      .map((d: any) => ({ date: d.sk.replace('MEAL_STATS#DAILY#', ''), count: d.mealsLogged || 0 }))
      .filter((d: any) => d.count > 0)
      .sort((a: any, b: any) => b.date.localeCompare(a.date));

    if (sortedDays.length > 0) {
      const checkDate = new Date(today + 'T12:00:00Z');
      for (const day of sortedDays) {
        const d = checkDate.toISOString().slice(0, 10);
        if (day.date === d) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
    }

    // Today's stats
    const todayStats = dailyItems.find((d: any) => d.sk === `MEAL_STATS#DAILY#${today}`) || {};

    return success({
      today: {
        mealsLogged: todayStats.mealsLogged || 0,
        totalCalories: todayStats.totalCalories || 0,
        totalProtein: todayStats.totalProtein || 0,
        totalCarbs: todayStats.totalCarbs || 0,
        totalFat: todayStats.totalFat || 0,
      },
      month: {
        mealsLogged: monthlyItem.mealsLogged || 0,
        totalCalories: monthlyItem.totalCalories || 0,
      },
      streak,
      totalDaysLogged: sortedDays.length,
    });
  } catch (error) {
    console.error('getMealLogStats error:', error);
    return serverError('Failed to get meal log stats');
  }
}

/* ── DELETE /api/meal-logs/{id} ── */

export async function deleteMealLog(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const claims = extractClaims(event);
  if (!claims?.sub) return forbidden('Authentication required');

  const logId = event.pathParameters?.id;
  if (!logId) return badRequest('Log ID required');

  try {
    // Find the log by scanning user's meal logs for this ID
    const result = await client.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
      FilterExpression: 'id = :id',
      ExpressionAttributeValues: {
        ':pk': `USER#${claims.sub}`,
        ':prefix': 'MEAL_LOG#',
        ':id': logId,
      },
    }));

    const item = result.Items?.[0];
    if (!item) return notFound('Meal log not found');

    await client.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { pk: item.pk, sk: item.sk },
    }));

    await updateMealAggregates(item as any, -1);

    return success({ deleted: true, id: logId });
  } catch (error) {
    console.error('deleteMealLog error:', error);
    return serverError('Failed to delete meal log');
  }
}
