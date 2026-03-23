import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.TABLE_NAME!;

function daysAgoISO(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString();
}

/** Load all exercises from DynamoDB */
export async function loadExercises(): Promise<any[]> {
  const result = await client.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: { ':pk': 'EXERCISE' },
  }));
  return result.Items || [];
}

/** Load all published workouts from DynamoDB */
export async function loadWorkouts(): Promise<any[]> {
  const result = await client.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'pk = :pk',
    FilterExpression: '#s = :pub',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':pk': 'WORKOUT', ':pub': 'published' },
  }));
  return result.Items || [];
}

/** Load all equipment from DynamoDB */
export async function loadEquipment(): Promise<any[]> {
  const result = await client.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: { ':pk': 'EQUIPMENT' },
  }));
  return result.Items || [];
}

/** Load user's completion logs from last N days */
export async function loadUserCompletionLogs(userSub: string, days: number = 14): Promise<any[]> {
  const from = daysAgoISO(days);
  const result = await client.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'pk = :pk AND sk BETWEEN :from AND :to',
    ExpressionAttributeValues: {
      ':pk': `USER#${userSub}`,
      ':from': `LOG#${from}`,
      ':to': `LOG#${new Date().toISOString()}~`,
    },
    ScanIndexForward: false,
  }));
  return result.Items || [];
}

/** Load user's meal logs from last N days */
export async function loadUserMealLogs(userSub: string, days: number = 7): Promise<any[]> {
  const from = daysAgoISO(days);
  const result = await client.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'pk = :pk AND sk BETWEEN :from AND :to',
    ExpressionAttributeValues: {
      ':pk': `USER#${userSub}`,
      ':from': `MEAL_LOG#${from}`,
      ':to': `MEAL_LOG#${new Date().toISOString()}~`,
    },
    ScanIndexForward: false,
  }));
  return result.Items || [];
}

/** Load user's recent AI-generated workouts (last N) */
export async function loadRecentDailyWorkouts(userSub: string, limit: number = 7): Promise<any[]> {
  const result = await client.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
    ExpressionAttributeValues: {
      ':pk': `USER#${userSub}`,
      ':prefix': 'DAILY_WORKOUT#',
    },
    ScanIndexForward: false,
    Limit: limit,
  }));
  return result.Items || [];
}

/** Load user's recent AI-generated nutrition plans (last N) */
export async function loadRecentNutritionPlans(userSub: string, limit: number = 7): Promise<any[]> {
  const result = await client.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
    ExpressionAttributeValues: {
      ':pk': `USER#${userSub}`,
      ':prefix': 'DAILY_NUTRITION#',
    },
    ScanIndexForward: false,
    Limit: limit,
  }));
  return result.Items || [];
}

/** Load user profile (fitness + nutrition) */
export async function loadUserProfile(userSub: string): Promise<any> {
  const result = await client.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { pk: `USER#${userSub}`, sk: 'PROFILE' },
  }));
  return result.Item || null;
}

/** Load today's workout for a user */
export async function loadTodayWorkout(userSub: string, today: string): Promise<any> {
  const result = await client.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { pk: `USER#${userSub}`, sk: `DAILY_WORKOUT#${today}` },
  }));
  return result.Item || null;
}

/** Load today's nutrition plan for a user */
export async function loadTodayNutrition(userSub: string, today: string): Promise<any> {
  const result = await client.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { pk: `USER#${userSub}`, sk: `DAILY_NUTRITION#${today}` },
  }));
  return result.Item || null;
}

/**
 * Build a condensed exercise catalog string for system prompts.
 * Includes name, description, tags, and modifications per difficulty level.
 */
export function buildExerciseCatalogText(exercises: any[]): string {
  if (!exercises.length) return 'No exercises available.';
  return exercises.map((ex) => {
    let text = `- ${ex.name}: ${ex.description || ''}`;
    if (ex.tags?.length) text += ` [tags: ${ex.tags.join(', ')}]`;
    if (ex.modifications) {
      const mods = Object.entries(ex.modifications)
        .map(([level, mod]: [string, any]) => {
          let m = `${level}: ${mod.subName || ''}`;
          if (mod.equipment?.length) m += ` (equip: ${mod.equipment.map((e: any) => e.equipmentName).join(', ')})`;
          return m;
        })
        .join('; ');
      if (mods) text += ` | Modifications: ${mods}`;
    }
    return text;
  }).join('\n');
}

/**
 * Build a condensed workout catalog string for system prompts.
 */
export function buildWorkoutCatalogText(workouts: any[]): string {
  if (!workouts.length) return 'No workouts available.';
  return workouts.map((w) => {
    let text = `- ${w.title}: ${w.category || ''}, ${w.duration || ''} min`;
    if (w.exercises?.length) text += `, ${w.exercises.length} exercises`;
    return text;
  }).join('\n');
}

/**
 * Build a condensed equipment catalog string for system prompts.
 */
export function buildEquipmentCatalogText(equipment: any[]): string {
  if (!equipment.length) return 'No equipment listed.';
  return equipment.map((e) => `- ${e.name}: ${e.description || ''}`).join('\n');
}

/**
 * Format completion logs into a readable summary for prompts.
 */
export function formatCompletionLogsSummary(logs: any[], days: number = 14): string {
  if (!logs.length) return 'No workout completions in the last ' + days + ' days.';
  const byDate: Record<string, any[]> = {};
  for (const log of logs) {
    const date = (log.completedAt || '').slice(0, 10);
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(log);
  }
  return Object.entries(byDate)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 14)
    .map(([date, entries]) => {
      const exList = entries.map((e) => {
        let s = e.exerciseName || 'Unknown';
        if (e.sets) s += ` ${e.sets}x${e.reps || '?'}`;
        if (e.weight) s += ` @${e.weight}${e.weightUnit || 'lb'}`;
        if (e.rpe) s += ` RPE:${e.rpe}`;
        return s;
      }).join(', ');
      return `${date}: ${exList}`;
    }).join('\n');
}

/**
 * Format meal logs into a readable summary for prompts.
 */
export function formatMealLogsSummary(logs: any[], days: number = 7): string {
  if (!logs.length) return 'No meal logs in the last ' + days + ' days.';
  const byDate: Record<string, any[]> = {};
  for (const log of logs) {
    const date = log.planDate || (log.completedAt || '').slice(0, 10);
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(log);
  }
  return Object.entries(byDate)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 7)
    .map(([date, entries]) => {
      const meals = entries.map((m) => {
        let s = m.mealName || 'Meal';
        if (m.calories) s += ` (${m.calories} cal)`;
        if (m.source === 'adhoc') s += ' [unplanned]';
        if (m.modifications) s += ` [modified: ${m.modifications}]`;
        if (m.skipped) s += ' [SKIPPED]';
        if (m.rating) s += ` rating:${m.rating}/5`;
        return s;
      }).join(', ');
      return `${date}: ${meals}`;
    }).join('\n');
}
