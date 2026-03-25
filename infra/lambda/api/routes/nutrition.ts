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
import { getEffectiveTier } from '../utils/trial';

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
  if (event) {
    const qsDate = event.queryStringParameters?.date;
    if (qsDate && /^\d{4}-\d{2}-\d{2}$/.test(qsDate)) return qsDate;
    try {
      const body = event.body ? JSON.parse(event.body) : {};
      if (body.clientDate && /^\d{4}-\d{2}-\d{2}$/.test(body.clientDate)) return body.clientDate;
    } catch { /* ignore parse errors */ }
  }
  return new Date().toISOString().slice(0, 10);
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

export function buildNutritionSystemPrompt(): string {
  const lines: string[] = [];

  lines.push(`You are the Hyrax Fitness digital nutrition assistant. You create personalized daily nutrition plans tailored to each user's dietary needs, fitness goals, and lifestyle.`);
  lines.push('');
  lines.push(`## Nutrition Philosophy`);
  lines.push(`The Hyrax nutrition approach is whole-food focused, prioritizing performance and recovery. Meals are adapted to the user's lifestyle, budget, regional food availability, and cooking ability. Nutrition is periodized around training: higher carbs and protein on training days, strategic meal timing around workouts, and adequate recovery nutrition on rest days.`);
  lines.push('');

  lines.push(`## CRITICAL SAFETY RULES`);
  lines.push(`1. STRICTLY respect ALL listed allergies. NEVER include any food containing a listed allergen, even as a minor ingredient, garnish, sauce component, or trace element. This is a SAFETY requirement. Failure to respect allergies can cause severe harm.`);
  lines.push(`2. Respect all dietary restrictions (vegan, vegetarian, halal, kosher, pescatarian, etc.) without exception. Never suggest foods that violate these restrictions.`);
  lines.push(`3. Respect food dislikes. Never include disliked foods in any meal or snack.`);
  lines.push(`4. Only suggest foods the user has access to based on their region, shopping access, and food availability.`);
  lines.push('');

  lines.push(`## Rules`);
  lines.push(`1. Account for the user's workout schedule. Provide more carbs and protein on training days. Time meals around workouts (pre-workout fuel, post-workout recovery).`);
  lines.push(`2. Match the user's caloric targets and macro preferences as closely as possible.`);
  lines.push(`3. Respect cooking skill level, available time per meal, and kitchen equipment.`);
  lines.push(`4. Keep meal plans within the user's stated budget range.`);
  lines.push(`5. Vary meals day to day. Check previous nutrition plans and avoid repeating the same meals within 7 days.`);
  lines.push(`6. Include hydration recommendations based on training intensity, climate, and body weight.`);
  lines.push(`7. Account for existing supplements the user is taking. Do not duplicate supplementation unnecessarily.`);
  lines.push(`8. Provide a grocery list at the end covering all ingredients needed for the day.`);
  lines.push(`9. Respond ONLY with valid JSON matching the schema below. No explanation text outside the JSON.`);
  lines.push(`10. NEVER use em-dashes (--), unicode dashes, or emojis in any text field. Use commas, periods, or semicolons instead.`);
  lines.push(`11. Be concise in all text fields. Prep notes: 1-2 short sentences. Coaching notes: 2-3 sentences max. Item notes: 1 short sentence. Avoid filler words and motivational fluff.`);
  lines.push('');

  // JSON response schema
  lines.push(`## Response JSON Schema`);
  lines.push(`Respond with exactly this JSON structure:`);
  lines.push('```json');
  lines.push(JSON.stringify({
    dailyNutrition: {
      date: 'YYYY-MM-DD',
      title: 'Descriptive plan name',
      type: 'training_day | rest_day | active_recovery',
      totalCalories: 2200,
      macros: { protein: '165g', carbs: '220g', fat: '73g', fiber: '35g' },
      meals: [{
        mealNumber: 1,
        name: 'Breakfast',
        time: '7:00 AM',
        calories: 500,
        macros: { protein: '35g', carbs: '55g', fat: '15g' },
        items: [{ food: 'Rolled Oats', amount: '1 cup', calories: 300, notes: '' }],
        prepNotes: 'Quick cooking instructions',
        timing: 'Pre-workout or null',
      }],
      hydration: { target: '3L', notes: 'Hydration guidance' },
      supplements: [{ name: 'Creatine', dosage: '5g', timing: 'Post-workout' }],
      coachingNotes: 'Overall nutrition guidance for the day',
      groceryList: ['item1', 'item2'],
      progressionContext: 'How this plan connects to recent training',
      tomorrowHint: 'Preview of tomorrow\'s approach',
    },
  }, null, 2));
  lines.push('```');

  return lines.join('\n');
}

export function buildNutritionUserPrompt(
  nutritionProfile: any,
  fitnessProfile: any,
  todayWorkout: any | null,
  recentLogs: any[],
  recentNutritionPlans: any[],
  today: string,
  userTier?: string,
  recentMealLogs?: any[]
): string {
  const lines: string[] = [];

  lines.push(`Generate today's personalized nutrition plan for this user.`);
  lines.push('');

  // ── ALLERGEN ALERT (first, prominent) ──
  const allergies = nutritionProfile.allergies || [];
  lines.push(`## !! ALLERGEN ALERT !!`);
  if (allergies.length > 0) {
    lines.push(`THE FOLLOWING ARE CONFIRMED ALLERGIES. NEVER include ANY food containing these allergens:`);
    lines.push(`ALLERGIES: ${allergies.join(', ')}`);
  } else {
    lines.push(`No known allergies reported.`);
  }
  lines.push('');

  // ── Dietary Restrictions ──
  lines.push(`## Dietary Restrictions`);
  const restrictions = nutritionProfile.dietaryRestrictions || [];
  lines.push(`Restrictions: ${restrictions.length > 0 ? restrictions.join(', ') : 'None'}`);
  lines.push('');

  // ── Food Preferences ──
  lines.push(`## Food Preferences`);
  const likes = nutritionProfile.foodLikes || [];
  const dislikes = nutritionProfile.foodDislikes || [];
  const cuisines = nutritionProfile.cuisinePreferences || [];
  lines.push(`Likes: ${likes.length > 0 ? likes.join(', ') : 'No specific preferences'}`);
  lines.push(`Dislikes (never include): ${dislikes.length > 0 ? dislikes.join(', ') : 'None'}`);
  lines.push(`Cuisine preferences: ${cuisines.length > 0 ? cuisines.join(', ') : 'Any'}`);
  lines.push('');

  // ── Food Access & Budget ──
  lines.push(`## Food Access & Budget`);
  lines.push(`Shopping access: ${nutritionProfile.shoppingAccess || 'standard grocery store'}`);
  lines.push(`Budget range: ${nutritionProfile.budgetRange || 'moderate'}`);
  if (nutritionProfile.region) {
    lines.push(`Region: ${nutritionProfile.region}`);
  }
  if (nutritionProfile.foodAccessNotes) {
    lines.push(`Notes: ${nutritionProfile.foodAccessNotes}`);
  }
  lines.push('');

  // ── Meal Schedule ──
  lines.push(`## Meal Schedule`);
  lines.push(`Meals per day: ${nutritionProfile.mealsPerDay || 3}`);
  if (nutritionProfile.mealTimes) {
    lines.push(`Preferred meal times: ${nutritionProfile.mealTimes}`);
  }
  lines.push(`Snacking: ${nutritionProfile.snacking || 'moderate'}`);
  if (nutritionProfile.fastingSchedule) {
    lines.push(`Fasting schedule: ${nutritionProfile.fastingSchedule}`);
  }
  lines.push('');

  // ── Cooking Profile ──
  lines.push(`## Cooking Profile`);
  lines.push(`Cooking skill: ${nutritionProfile.cookingSkill || 'intermediate'}`);
  lines.push(`Time per meal: ${nutritionProfile.timePerMeal || '15-30 minutes'}`);
  lines.push(`Kitchen equipment: ${(nutritionProfile.kitchenEquipment || []).join(', ') || 'standard kitchen'}`);
  if (nutritionProfile.mealPrepPreference) {
    lines.push(`Meal prep preference: ${nutritionProfile.mealPrepPreference}`);
  }
  lines.push('');

  // ── Caloric Goals & Macros ──
  lines.push(`## Caloric Goals & Macros`);
  lines.push(`Daily calorie target: ${nutritionProfile.calorieTarget || 'not specified'}`);
  if (nutritionProfile.macroTargets) {
    const mt = nutritionProfile.macroTargets;
    lines.push(`Macro targets: Protein ${mt.protein || 'flexible'}, Carbs ${mt.carbs || 'flexible'}, Fat ${mt.fat || 'flexible'}`);
  }
  if (nutritionProfile.weight) {
    lines.push(`Weight: ${nutritionProfile.weight}${nutritionProfile.weightUnit || 'lbs'}`);
  }
  if (nutritionProfile.height) {
    lines.push(`Height: ${nutritionProfile.height}`);
  }
  if (nutritionProfile.weightGoal) {
    lines.push(`Weight goal: ${nutritionProfile.weightGoal}`);
  }
  lines.push('');

  // ── Supplements & Hydration ──
  lines.push(`## Supplements & Hydration`);
  const supplements = nutritionProfile.currentSupplements || [];
  lines.push(`Current supplements: ${supplements.length > 0 ? supplements.join(', ') : 'None'}`);
  lines.push(`Daily water intake: ${nutritionProfile.waterIntake || 'not tracked'}`);
  if (nutritionProfile.caffeineIntake) {
    lines.push(`Caffeine intake: ${nutritionProfile.caffeineIntake}`);
  }
  lines.push('');

  // ── Fitness Context ──
  lines.push(`## Fitness Context`);
  if (fitnessProfile) {
    lines.push(`Goals: ${(fitnessProfile.fitnessGoals || []).join(', ') || 'general fitness'}`);
    lines.push(`Experience level: ${fitnessProfile.experienceLevel || 'intermediate'}`);
    lines.push(`Days per week: ${fitnessProfile.daysPerWeek || 3}`);
    lines.push(`Preferred duration: ${fitnessProfile.preferredDuration || '30'} minutes`);
    lines.push(`Preferred intensity: ${(fitnessProfile.preferredIntensity || 'moderate').replace(/_/g, ' ')}`);
    if (fitnessProfile.age) {
      lines.push(`Age: ${fitnessProfile.age}`);
    }
  } else {
    lines.push(`No fitness profile available.`);
  }
  if (userTier) {
    lines.push(`Subscription tier: ${userTier}`);
  }
  lines.push('');

  // ── Today's Context ──
  lines.push(`## Today's Context`);
  lines.push(`Date: ${formatDateLong(today)}`);
  lines.push(`Day of week: ${dayOfWeekName(today)}`);

  const month = new Date(today + 'T12:00:00Z').getMonth();
  const seasons = ['Winter', 'Winter', 'Spring', 'Spring', 'Spring', 'Summer', 'Summer', 'Summer', 'Fall', 'Fall', 'Fall', 'Winter'];
  const season = seasons[month];
  lines.push(`Season: ${season}`);

  const climate = fitnessProfile?.location?.climate;
  if (climate) {
    lines.push(`Climate: ${climate.replace(/_/g, ' ')}`);
    if (climate === 'hot_humid' || climate === 'hot_dry') {
      lines.push(`Note: Increase hydration targets. Favor lighter, cooler meals.`);
    } else if (climate === 'cold' && (season === 'Winter' || season === 'Fall')) {
      lines.push(`Note: Warm meals and soups may be preferred. Ensure adequate calorie intake for cold conditions.`);
    }
  }
  lines.push('');

  // ── Today's Workout ──
  lines.push(`## Today's Workout`);
  if (todayWorkout && todayWorkout.status === 'ready') {
    lines.push(`Type: ${todayWorkout.type || 'training'}`);
    lines.push(`Title: ${todayWorkout.title || 'Workout'}`);
    lines.push(`Focus: ${(todayWorkout.focus || []).join(', ') || 'general'}`);
    lines.push(`Duration: ${todayWorkout.duration || 'unknown'}`);
    if (todayWorkout.exercises && Array.isArray(todayWorkout.exercises)) {
      const exerciseNames = todayWorkout.exercises.map((e: any) => e.exerciseName || e.exerciseId).join(', ');
      lines.push(`Exercises: ${exerciseNames}`);
    }
    lines.push(`Note: Time meals around this workout. Pre-workout fuel 1-2 hours before, post-workout protein within 1 hour after.`);
  } else {
    lines.push(`No workout generated for today. Treat as a rest or flexible day.`);
  }
  lines.push('');

  // ── Recent Workout History ──
  lines.push(`## Recent Workout History (last 7 days)`);
  if (recentLogs.length === 0) {
    lines.push(`No recorded workouts in the last 7 days.`);
  } else {
    const logsByDate: Record<string, any[]> = {};
    for (const log of recentLogs) {
      const date = (log.completedAt || log.sk?.replace('LOG#', '') || '').slice(0, 10);
      if (date) {
        if (!logsByDate[date]) logsByDate[date] = [];
        logsByDate[date].push(log);
      }
    }
    const sortedDates = Object.keys(logsByDate).sort().reverse();
    for (const date of sortedDates.slice(0, 7)) {
      const dayLogs = logsByDate[date];
      const exerciseStrs = dayLogs.map((l: any) => {
        let s = `${l.exerciseName || l.exerciseId || 'unknown'}`;
        if (l.sets || l.reps) s += ` ${l.sets || '?'}x${l.reps || '?'}`;
        return s;
      });
      const workoutTitle = dayLogs[0]?.workoutTitle;
      lines.push(`- ${date}${workoutTitle ? ` (${workoutTitle})` : ''}: ${exerciseStrs.join(' | ')}`);
    }
  }
  lines.push('');

  // ── Previous Nutrition Plans ──
  if (recentNutritionPlans.length > 0) {
    lines.push(`## Previous Nutrition Plans (avoid repetition)`);
    for (const np of recentNutritionPlans) {
      const mealSummary = (np.meals || []).map((m: any) => {
        const itemNames = (m.items || []).map((i: any) => i.food).join(', ');
        return `${m.name}: ${itemNames}`;
      }).join(' | ');
      lines.push(`- ${np.date}: "${np.title}" - ${mealSummary}`);
    }
    lines.push('');
  }

  // ── Recent Meal Completion Logs ──
  if (recentMealLogs && recentMealLogs.length > 0) {
    lines.push(`## Recent Meal Completion History (what the user actually ate)`);
    const byDate: Record<string, any[]> = {};
    for (const log of recentMealLogs) {
      const date = log.planDate || (log.completedAt || '').slice(0, 10);
      if (!byDate[date]) byDate[date] = [];
      byDate[date].push(log);
    }
    for (const [date, entries] of Object.entries(byDate).sort(([a], [b]) => b.localeCompare(a)).slice(0, 7)) {
      const meals = entries.map((m: any) => {
        let s = m.mealName || 'Meal';
        if (m.source === 'adhoc') s += ' [unplanned]';
        if (m.modifications) s += ` [modified: ${m.modifications}]`;
        if (m.skipped) s += ' [SKIPPED]';
        if (m.rating) s += ` rating:${m.rating}/5`;
        return s;
      }).join(', ');
      lines.push(`- ${date}: ${meals}`);
    }
    lines.push('Use this data to adjust today\'s plan. If user frequently skips meals or modifies them, account for their actual preferences.');
    lines.push('');
  }

  // ── ALLERGEN REMINDER (safety double-check) ──
  lines.push(`## !! ALLERGEN REMINDER - FINAL CHECK !!`);
  if (allergies.length > 0) {
    lines.push(`BEFORE RESPONDING, verify that NONE of the following allergens appear in ANY meal, ingredient, sauce, or garnish:`);
    lines.push(`ALLERGIES: ${allergies.join(', ')}`);
    lines.push(`This is a SAFETY-CRITICAL requirement.`);
  } else {
    lines.push(`No known allergies. Proceed with plan generation.`);
  }

  return lines.join('\n');
}

// ── Route Handlers ──

/**
 * POST /api/nutrition/generate - Generate today's AI nutrition plan (authenticated, Iron Dassie only)
 * Uses async Lambda self-invocation to avoid API Gateway's 29s timeout.
 */
export async function generateDailyNutrition(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const claims = extractClaims(event);
  if (!claims?.sub) return forbidden('Authentication required');

  try {
    const today = todayStr(event);

    // 1. Load user profile (for tier check + profiles)
    const profileResult = await client.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { pk: `USER#${claims.sub}`, sk: 'PROFILE' },
      })
    );
    const profile = profileResult.Item;
    if (!profile) return serverError('User profile not found');

    // 2. Tier gate: Iron Dassie only
    if (!hasTierAccess(getEffectiveTier(profile), 'Iron Dassie')) {
      return forbidden('Personalized nutrition plans require Iron Dassie tier');
    }

    // 3. Nutrition profile check
    if (!profile.nutritionProfile) {
      return badRequest('Complete your nutrition questionnaire first at /portal/nutrition-questionnaire');
    }

    // 4. Rate limit: check if today's nutrition plan already exists
    const existingResult = await client.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { pk: `USER#${claims.sub}`, sk: `DAILY_NUTRITION#${today}` },
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
        // Allow 1 generation + 1 regeneration per day (genCount < 2)
        const genCount = existingResult.Item.generationCount || 1;
        if (genCount >= 2) {
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
          sk: `DAILY_NUTRITION#${today}`,
          gsi1pk: 'DAILY_NUTRITION',
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
        InvocationType: 'Event',
        Payload: new TextEncoder().encode(JSON.stringify({
          __asyncNutritionGeneration: true,
          userSub: claims.sub,
          userTier: profile.tier,
          today,
        })),
      })
    );

    // 7. Return 202 immediately - frontend will poll GET /api/nutrition/today
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
    console.error('generateDailyNutrition error:', error);
    return serverError('Failed to generate daily nutrition plan');
  }
}

/**
 * Async background handler for nutrition plan generation.
 * Called via Lambda self-invocation (InvocationType: Event).
 */
export async function generateNutritionAsync(payload: {
  userSub: string;
  userTier: string;
  today: string;
}): Promise<void> {
  const { userSub, userTier, today } = payload;

  try {
    // Load user profile
    const profileResult = await client.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { pk: `USER#${userSub}`, sk: 'PROFILE' },
      })
    );
    const profile = profileResult.Item;
    if (!profile?.nutritionProfile) {
      console.error('generateNutritionAsync: no nutrition profile for', userSub);
      return;
    }

    // Check existing record for generation count
    const existingResult = await client.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { pk: `USER#${userSub}`, sk: `DAILY_NUTRITION#${today}` },
      })
    );
    const prevGenCount = existingResult.Item?.generationCount || 0;

    // Load today's workout + recent context in parallel
    const fourteenDaysAgo = daysAgo(14);
    const sevenDaysAgo = daysAgo(7);
    const [todayWorkoutResult, logsResult, nutritionPlansResult, mealLogsResult] = await Promise.all([
      client.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: { pk: `USER#${userSub}`, sk: `DAILY_WORKOUT#${today}` },
      })),
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
          ':prefix': 'DAILY_NUTRITION#',
        },
        ScanIndexForward: false,
        Limit: 7,
      })),
      client.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk AND sk BETWEEN :from AND :to',
        ExpressionAttributeValues: {
          ':pk': `USER#${userSub}`,
          ':from': `MEAL_LOG#${sevenDaysAgo}`,
          ':to': `MEAL_LOG#${new Date().toISOString()}~`,
        },
        ScanIndexForward: false,
      })),
    ]);

    const todayWorkout = todayWorkoutResult.Item || null;
    const recentLogs = logsResult.Items || [];
    const recentNutritionPlans = nutritionPlansResult.Items || [];
    const recentMealLogs = mealLogsResult.Items || [];

    // Build prompts
    const systemPrompt = buildNutritionSystemPrompt();
    const userPrompt = buildNutritionUserPrompt(
      profile.nutritionProfile,
      profile.fitnessProfile || null,
      todayWorkout,
      recentLogs,
      recentNutritionPlans,
      today,
      userTier,
      recentMealLogs
    );

    // Call Bedrock
    const result = await invokeClaude(systemPrompt, userPrompt, { maxTokens: 4096 });

    // Parse JSON from response
    let dailyNutrition: any;
    try {
      const parsed = JSON.parse(result.content);
      dailyNutrition = parsed.dailyNutrition || parsed;
    } catch {
      const jsonMatch = result.content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1].trim());
        dailyNutrition = parsed.dailyNutrition || parsed;
      } else {
        console.error('Failed to parse Bedrock response:', result.content.slice(0, 500));
        await client.send(new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            pk: `USER#${userSub}`,
            sk: `DAILY_NUTRITION#${today}`,
            gsi1pk: 'DAILY_NUTRITION',
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
    dailyNutrition.date = today;

    // Store in DynamoDB
    const item = {
      pk: `USER#${userSub}`,
      sk: `DAILY_NUTRITION#${today}`,
      gsi1pk: 'DAILY_NUTRITION',
      gsi1sk: `${today}#${userSub}`,
      ...dailyNutrition,
      status: 'ready',
      generatedAt: new Date().toISOString(),
      modelId: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
      tokenUsage: result.usage,
      generationCount: prevGenCount + 1,
    };

    await client.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
    console.log(`Nutrition plan generated for ${userSub} on ${today}`);
  } catch (error) {
    console.error('generateNutritionAsync error:', error);
    // Save error status
    await client.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: `USER#${userSub}`,
        sk: `DAILY_NUTRITION#${today}`,
        gsi1pk: 'DAILY_NUTRITION',
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
 * GET /api/nutrition/today - Get today's generated nutrition plan (authenticated)
 */
export async function getTodayNutrition(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const claims = extractClaims(event);
  if (!claims?.sub) return forbidden('Authentication required');

  try {
    const today = todayStr(event);
    const result = await client.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { pk: `USER#${claims.sub}`, sk: `DAILY_NUTRITION#${today}` },
      })
    );

    if (!result.Item) {
      return notFound('No nutrition plan generated for today');
    }

    return success(result.Item);
  } catch (error) {
    console.error('getTodayNutrition error:', error);
    return serverError('Failed to fetch today\'s nutrition plan');
  }
}

/**
 * GET /api/nutrition/history - List past daily nutrition plans (authenticated)
 */
export async function listNutritionHistory(
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
          ':prefix': 'DAILY_NUTRITION#',
        },
        ScanIndexForward: false,
        Limit: 30,
      })
    );

    return success({
      nutritionPlans: result.Items || [],
      count: (result.Items || []).length,
    });
  } catch (error) {
    console.error('listNutritionHistory error:', error);
    return serverError('Failed to fetch nutrition history');
  }
}

/**
 * GET /api/nutrition/{date} - Get a specific date's nutrition plan (authenticated)
 */
export async function getNutritionByDate(
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
        Key: { pk: `USER#${claims.sub}`, sk: `DAILY_NUTRITION#${date}` },
      })
    );

    if (!result.Item) {
      return notFound(`No nutrition plan found for ${date}`);
    }

    return success(result.Item);
  } catch (error) {
    console.error('getNutritionByDate error:', error);
    return serverError('Failed to fetch nutrition plan');
  }
}

/**
 * POST /api/nutrition/preview — Admin-only preview of nutrition prompts
 */
export async function previewNutritionPrompts(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (!isAdmin(event)) return forbidden('Admin access required');
  const claims = extractClaims(event);
  if (!claims?.sub) return forbidden('Authentication required');

  try {
    const today = todayStr(event);

    // Load profile
    const profileResult = await client.send(
      new GetCommand({ TableName: TABLE_NAME, Key: { pk: `USER#${claims.sub}`, sk: 'PROFILE' } })
    );
    const profile = profileResult.Item;
    const nutritionProfile = profile?.nutritionProfile || null;
    const fitnessProfile = profile?.fitnessProfile || null;
    const userTier = profile?.tier || 'Pup';

    // Load context in parallel
    const fourteenDaysAgo = daysAgo(14);
    const sevenDaysAgo = daysAgo(7);
    const [todayWorkoutResult, logsResult, nutritionPlansResult, mealLogsResult] = await Promise.all([
      client.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: { pk: `USER#${claims.sub}`, sk: `DAILY_WORKOUT#${today}` },
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
          ':prefix': 'DAILY_NUTRITION#',
        },
        ScanIndexForward: false,
        Limit: 7,
      })),
      client.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk AND sk BETWEEN :from AND :to',
        ExpressionAttributeValues: {
          ':pk': `USER#${claims.sub}`,
          ':from': `MEAL_LOG#${sevenDaysAgo}`,
          ':to': `MEAL_LOG#${new Date().toISOString()}~`,
        },
        ScanIndexForward: false,
      })),
    ]);

    const todayWorkout = todayWorkoutResult.Item || null;
    const recentLogs = logsResult.Items || [];
    const recentNutritionPlans = nutritionPlansResult.Items || [];
    const recentMealLogs = mealLogsResult.Items || [];

    // Build prompts
    const systemPrompt = buildNutritionSystemPrompt();
    const userPrompt = buildNutritionUserPrompt(
      nutritionProfile,
      fitnessProfile,
      todayWorkout,
      recentLogs,
      recentNutritionPlans,
      today,
      userTier,
      recentMealLogs
    );

    const estimatedTokens = Math.ceil((systemPrompt.length + userPrompt.length) / 4);

    return success({
      systemPrompt,
      userPrompt,
      estimatedTokens,
      contextStats: {
        hasNutritionProfile: !!nutritionProfile,
        hasFitnessProfile: !!fitnessProfile,
        todayWorkoutAvailable: !!(todayWorkout && todayWorkout.status === 'ready'),
        recentCompletionLogs: recentLogs.length,
        recentNutritionPlans: recentNutritionPlans.length,
        recentMealLogs: recentMealLogs.length,
        userTier,
      },
    });
  } catch (error) {
    console.error('previewNutritionPrompts error:', error);
    return serverError('Failed to generate nutrition prompt preview');
  }
}
