import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, badRequest, forbidden, serverError } from '../utils/response';
import { extractClaims, isAdmin } from '../utils/auth';
import { invokeClaude } from '../utils/bedrock';
import { getEffectiveTier } from '../utils/trial';
import {
  loadExercises, loadWorkouts, loadEquipment,
  loadUserCompletionLogs, loadUserMealLogs,
  loadTodayWorkout, loadTodayNutrition, loadUserProfile,
  buildExerciseCatalogText, buildWorkoutCatalogText, buildEquipmentCatalogText,
  formatCompletionLogsSummary, formatMealLogsSummary,
} from '../utils/catalog';
import { randomUUID } from 'crypto';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.TABLE_NAME!;

const TIER_RANK: Record<string, number> = { 'Pup': 1, 'Rock Runner': 2, 'Iron Dassie': 3 };
function hasTierAccess(userTier: string, requiredTier: string): boolean {
  return (TIER_RANK[userTier] || 0) >= (TIER_RANK[requiredTier] || 0);
}

const MAX_MESSAGES_PER_DAY = 20;

/**
 * Build the chat system prompt with full user context.
 */
function buildChatSystemPrompt(
  userName: string,
  fp: any,
  np: any,
  exerciseItems: any[],
  workoutItems: any[],
  equipmentItems: any[],
  todayWorkout: any,
  todayNutrition: any,
  completionLogs: any[],
  mealLogs: any[]
): string {
  let p = `You are the Hyrax Fitness Personal Coach for ${userName}. You are a knowledgeable training partner who gives direct, confident, actionable advice.

## FORMATTING RULES (CRITICAL)
- NEVER use em-dashes or en-dashes. Use hyphens (-) only.
- NEVER use emojis or Unicode symbols. Use plain ASCII text only.
- Do NOT start responses with "Great question!", "That's a great point!", "Absolutely!", or similar sycophantic openers.
- Do NOT be patronizing or overly enthusiastic. Be direct and helpful like a knowledgeable training partner.
- Use "you" naturally. Be personable without being performative.
- Keep responses concise (2-4 sentences) unless the user asks for detailed explanations.
- When giving lists, use plain hyphens for bullets.

## HYRAX FITNESS PHILOSOPHY
Hyrax Fitness is built around the Forage-Bask cycle - a nature-inspired training methodology emphasizing functional, outdoor-ready fitness. "Forage" represents the training effort (high-intensity, functional movements). "Bask" represents recovery (cooldown, stretching, reflection). Every workout follows this cycle. Training emphasizes real-world strength, loaded carries, bodyweight mastery, and metabolic conditioning. All exercises use Hyrax signature names.

## EXERCISE CATALOG
These are the official Hyrax Fitness exercises. Reference ONLY these when discussing exercises:
${buildExerciseCatalogText(exerciseItems)}

## WORKOUT TEMPLATES
${buildWorkoutCatalogText(workoutItems)}

## EQUIPMENT CATALOG
${buildEquipmentCatalogText(equipmentItems)}

## USER FITNESS PROFILE
`;

  if (fp) {
    p += `Experience: ${fp.experienceLevel || 'intermediate'}\n`;
    p += `Goals: ${(fp.fitnessGoals || []).join(', ')}\n`;
    p += `Days/Week: ${fp.daysPerWeek || '?'}\n`;
    p += `Preferred Duration: ${fp.preferredDuration || '?'} min\n`;
    p += `Intensity: ${fp.intensity || '?'}\n`;
    p += `Environment: ${fp.environment || '?'}\n`;
    p += `Available Equipment: ${(fp.availableEquipment || []).join(', ') || 'Unknown'}\n`;
    p += `Indoor/Outdoor: ${fp.indoorOutdoor || '?'}\n`;
    p += `Time of Day: ${fp.timeOfDay || '?'}\n`;
    p += `Location: ${fp.city || ''}, ${fp.region || ''}\n`;
    p += `Limitations: ${(fp.limitations || []).filter((l: string) => l !== 'none').join(', ') || 'None'}\n`;
    if (fp.injuries) p += `Injuries/Notes: ${fp.injuries}\n`;
    if (fp.focusAreas?.length) p += `Focus Areas: ${fp.focusAreas.join(', ')}\n`;
    if (fp.age) p += `Age: ${fp.age}\n`;
  } else {
    p += `No fitness profile completed yet.\n`;
  }

  if (np) {
    p += `\n## USER NUTRITION PROFILE\n`;
    if (np.allergies?.length) p += `ALLERGIES (CRITICAL - never suggest foods containing these): ${np.allergies.join(', ')}\n`;
    if (np.dietaryRestrictions?.length) p += `Dietary Restrictions: ${np.dietaryRestrictions.join(', ')}\n`;
    if (np.caloricGoal) p += `Caloric Goal: ${np.caloricGoal}\n`;
    if (np.macroPreference) p += `Macro Preference: ${np.macroPreference}\n`;
    if (np.mealsPerDay) p += `Meals/Day: ${np.mealsPerDay}\n`;
    if (np.cookingSkill) p += `Cooking Skill: ${np.cookingSkill}\n`;
    if (np.supplements?.length) p += `Supplements: ${np.supplements.join(', ')}\n`;
  }

  if (todayWorkout && todayWorkout.status === 'ready') {
    p += `\n## TODAY'S WORKOUT\n`;
    p += `Title: ${todayWorkout.title}\nType: ${todayWorkout.type || 'training'}\nDuration: ${todayWorkout.duration}\n`;
    p += `Focus: ${(todayWorkout.focus || []).join(', ')}\n`;
    p += `Exercises: ${(todayWorkout.exercises || []).map((e: any) => `${e.exerciseName} (${e.sets}x${e.reps})`).join(', ')}\n`;
  }

  if (todayNutrition && todayNutrition.status === 'ready') {
    p += `\n## TODAY'S NUTRITION PLAN\n`;
    p += `Title: ${todayNutrition.title}\nCalories: ${todayNutrition.totalCalories}\n`;
    if (todayNutrition.macros) p += `Macros: P:${todayNutrition.macros.protein} C:${todayNutrition.macros.carbs} F:${todayNutrition.macros.fat}\n`;
    p += `Meals: ${(todayNutrition.meals || []).map((m: any) => `${m.name} (${m.calories} cal)`).join(', ')}\n`;
  }

  p += `\n## RECENT WORKOUT HISTORY (14 days)\n${formatCompletionLogsSummary(completionLogs, 14)}`;
  p += `\n\n## RECENT MEAL HISTORY (7 days)\n${formatMealLogsSummary(mealLogs, 7)}`;

  p += `\n\n## BEHAVIOR RULES
- Answer questions about training, form, exercise modifications, nutrition, recovery, and Hyrax methodology.
- When discussing exercises, ONLY reference Hyrax Fitness exercises from the catalog above using official names.
- When giving form cues or modifications, reference the specific modification level data from the catalog.
- Use the user's recent training and meal history to give personalized advice.
- If asked about nutrition, reference their nutrition profile and recent meal data.
- If asked about something outside fitness/nutrition/recovery, politely redirect.
- Never recommend exercises or workouts that conflict with the user's listed injuries or limitations.
- Keep responses focused and practical. Avoid filler.`;

  return p;
}

/**
 * POST /api/chat — Send a message to the AI training assistant (Iron Dassie only)
 */
export async function sendChatMessage(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const claims = extractClaims(event);
  if (!claims?.sub) return forbidden('Authentication required');

  try {
    const body = JSON.parse(event.body || '{}');
    const message = (body.message || '').trim();
    if (!message) return badRequest('Message is required');
    if (message.length > 2000) return badRequest('Message too long (max 2000 characters)');

    // Load profile + tier check
    const profileResult = await client.send(
      new GetCommand({ TableName: TABLE_NAME, Key: { pk: `USER#${claims.sub}`, sk: 'PROFILE' } })
    );
    const profile = profileResult.Item;
    if (!profile) return serverError('Profile not found');
    if (!hasTierAccess(getEffectiveTier(profile), 'Iron Dassie')) {
      return forbidden('Personal Coach chat is available for Iron Dassie members only');
    }

    // Rate limit: count today's messages
    const today = new Date().toISOString().slice(0, 10);
    const countResult = await client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk AND sk BETWEEN :from AND :to',
        ExpressionAttributeValues: {
          ':pk': `USER#${claims.sub}`,
          ':from': `CHAT#${today}`,
          ':to': `CHAT#${today}~`,
        },
        Select: 'COUNT',
      })
    );
    if ((countResult.Count || 0) >= MAX_MESSAGES_PER_DAY * 2) { // *2 for user+assistant pairs
      return badRequest(`Daily message limit reached (${MAX_MESSAGES_PER_DAY} messages/day)`);
    }

    // Load all context in parallel
    const [
      userProfile, todayWorkout, todayNutrition,
      exerciseItems, workoutItems, equipmentItems,
      completionLogs, mealLogs, chatHistoryResult,
    ] = await Promise.all([
      loadUserProfile(claims.sub),
      loadTodayWorkout(claims.sub, today),
      loadTodayNutrition(claims.sub, today),
      loadExercises(),
      loadWorkouts(),
      loadEquipment(),
      loadUserCompletionLogs(claims.sub, 14),
      loadUserMealLogs(claims.sub, 7),
      client.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
        ExpressionAttributeValues: {
          ':pk': `USER#${claims.sub}`,
          ':prefix': `CHAT#${today}`,
        },
        ScanIndexForward: true,
        Limit: 20,
      })),
    ]);
    const chatHistory = chatHistoryResult.Items || [];
    const fp = userProfile?.fitnessProfile || profile?.fitnessProfile;
    const np = userProfile?.nutritionProfile || profile?.nutritionProfile;
    const userName = [
      userProfile?.givenName || profile?.givenName,
      userProfile?.familyName || profile?.familyName,
    ].filter(Boolean).join(' ') || 'athlete';

    // Build comprehensive system prompt using extracted helper
    const systemPrompt = buildChatSystemPrompt(
      userName, fp, np, exerciseItems, workoutItems, equipmentItems,
      todayWorkout, todayNutrition, completionLogs, mealLogs
    );

    // Build messages array including history
    const messages: Array<{ role: string; content: string }> = [];
    for (const item of chatHistory) {
      messages.push({ role: item.role, content: item.content });
    }
    messages.push({ role: 'user', content: message });

    // Call Bedrock with conversation history
    const bedrockBody = JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    // Use raw Bedrock call to pass full conversation
    const { BedrockRuntimeClient, InvokeModelCommand } = await import('@aws-sdk/client-bedrock-runtime');
    const bedrockClient = new BedrockRuntimeClient({ region: 'us-east-1' });
    const response = await bedrockClient.send(new InvokeModelCommand({
      modelId: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: new TextEncoder().encode(bedrockBody),
    }));
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const assistantMessage = responseBody.content?.[0]?.text || 'I couldn\'t generate a response. Please try again.';

    // Store both user and assistant messages
    const now = new Date().toISOString();
    const userMsgId = randomUUID().slice(0, 8);
    const assistantMsgId = randomUUID().slice(0, 8);

    await Promise.all([
      client.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          pk: `USER#${claims.sub}`,
          sk: `CHAT#${now}#${userMsgId}`,
          role: 'user',
          content: message,
          createdAt: now,
        },
      })),
      client.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          pk: `USER#${claims.sub}`,
          sk: `CHAT#${new Date(Date.now() + 1).toISOString()}#${assistantMsgId}`,
          gsi1pk: 'CHAT_MESSAGE',
          gsi1sk: `${now}#${claims.sub}`,
          role: 'assistant',
          content: assistantMessage,
          createdAt: new Date(Date.now() + 1).toISOString(),
          tokenUsage: responseBody.usage || null,
          modelId: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
        },
      })),
    ]);

    return success({
      response: assistantMessage,
      usage: responseBody.usage,
    });
  } catch (error) {
    console.error('sendChatMessage error:', error);
    return serverError('Failed to process chat message');
  }
}

/**
 * GET /api/chat/history — Get today's chat history (Iron Dassie only)
 */
export async function getChatHistory(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const claims = extractClaims(event);
  if (!claims?.sub) return forbidden('Authentication required');

  try {
    // Load profile for tier check
    const profileResult = await client.send(
      new GetCommand({ TableName: TABLE_NAME, Key: { pk: `USER#${claims.sub}`, sk: 'PROFILE' } })
    );
    if (!hasTierAccess(profileResult.Item?.tier || 'Pup', 'Iron Dassie')) {
      return forbidden('Personal Coach chat is available for Iron Dassie members only');
    }

    const today = new Date().toISOString().slice(0, 10);
    const result = await client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk AND sk BETWEEN :from AND :to',
        ExpressionAttributeValues: {
          ':pk': `USER#${claims.sub}`,
          ':from': `CHAT#${today}`,
          ':to': `CHAT#${today}~`,
        },
        ScanIndexForward: true,
        Limit: 50,
      })
    );

    const messages = (result.Items || []).map((item: any) => ({
      role: item.role,
      content: item.content,
      createdAt: item.createdAt,
    }));

    return success({ messages, count: messages.length });
  } catch (error) {
    console.error('getChatHistory error:', error);
    return serverError('Failed to fetch chat history');
  }
}

/**
 * POST /api/chat/preview — Admin-only preview of chat system prompt
 */
export async function previewChatPrompts(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (!isAdmin(event)) return forbidden('Admin access required');
  const claims = extractClaims(event);
  if (!claims?.sub) return forbidden('Authentication required');

  try {
    const today = new Date().toISOString().slice(0, 10);

    // Load all context (same as sendChatMessage)
    const [
      userProfile, todayWorkout, todayNutrition,
      exerciseItems, workoutItems, equipmentItems,
      completionLogs, mealLogs, chatHistoryResult,
    ] = await Promise.all([
      loadUserProfile(claims.sub),
      loadTodayWorkout(claims.sub, today),
      loadTodayNutrition(claims.sub, today),
      loadExercises(),
      loadWorkouts(),
      loadEquipment(),
      loadUserCompletionLogs(claims.sub, 14),
      loadUserMealLogs(claims.sub, 7),
      client.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
        ExpressionAttributeValues: {
          ':pk': `USER#${claims.sub}`,
          ':prefix': `CHAT#${today}`,
        },
        ScanIndexForward: true,
        Limit: 20,
      })),
    ]);

    const chatHistory = chatHistoryResult.Items || [];
    const fp = userProfile?.fitnessProfile;
    const np = userProfile?.nutritionProfile;
    const userName = [userProfile?.givenName, userProfile?.familyName].filter(Boolean).join(' ') || 'athlete';

    const systemPrompt = buildChatSystemPrompt(
      userName, fp, np, exerciseItems, workoutItems, equipmentItems,
      todayWorkout, todayNutrition, completionLogs, mealLogs
    );

    const estimatedTokens = Math.ceil(systemPrompt.length / 4);

    return success({
      systemPrompt,
      userPrompt: '(Conversational - user prompt varies per message)',
      estimatedTokens,
      contextStats: {
        exercises: exerciseItems.length,
        workouts: workoutItems.length,
        equipment: equipmentItems.length,
        hasFitnessProfile: !!fp,
        hasNutritionProfile: !!np,
        todayWorkoutAvailable: !!(todayWorkout && todayWorkout.status === 'ready'),
        todayNutritionAvailable: !!(todayNutrition && todayNutrition.status === 'ready'),
        recentCompletionLogs: completionLogs.length,
        recentMealLogs: mealLogs.length,
        todayChatMessages: chatHistory.length,
      },
    });
  } catch (error) {
    console.error('previewChatPrompts error:', error);
    return serverError('Failed to generate chat prompt preview');
  }
}
