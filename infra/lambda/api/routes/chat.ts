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
import { randomUUID } from 'crypto';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.TABLE_NAME!;

const TIER_RANK: Record<string, number> = { 'Pup': 1, 'Rock Runner': 2, 'Iron Dassie': 3 };
function hasTierAccess(userTier: string, requiredTier: string): boolean {
  return (TIER_RANK[userTier] || 0) >= (TIER_RANK[requiredTier] || 0);
}

const MAX_MESSAGES_PER_DAY = 20;

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
    if (!hasTierAccess(profile.tier || 'Pup', 'Iron Dassie')) {
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

    // Load context: today's workout + fitness profile
    const todayWorkoutResult = await client.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { pk: `USER#${claims.sub}`, sk: `DAILY_WORKOUT#${today}` },
      })
    );

    // Load recent chat history for conversation continuity
    const historyResult = await client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
        ExpressionAttributeValues: {
          ':pk': `USER#${claims.sub}`,
          ':prefix': `CHAT#${today}`,
        },
        ScanIndexForward: true,
        Limit: 20,
      })
    );
    const chatHistory = historyResult.Items || [];

    // Build system prompt
    const userName = [profile.givenName, profile.familyName].filter(Boolean).join(' ') || 'athlete';
    const fp = profile.fitnessProfile;
    let systemPrompt = `You are the Hyrax Fitness Personal Coach for ${userName}. You are a knowledgeable, encouraging, and concise personal training assistant.\n\n`;
    systemPrompt += `## User Context\n`;
    if (fp) {
      systemPrompt += `Experience: ${fp.experienceLevel || 'intermediate'}\n`;
      systemPrompt += `Goals: ${(fp.fitnessGoals || []).join(', ')}\n`;
      systemPrompt += `Limitations: ${(fp.limitations || []).filter((l: string) => l !== 'none').join(', ') || 'None'}\n`;
      if (fp.injuries) systemPrompt += `Injuries: ${fp.injuries}\n`;
    }

    const todayWorkout = todayWorkoutResult.Item;
    if (todayWorkout) {
      systemPrompt += `\n## Today's Workout\n`;
      systemPrompt += `Title: ${todayWorkout.title}\n`;
      systemPrompt += `Duration: ${todayWorkout.duration}\n`;
      systemPrompt += `Exercises: ${(todayWorkout.exercises || []).map((e: any) => e.exerciseName).join(', ')}\n`;
    }

    systemPrompt += `\n## Rules\n`;
    systemPrompt += `- Be concise and actionable (2-3 sentences unless more detail is asked for)\n`;
    systemPrompt += `- Answer questions about training, form, modifications, nutrition timing, and recovery\n`;
    systemPrompt += `- Stay in the context of fitness and the Hyrax training methodology\n`;
    systemPrompt += `- If the user's question is unrelated to fitness, politely redirect\n`;

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
      modelId: 'us.anthropic.claude-sonnet-4-20250514',
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
          role: 'assistant',
          content: assistantMessage,
          createdAt: new Date(Date.now() + 1).toISOString(),
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
