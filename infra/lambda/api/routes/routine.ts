import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  PutCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, badRequest, forbidden, notFound, serverError } from '../utils/response';
import { extractClaims, isAdmin } from '../utils/auth';
import { invokeClaude } from '../utils/bedrock';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const lambdaClient = new LambdaClient({});
const TABLE_NAME = process.env.TABLE_NAME!;
const SELF_FUNCTION_NAME = process.env.SELF_FUNCTION_NAME || 'hyrax-api';

// ── Tier access check (server-side, no frontend dependency) ──
const TIER_RANK: Record<string, number> = { 'Pup': 1, 'Rock Runner': 2, 'Iron Dassie': 3 };
function hasTierAccess(userTier: string, requiredTier: string): boolean {
  return (TIER_RANK[userTier] || 0) >= (TIER_RANK[requiredTier] || 0);
}

// ── Date helpers ──
function todayStr(event?: APIGatewayProxyEvent): string {
  // Prefer client-provided local date to avoid UTC mismatch
  if (event) {
    // Check query string param
    const qsDate = event.queryStringParameters?.date;
    if (qsDate && /^\d{4}-\d{2}-\d{2}$/.test(qsDate)) return qsDate;
    // Check request body
    try {
      const body = event.body ? JSON.parse(event.body) : {};
      if (body.clientDate && /^\d{4}-\d{2}-\d{2}$/.test(body.clientDate)) return body.clientDate;
    } catch { /* ignore parse errors */ }
  }
  return new Date().toISOString().slice(0, 10); // fallback to UTC
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function dayOfWeekName(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long' });
}

function formatDateLong(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00Z').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

// ── Prompt builders ──

function buildSystemPrompt(
  exercises: any[],
  workouts: any[],
  equipment: any[]
): string {
  const lines: string[] = [];

  lines.push(`You are the Hyrax Fitness digital training assistant. You create personalized daily workouts using ONLY the Hyrax Fitness exercise library and workout templates provided below.`);
  lines.push('');
  lines.push(`## Training Philosophy`);
  lines.push(`The Hyrax training system is inspired by the rock hyrax, an animal that thrives in rugged terrain through explosive movement, endurance, and community. Every workout follows the Forage-Bask cycle: high-effort training bouts (Forage) followed by structured cooldown and recovery (Bask). Workouts emphasize functional, compound movements with progressive overload.`);
  lines.push('');

  lines.push(`## Rules`);
  lines.push(`1. Use ONLY exercises from the Exercise Catalog below. Never invent exercises.`);
  lines.push(`2. Select the exercise modification level matching the user's experience level. If they lack the required equipment for that level, drop DOWN to the nearest level they can perform.`);
  lines.push(`3. Ensure proper muscle group rotation: examine the user's recent workout history and avoid programming the same primary movement pattern (tags) on consecutive days.`);
  lines.push(`4. Include a warm-up section (3-5 min dynamic movement) at the start of every training day.`);
  lines.push(`5. Include a Bask (cooldown) section (3-5 min stretching + breathing) at the end of every training day.`);
  lines.push(`6. Avoid exercises that contraindicate the user's stated injuries or limitations.`);
  lines.push(`7. Respect the user's preferred session duration, training environment, and available equipment.`);
  lines.push(`8. If the user has trained intensely for 3+ consecutive days (based on history), suggest a rest day or active recovery.`);
  lines.push(`9. Use the workout templates as structural inspiration (round format, AMRAP, intervals, etc.) but adapt exercises and volume to the individual user.`);
  lines.push(`10. Respond ONLY with valid JSON matching the schema below. No explanation text outside the JSON.`);
  lines.push(`11. For premium (Iron Dassie) tier users, include a brief nutrition timing suggestion in coachingNotes (e.g., pre-workout fueling, post-workout protein window, hydration tips).`);
  lines.push(`12. NEVER use em-dashes (--), unicode dashes, or emojis in any text field. Use commas, periods, or semicolons instead.`);
  lines.push(`13. Be concise in all text fields. Warm-up and Bask descriptions: 1-2 short sentences max (under 120 characters). Modification descriptions: 1 sentence. Coaching notes: 2-3 sentences max. Exercise notes: 1 short sentence. Avoid filler words and motivational fluff.`);
  lines.push('');

  // Exercise catalog
  lines.push(`## Exercise Catalog`);
  for (const ex of exercises) {
    lines.push(`### ${ex.name} (ID: ${ex.id})`);
    lines.push(`Description: ${ex.description || 'N/A'}`);
    lines.push(`Tags: ${(ex.tags || []).join(', ') || 'none'}`);
    const mods = ex.modifications || {};
    for (const level of ['beginner', 'intermediate', 'advanced', 'elite']) {
      const mod = mods[level];
      if (mod) {
        const eqStr = (mod.equipment || []).map((e: any) => e.equipmentName).join(', ') || 'bodyweight';
        lines.push(`- ${level}: "${mod.subName || 'Standard'}" - ${mod.description || 'N/A'} | Equipment: ${eqStr}`);
      }
    }
    lines.push('');
  }

  // Workout templates
  lines.push(`## Workout Templates (for structural reference)`);
  for (const w of workouts) {
    lines.push(`### ${w.title} (ID: ${w.id})`);
    lines.push(`Category: ${w.category} | Duration: ${w.duration} | Exercises: ${(w.exercises || []).length}`);
    if (w.notes) {
      // Truncate long notes to save tokens
      const notesShort = w.notes.length > 300 ? w.notes.slice(0, 300) + '...' : w.notes;
      lines.push(`Structure: ${notesShort}`);
    }
    lines.push('');
  }

  // Equipment catalog
  lines.push(`## Equipment Catalog`);
  for (const eq of equipment) {
    lines.push(`- ${eq.name} (ID: ${eq.id}): ${eq.description || 'N/A'}`);
  }
  lines.push('');

  // JSON response schema
  lines.push(`## Response JSON Schema`);
  lines.push(`Respond with exactly this JSON structure:`);
  lines.push('```json');
  lines.push(JSON.stringify({
    dailyWorkout: {
      date: 'YYYY-MM-DD',
      type: 'training | rest | active_recovery',
      title: 'A short descriptive title for this workout',
      duration: 'e.g. 25 min',
      focus: ['movement-pattern-tags'],
      workoutTemplateId: 'template-id-or-null',
      warmUp: { duration: '5 min', description: 'Dynamic warm-up instructions' },
      exercises: [{
        exerciseId: 'exercise-id',
        exerciseName: 'Exercise Name',
        modificationLevel: 'beginner|intermediate|advanced|elite',
        modificationName: 'Modification display name',
        modificationDescription: 'How to perform this modification',
        sets: '4',
        reps: '10',
        rest: '60s',
        duration: '',
        notes: 'Coaching note or progression tip',
        equipment: [{ equipmentId: 'id', equipmentName: 'Name' }],
      }],
      bask: { duration: '5 min', description: 'Cooldown and stretching instructions' },
      coachingNotes: 'Why this workout was chosen and what to focus on',
      progressionContext: 'How this builds on the users recent training',
      nextDayHint: 'Brief suggestion for tomorrow',
    },
  }, null, 2));
  lines.push('```');

  return lines.join('\n');
}

function buildUserPrompt(
  fitnessProfile: any,
  recentLogs: any[],
  recentDailyWorkouts: any[],
  exercises: any[],
  today: string,
  userTier?: string
): string {
  const lines: string[] = [];

  // Build exercise tag lookup
  const exTagMap: Record<string, string[]> = {};
  const exNameMap: Record<string, string> = {};
  for (const ex of exercises) {
    exTagMap[ex.id] = ex.tags || [];
    exNameMap[ex.id] = ex.name || ex.id;
  }

  lines.push(`Generate today's personalized workout for this user.`);
  lines.push('');

  // User profile
  lines.push(`## User Profile`);
  lines.push(`Experience Level: ${fitnessProfile.experienceLevel || 'intermediate'}`);
  lines.push(`Goals: ${(fitnessProfile.fitnessGoals || []).join(', ') || 'general fitness'}`);
  lines.push(`Preferred Duration: ${fitnessProfile.preferredDuration || '30'} minutes`);
  lines.push(`Preferred Intensity: ${(fitnessProfile.preferredIntensity || 'moderate').replace(/_/g, ' ')}`);
  lines.push(`Training Environment: ${(fitnessProfile.trainingEnvironment || []).join(', ') || 'any'}`);

  // Map equipment IDs to names from the fitness profile
  const equipNames = (fitnessProfile.availableEquipment || []).join(', ');
  lines.push(`Available Equipment: ${equipNames || 'bodyweight only'}`);

  lines.push(`Indoor/Outdoor Preference: ${(fitnessProfile.indoorOutdoorPreference || 'both').replace(/_/g, ' ')}`);

  if (fitnessProfile.location?.region) {
    lines.push(`Location: ${fitnessProfile.location.region}${fitnessProfile.location.climate ? ` (${fitnessProfile.location.climate.replace(/_/g, ' ')})` : ''}`);
  }

  lines.push(`Preferred Time: ${(fitnessProfile.preferredTimeOfDay || 'any').replace(/_/g, ' ')}`);
  lines.push(`Days Per Week Target: ${fitnessProfile.daysPerWeek || 3}`);
  lines.push(`Rest Day Preference: ${(fitnessProfile.restDayPreference || 'flexible').replace(/_/g, ' ')}`);
  lines.push(`Focus Areas: ${(fitnessProfile.focusAreas || []).join(', ') || 'full body'}`);

  const limitations = (fitnessProfile.limitations || []).filter((l: string) => l !== 'none');
  lines.push(`Injuries/Limitations: ${limitations.length > 0 ? limitations.map((l: string) => l.replace(/_/g, ' ')).join(', ') : 'None'}`);
  if (fitnessProfile.injuries) {
    lines.push(`Injury Details: ${fitnessProfile.injuries}`);
  }
  if (fitnessProfile.age) {
    lines.push(`Age: ${fitnessProfile.age}`);
  }
  if (userTier) {
    lines.push(`Subscription Tier: ${userTier}${userTier === 'Iron Dassie' ? ' (premium - include nutrition timing tips)' : ''}`);
  }
  lines.push('');

  // Today's context
  lines.push(`## Today's Context`);
  lines.push(`Date: ${formatDateLong(today)}`);
  lines.push(`Day of Week: ${dayOfWeekName(today)}`);

  // Seasonal context
  const month = new Date(today + 'T12:00:00Z').getMonth(); // 0-11
  const seasons = ['Winter', 'Winter', 'Spring', 'Spring', 'Spring', 'Summer', 'Summer', 'Summer', 'Fall', 'Fall', 'Fall', 'Winter'];
  const season = seasons[month];
  const climate = fitnessProfile.location?.climate;
  const hasOutdoorSpace = fitnessProfile.hasOutdoorSpace;
  lines.push(`Season: ${season}`);
  if (climate) {
    lines.push(`Climate: ${climate.replace(/_/g, ' ')}`);
    if (climate === 'hot_humid' || climate === 'hot_dry') {
      lines.push(`Note: Favor indoor or early morning/evening outdoor workouts to manage heat.`);
    } else if (climate === 'cold' && (season === 'Winter' || season === 'Fall')) {
      lines.push(`Note: Extended warm-ups recommended. Indoor workouts may be preferable.`);
    }
  }
  if (hasOutdoorSpace !== undefined) {
    lines.push(`Outdoor space available: ${hasOutdoorSpace ? 'yes' : 'no'}`);
  }
  lines.push('');

  // Recent workout history (last 14 days)
  lines.push(`## Recent Workout History (last 14 days)`);
  if (recentLogs.length === 0) {
    lines.push(`No recorded workouts in the last 14 days. This may be a new user.`);
  } else {
    // Group logs by date
    const logsByDate: Record<string, any[]> = {};
    for (const log of recentLogs) {
      const date = (log.completedAt || log.sk?.replace('LOG#', '') || '').slice(0, 10);
      if (date) {
        if (!logsByDate[date]) logsByDate[date] = [];
        logsByDate[date].push(log);
      }
    }

    const sortedDates = Object.keys(logsByDate).sort().reverse();
    for (const date of sortedDates.slice(0, 14)) {
      const dayLogs = logsByDate[date];
      const exerciseStrs = dayLogs.map((l: any) => {
        const tags = exTagMap[l.exerciseId] || [];
        let s = `${l.exerciseName || l.exerciseId || 'unknown'}`;
        if (tags.length) s += ` (${tags.join(', ')})`;
        if (l.sets || l.reps) s += ` ${l.sets || '?'}x${l.reps || '?'}`;
        if (l.weight) s += ` @${l.weight}${l.weightUnit || 'lbs'}`;
        if (l.rpe) s += ` RPE:${l.rpe}`;
        return s;
      });
      const workoutTitle = dayLogs[0]?.workoutTitle;
      lines.push(`- ${date}${workoutTitle ? ` (${workoutTitle})` : ''}: ${exerciseStrs.join(' | ')}`);
    }
  }
  lines.push('');

  // Movement pattern summary (last 7 days)
  const summary = computeMovementSummary(recentLogs, exercises, 7);
  lines.push(`## Movement Pattern Summary (last 7 days)`);
  const summaryEntries = Object.entries(summary);
  if (summaryEntries.length === 0) {
    lines.push(`No movement data available.`);
  } else {
    lines.push(summaryEntries.map(([tag, count]) => `${tag}: ${count}`).join(' | '));
  }
  lines.push('');

  // Progression data
  const progression = computeProgressionData(recentLogs);
  if (progression.length > 0) {
    lines.push(`## Progression Data (last 30 days)`);
    for (const p of progression) {
      lines.push(`- ${p.exerciseName}: Best ${p.maxWeight}${p.weightUnit}, trend: ${p.trend}, avg RPE: ${p.avgRpe}`);
    }
    lines.push('');
  }

  // Previous AI-generated workouts
  if (recentDailyWorkouts.length > 0) {
    lines.push(`## Previous AI-Generated Workouts (avoid repetition)`);
    for (const dw of recentDailyWorkouts) {
      lines.push(`- ${dw.date}: "${dw.title}" - Focus: ${(dw.focus || []).join(', ')}, Type: ${dw.type}`);
    }
    lines.push('');

    // Recent workout ratings
    const ratedLogs = recentLogs.filter((l: any) => l.source === 'ai-routine' && l.rating != null);
    if (ratedLogs.length > 0) {
      // Deduplicate by sourceId (date), take first rating per date
      const ratingsByDate: Record<string, { title: string; rating: number }> = {};
      for (const l of ratedLogs) {
        const date = l.sourceId || (l.completedAt || '').slice(0, 10);
        if (date && !ratingsByDate[date]) {
          ratingsByDate[date] = { title: l.workoutTitle || 'Workout', rating: l.rating };
        }
      }
      lines.push(`## Recent Workout Ratings`);
      for (const [date, r] of Object.entries(ratingsByDate).sort().reverse().slice(0, 7)) {
        lines.push(`- ${date}: "${r.title}" - Rating: ${r.rating}/5`);
      }
      lines.push('');
    }

    // Completion rate: cross-reference AI workouts with logs that have source='ai-routine'
    const aiRoutineLogs = recentLogs.filter((l: any) => l.source === 'ai-routine');
    const completedDates = new Set(aiRoutineLogs.map((l: any) => l.sourceId || (l.completedAt || '').slice(0, 10)));
    const trainingWorkouts = recentDailyWorkouts.filter((dw: any) => dw.type === 'training');
    const completedCount = trainingWorkouts.filter((dw: any) => completedDates.has(dw.date)).length;
    const skippedDates = trainingWorkouts
      .filter((dw: any) => !completedDates.has(dw.date))
      .map((dw: any) => dw.date);

    lines.push(`## AI Routine Completion Rate`);
    lines.push(`Generated (training): ${trainingWorkouts.length} | Completed: ${completedCount} | Skipped: ${skippedDates.length}`);
    if (skippedDates.length > 0) {
      lines.push(`Skipped dates: ${skippedDates.join(', ')}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function computeMovementSummary(
  logs: any[],
  exercises: any[],
  days: number
): Record<string, number> {
  const cutoff = daysAgo(days);
  const exTagMap: Record<string, string[]> = {};
  for (const ex of exercises) {
    exTagMap[ex.id] = ex.tags || [];
  }

  const counts: Record<string, number> = {};
  for (const log of logs) {
    const date = (log.completedAt || '').slice(0, 10);
    if (date < cutoff) continue;
    const tags = exTagMap[log.exerciseId] || [];
    for (const tag of tags) {
      counts[tag] = (counts[tag] || 0) + 1;
    }
  }

  return counts;
}

function computeProgressionData(logs: any[]): Array<{
  exerciseId: string;
  exerciseName: string;
  maxWeight: number;
  weightUnit: string;
  trend: string;
  avgRpe: string;
}> {
  // Group by exerciseId
  const byExercise: Record<string, any[]> = {};
  for (const log of logs) {
    if (!log.exerciseId || !log.weight) continue;
    if (!byExercise[log.exerciseId]) byExercise[log.exerciseId] = [];
    byExercise[log.exerciseId].push(log);
  }

  const results = [];
  for (const [exerciseId, exLogs] of Object.entries(byExercise)) {
    // Sort by date
    const sorted = exLogs.sort((a: any, b: any) =>
      (a.completedAt || '').localeCompare(b.completedAt || '')
    );

    const maxWeight = Math.max(...sorted.map((l: any) => l.weight || 0));
    const weightUnit = sorted[0]?.weightUnit || 'lbs';

    // Trend from last 3 entries
    const lastThree = sorted.slice(-3).map((l: any) => l.weight || 0);
    let trend = 'stable';
    if (lastThree.length >= 2) {
      if (lastThree[lastThree.length - 1] > lastThree[0]) trend = 'increasing';
      else if (lastThree[lastThree.length - 1] < lastThree[0]) trend = 'decreasing';
    }

    // Average RPE
    const rpes = sorted.filter((l: any) => l.rpe).map((l: any) => l.rpe);
    const avgRpe = rpes.length > 0
      ? (rpes.reduce((a: number, b: number) => a + b, 0) / rpes.length).toFixed(1)
      : 'N/A';

    results.push({
      exerciseId,
      exerciseName: sorted[0]?.exerciseName || exerciseId,
      maxWeight,
      weightUnit,
      trend,
      avgRpe,
    });
  }

  return results;
}

// ── Route Handlers ──

/**
 * POST /api/routine/generate - Generate today's AI workout (authenticated, tier II+)
 * Uses async Lambda self-invocation to avoid API Gateway's 29s timeout.
 */
export async function generateDailyWorkout(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const claims = extractClaims(event);
  if (!claims?.sub) return forbidden('Authentication required');

  try {
    const today = todayStr(event);

    // 1. Load user profile (for tier check + fitness profile)
    const profileResult = await client.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { pk: `USER#${claims.sub}`, sk: 'PROFILE' },
      })
    );
    const profile = profileResult.Item;
    if (!profile) return serverError('User profile not found');

    // 2. Tier gate
    if (!hasTierAccess(profile.tier || 'Pup', 'Rock Runner')) {
      return forbidden('Personalized routines require Rock Runner or Iron Dassie tier');
    }

    // 3. Fitness profile check
    if (!profile.fitnessProfile) {
      return badRequest('Complete your fitness questionnaire first at /portal/questionnaire');
    }

    // 4. Rate limit: check if today's workout already exists
    const existingResult = await client.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { pk: `USER#${claims.sub}`, sk: `DAILY_WORKOUT#${today}` },
      })
    );
    if (existingResult.Item) {
      // If still generating, tell the frontend to keep polling
      if (existingResult.Item.status === 'generating') {
        return success({ status: 'generating', date: today });
      }
      // If previous attempt errored, allow regeneration
      if (existingResult.Item.status === 'error') {
        // Fall through to regenerate
      } else {
        const isIronDassie = hasTierAccess(profile.tier || 'Pup', 'Iron Dassie');
        const genCount = existingResult.Item.generationCount || 1;
        if (!isIronDassie || genCount >= 3) {
          return success(existingResult.Item);
        }
      }
    }

    // 5. Save a placeholder record so the frontend knows generation is in progress
    await client.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          pk: `USER#${claims.sub}`,
          sk: `DAILY_WORKOUT#${today}`,
          gsi1pk: 'DAILY_WORKOUT',
          gsi1sk: `${today}#${claims.sub}`,
          status: 'generating',
          date: today,
          generatedAt: new Date().toISOString(),
        },
      })
    );

    // 6. Fire-and-forget: invoke self asynchronously to do the Bedrock call
    await lambdaClient.send(
      new InvokeCommand({
        FunctionName: SELF_FUNCTION_NAME,
        InvocationType: 'Event', // async - returns immediately
        Payload: new TextEncoder().encode(JSON.stringify({
          __asyncRoutineGeneration: true,
          userSub: claims.sub,
          userTier: profile.tier,
          today,
        })),
      })
    );

    // 7. Return 202 immediately - frontend will poll GET /api/routine/today
    return {
      statusCode: 202,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'generating', date: today }),
    };
  } catch (error) {
    console.error('generateDailyWorkout error:', error);
    return serverError('Failed to generate daily workout');
  }
}

/**
 * Async background handler for routine generation.
 * Called via Lambda self-invocation (InvocationType: Event).
 */
export async function generateRoutineAsync(payload: {
  userSub: string;
  userTier: string;
  today: string;
}): Promise<void> {
  const { userSub, userTier, today } = payload;

  try {
    // Load fitness profile
    const profileResult = await client.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { pk: `USER#${userSub}`, sk: 'PROFILE' },
      })
    );
    const profile = profileResult.Item;
    if (!profile?.fitnessProfile) {
      console.error('generateRoutineAsync: no fitness profile for', userSub);
      return;
    }

    // Check existing record for generation count
    const existingResult = await client.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { pk: `USER#${userSub}`, sk: `DAILY_WORKOUT#${today}` },
      })
    );
    const prevGenCount = existingResult.Item?.generationCount || 0;

    // Load catalogs in parallel
    const [exerciseResult, workoutResult, equipmentResult] = await Promise.all([
      client.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: { ':pk': 'EXERCISE' },
      })),
      client.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk',
        FilterExpression: '#s = :pub',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: { ':pk': 'WORKOUT', ':pub': 'published' },
      })),
      client.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: { ':pk': 'EQUIPMENT' },
      })),
    ]);

    const exercises = exerciseResult.Items || [];
    const workouts = workoutResult.Items || [];
    const equipment = equipmentResult.Items || [];

    // Load user context in parallel
    const fourteenDaysAgo = daysAgo(14);
    const [logsResult, dailyWorkoutsResult] = await Promise.all([
      client.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk AND sk BETWEEN :from AND :to',
        ExpressionAttributeValues: {
          ':pk': `USER#${userSub}`,
          ':from': `LOG#${fourteenDaysAgo}`,
          ':to': `LOG#${new Date().toISOString()}~`,
        },
        ScanIndexForward: false,
      })),
      client.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userSub}`,
          ':prefix': 'DAILY_WORKOUT#',
        },
        ScanIndexForward: false,
        Limit: 7,
      })),
    ]);

    const recentLogs = logsResult.Items || [];
    const recentDailyWorkouts = dailyWorkoutsResult.Items || [];

    // Build prompts
    const systemPrompt = buildSystemPrompt(exercises, workouts, equipment);
    const userPrompt = buildUserPrompt(
      profile.fitnessProfile,
      recentLogs,
      recentDailyWorkouts,
      exercises,
      today,
      userTier
    );

    // Call Bedrock
    const result = await invokeClaude(systemPrompt, userPrompt, { maxTokens: 4096 });

    // Parse JSON from response
    let dailyWorkout: any;
    try {
      const parsed = JSON.parse(result.content);
      dailyWorkout = parsed.dailyWorkout || parsed;
    } catch {
      const jsonMatch = result.content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1].trim());
        dailyWorkout = parsed.dailyWorkout || parsed;
      } else {
        console.error('Failed to parse Bedrock response:', result.content.slice(0, 500));
        // Save error status so frontend can show error
        await client.send(new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            pk: `USER#${userSub}`,
            sk: `DAILY_WORKOUT#${today}`,
            gsi1pk: 'DAILY_WORKOUT',
            gsi1sk: `${today}#${userSub}`,
            status: 'error',
            date: today,
            error: 'AI returned invalid response format',
            generatedAt: new Date().toISOString(),
          },
        }));
        return;
      }
    }

    // Ensure date is set
    dailyWorkout.date = today;

    // Store in DynamoDB
    const item = {
      pk: `USER#${userSub}`,
      sk: `DAILY_WORKOUT#${today}`,
      gsi1pk: 'DAILY_WORKOUT',
      gsi1sk: `${today}#${userSub}`,
      ...dailyWorkout,
      status: 'ready',
      generatedAt: new Date().toISOString(),
      modelId: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
      tokenUsage: result.usage,
      generationCount: prevGenCount + 1,
    };

    await client.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
    console.log(`Routine generated for ${userSub} on ${today}`);
  } catch (error) {
    console.error('generateRoutineAsync error:', error);
    // Save error status
    await client.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: `USER#${userSub}`,
        sk: `DAILY_WORKOUT#${today}`,
        gsi1pk: 'DAILY_WORKOUT',
        gsi1sk: `${today}#${userSub}`,
        status: 'error',
        date: today,
        error: 'Generation failed',
        generatedAt: new Date().toISOString(),
      },
    }));
  }
}

/**
 * POST /api/routine/swap - Swap today's workout for a different one
 * Rock Runner: 1 swap/day, Iron Dassie: unlimited
 * Uses async self-invocation like generate to avoid 29s timeout.
 */
export async function swapDailyWorkout(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const claims = extractClaims(event);
  if (!claims?.sub) return forbidden('Authentication required');

  try {
    const today = todayStr(event);

    // Load profile
    const profileResult = await client.send(
      new GetCommand({ TableName: TABLE_NAME, Key: { pk: `USER#${claims.sub}`, sk: 'PROFILE' } })
    );
    const profile = profileResult.Item;
    if (!profile) return serverError('User profile not found');
    if (!hasTierAccess(profile.tier || 'Pup', 'Rock Runner')) {
      return forbidden('Swap requires Rock Runner or Iron Dassie tier');
    }
    if (!profile.fitnessProfile) return badRequest('Complete your fitness questionnaire first');

    // Check existing workout + swap limit
    const existingResult = await client.send(
      new GetCommand({ TableName: TABLE_NAME, Key: { pk: `USER#${claims.sub}`, sk: `DAILY_WORKOUT#${today}` } })
    );
    const existing = existingResult.Item;
    if (!existing) return badRequest('No workout to swap. Generate one first.');
    if (existing.status === 'generating') return badRequest('Workout is still generating. Please wait.');

    const currentSwapCount = existing.swapCount || 0;
    const isIronDassie = hasTierAccess(profile.tier || 'Pup', 'Iron Dassie');
    if (!isIronDassie && currentSwapCount >= 1) {
      return badRequest('Rock Runner tier allows 1 swap per day. Upgrade to Iron Dassie for unlimited swaps.');
    }

    // Parse optional preferences from body
    const body = JSON.parse(event.body || '{}');

    // Mark existing workout as swapping (preserve old data for rollback)
    await client.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { pk: `USER#${claims.sub}`, sk: `DAILY_WORKOUT#${today}` },
        UpdateExpression: 'SET #status = :status, swapCount = :sc',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':status': 'generating', ':sc': currentSwapCount + 1 },
      })
    );

    // Fire-and-forget async swap
    await lambdaClient.send(
      new InvokeCommand({
        FunctionName: SELF_FUNCTION_NAME,
        InvocationType: 'Event',
        Payload: new TextEncoder().encode(JSON.stringify({
          __asyncRoutineSwap: true,
          userSub: claims.sub,
          userTier: profile.tier,
          today,
          swapCount: currentSwapCount + 1,
          rejectedTitle: existing.title || '',
          rejectedFocus: existing.focus || [],
          avoidFocus: body.avoidFocus || [],
          preferFocus: body.preferFocus || [],
        })),
      })
    );

    return {
      statusCode: 202,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'generating', date: today }),
    };
  } catch (error) {
    console.error('swapDailyWorkout error:', error);
    return serverError('Failed to swap workout');
  }
}

/**
 * Async background handler for swap generation.
 */
export async function swapRoutineAsync(payload: {
  userSub: string;
  userTier: string;
  today: string;
  swapCount: number;
  rejectedTitle: string;
  rejectedFocus: string[];
  avoidFocus: string[];
  preferFocus: string[];
}): Promise<void> {
  const { userSub, userTier, today, swapCount, rejectedTitle, rejectedFocus, avoidFocus, preferFocus } = payload;

  try {
    const profileResult = await client.send(
      new GetCommand({ TableName: TABLE_NAME, Key: { pk: `USER#${userSub}`, sk: 'PROFILE' } })
    );
    const profile = profileResult.Item;
    if (!profile?.fitnessProfile) return;

    const fourteenDaysAgo = daysAgo(14);
    const [exerciseResult, workoutResult, equipmentResult, logsResult, dailyWorkoutsResult] = await Promise.all([
      client.send(new QueryCommand({ TableName: TABLE_NAME, KeyConditionExpression: 'pk = :pk', ExpressionAttributeValues: { ':pk': 'EXERCISE' } })),
      client.send(new QueryCommand({ TableName: TABLE_NAME, KeyConditionExpression: 'pk = :pk', FilterExpression: '#s = :pub', ExpressionAttributeNames: { '#s': 'status' }, ExpressionAttributeValues: { ':pk': 'WORKOUT', ':pub': 'published' } })),
      client.send(new QueryCommand({ TableName: TABLE_NAME, KeyConditionExpression: 'pk = :pk', ExpressionAttributeValues: { ':pk': 'EQUIPMENT' } })),
      client.send(new QueryCommand({ TableName: TABLE_NAME, KeyConditionExpression: 'pk = :pk AND sk BETWEEN :from AND :to', ExpressionAttributeValues: { ':pk': `USER#${userSub}`, ':from': `LOG#${fourteenDaysAgo}`, ':to': `LOG#${new Date().toISOString()}~` }, ScanIndexForward: false })),
      client.send(new QueryCommand({ TableName: TABLE_NAME, KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)', ExpressionAttributeValues: { ':pk': `USER#${userSub}`, ':prefix': 'DAILY_WORKOUT#' }, ScanIndexForward: false, Limit: 7 })),
    ]);

    const exercises = exerciseResult.Items || [];
    const systemPrompt = buildSystemPrompt(exercises, workoutResult.Items || [], equipmentResult.Items || []);
    let userPrompt = buildUserPrompt(profile.fitnessProfile, logsResult.Items || [], dailyWorkoutsResult.Items || [], exercises, today, userTier);

    userPrompt += `\n## SWAP REQUEST\n`;
    userPrompt += `The user rejected this workout: "${rejectedTitle}" (focus: ${rejectedFocus.join(', ')})\n`;
    userPrompt += `Generate a DIFFERENT workout with different exercises and a different focus area.\n`;
    if (avoidFocus.length > 0) userPrompt += `Avoid focus areas: ${avoidFocus.join(', ')}\n`;
    if (preferFocus.length > 0) userPrompt += `Prefer focus areas: ${preferFocus.join(', ')}\n`;

    const result = await invokeClaude(systemPrompt, userPrompt, { maxTokens: 4096 });

    let dailyWorkout: any;
    try {
      const parsed = JSON.parse(result.content);
      dailyWorkout = parsed.dailyWorkout || parsed;
    } catch {
      const jsonMatch = result.content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1].trim());
        dailyWorkout = parsed.dailyWorkout || parsed;
      } else {
        console.error('Swap: failed to parse response:', result.content.slice(0, 500));
        await client.send(new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            pk: `USER#${userSub}`, sk: `DAILY_WORKOUT#${today}`,
            gsi1pk: 'DAILY_WORKOUT', gsi1sk: `${today}#${userSub}`,
            status: 'error', date: today, error: 'AI returned invalid format',
            generatedAt: new Date().toISOString(), swapCount,
          },
        }));
        return;
      }
    }

    dailyWorkout.date = today;
    const item = {
      pk: `USER#${userSub}`,
      sk: `DAILY_WORKOUT#${today}`,
      gsi1pk: 'DAILY_WORKOUT',
      gsi1sk: `${today}#${userSub}`,
      ...dailyWorkout,
      status: 'ready',
      generatedAt: new Date().toISOString(),
      modelId: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
      tokenUsage: result.usage,
      swapCount,
    };

    await client.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
    console.log(`Swap completed for ${userSub} on ${today}`);
  } catch (error) {
    console.error('swapRoutineAsync error:', error);
    // Restore the original workout status instead of destroying it
    try {
      await client.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { pk: `USER#${userSub}`, sk: `DAILY_WORKOUT#${today}` },
          UpdateExpression: 'SET #status = :status, swapError = :err',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: {
            ':status': 'ready',
            ':err': String((error as Error).message || 'Swap generation failed'),
          },
        })
      );
    } catch (rollbackErr) {
      console.error('Failed to rollback swap status:', rollbackErr);
    }
  }
}

/**
 * POST /api/routine/preview - Preview prompts without calling Bedrock (admin-only debug)
 */
export async function previewPrompts(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const claims = extractClaims(event);
  if (!claims?.sub) return forbidden('Authentication required');
  if (!isAdmin(event)) return forbidden('Admin access required');

  try {
    const today = todayStr(event);

    // Load user profile
    const profileResult = await client.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { pk: `USER#${claims.sub}`, sk: 'PROFILE' },
      })
    );
    const profile = profileResult.Item;
    if (!profile?.fitnessProfile) {
      return badRequest('Complete your fitness questionnaire first to preview prompts');
    }

    // Load catalogs + context in parallel
    const fourteenDaysAgo = daysAgo(14);
    const [exerciseResult, workoutResult, equipmentResult, logsResult, dailyWorkoutsResult] = await Promise.all([
      client.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: { ':pk': 'EXERCISE' },
      })),
      client.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: { ':pk': 'WORKOUT' },
      })),
      client.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: { ':pk': 'EQUIPMENT' },
      })),
      client.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk AND sk BETWEEN :from AND :to',
        ExpressionAttributeValues: {
          ':pk': `USER#${claims.sub}`,
          ':from': `LOG#${fourteenDaysAgo}`,
          ':to': `LOG#${new Date().toISOString()}~`,
        },
        ScanIndexForward: false,
      })),
      client.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
        ExpressionAttributeValues: {
          ':pk': `USER#${claims.sub}`,
          ':prefix': 'DAILY_WORKOUT#',
        },
        ScanIndexForward: false,
        Limit: 7,
      })),
    ]);

    const exercises = exerciseResult.Items || [];
    const workouts = workoutResult.Items || [];
    const equipment = equipmentResult.Items || [];
    const recentLogs = logsResult.Items || [];
    const recentDailyWorkouts = dailyWorkoutsResult.Items || [];

    const systemPrompt = buildSystemPrompt(exercises, workouts, equipment);
    const userPrompt = buildUserPrompt(
      profile.fitnessProfile,
      recentLogs,
      recentDailyWorkouts,
      exercises,
      today,
      profile.tier
    );

    // Rough token estimate (~4 chars per token)
    const estimatedTokens = Math.ceil((systemPrompt.length + userPrompt.length) / 4);

    return success({
      systemPrompt,
      userPrompt,
      estimatedTokens,
      catalogStats: {
        exercises: exercises.length,
        workouts: workouts.length,
        equipment: equipment.length,
      },
      contextStats: {
        recentLogs: recentLogs.length,
        recentDailyWorkouts: recentDailyWorkouts.length,
      },
    });
  } catch (error) {
    console.error('previewPrompts error:', error);
    return serverError('Failed to preview prompts');
  }
}

/**
 * GET /api/routine/today - Get today's generated workout (authenticated)
 */
export async function getTodayWorkout(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const claims = extractClaims(event);
  if (!claims?.sub) return forbidden('Authentication required');

  try {
    const today = todayStr(event);
    const result = await client.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { pk: `USER#${claims.sub}`, sk: `DAILY_WORKOUT#${today}` },
      })
    );

    if (!result.Item) {
      return notFound('No workout generated for today');
    }

    return success(result.Item);
  } catch (error) {
    console.error('getTodayWorkout error:', error);
    return serverError('Failed to fetch today\'s workout');
  }
}

/**
 * GET /api/routine/history - List past daily workouts (authenticated)
 */
export async function listWorkoutHistory(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const claims = extractClaims(event);
  if (!claims?.sub) return forbidden('Authentication required');

  try {
    const result = await client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
        ExpressionAttributeValues: {
          ':pk': `USER#${claims.sub}`,
          ':prefix': 'DAILY_WORKOUT#',
        },
        ScanIndexForward: false,
        Limit: 30,
      })
    );

    return success({
      workouts: result.Items || [],
      count: (result.Items || []).length,
    });
  } catch (error) {
    console.error('listWorkoutHistory error:', error);
    return serverError('Failed to fetch workout history');
  }
}

/**
 * GET /api/routine/{date} - Get a specific date's workout (authenticated)
 */
export async function getWorkoutByDate(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const claims = extractClaims(event);
  if (!claims?.sub) return forbidden('Authentication required');

  const date = event.pathParameters?.date;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return badRequest('Date must be in YYYY-MM-DD format');
  }

  try {
    const result = await client.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { pk: `USER#${claims.sub}`, sk: `DAILY_WORKOUT#${date}` },
      })
    );

    if (!result.Item) {
      return notFound(`No workout found for ${date}`);
    }

    return success(result.Item);
  } catch (error) {
    console.error('getWorkoutByDate error:', error);
    return serverError('Failed to fetch workout');
  }
}

/**
 * GET /api/admin/users/{username}/routines - Admin-only: get a user's AI routine history
 */
export async function getAdminUserRoutines(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (!isAdmin(event)) return forbidden('Admin access required');

  const username = event.pathParameters?.username;
  if (!username) return badRequest('Username is required');

  try {
    const result = await client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
        ExpressionAttributeValues: {
          ':pk': `USER#${username}`,
          ':prefix': 'DAILY_WORKOUT#',
        },
        ScanIndexForward: false,
        Limit: 10,
      })
    );

    const routines = (result.Items || []).map((item: any) => ({
      date: item.date,
      title: item.title,
      type: item.type,
      duration: item.duration,
      focus: item.focus,
      generatedAt: item.generatedAt,
      tokenUsage: item.tokenUsage,
    }));

    return success({ routines, count: routines.length });
  } catch (error) {
    console.error('getAdminUserRoutines error:', error);
    return serverError('Failed to fetch user routines');
  }
}
