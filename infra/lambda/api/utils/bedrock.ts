import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const client = new BedrockRuntimeClient({ region: 'us-east-1' });
const MODEL_ID = 'us.anthropic.claude-sonnet-4-20250514';

interface InvokeResult {
  content: string;
  usage: { inputTokens: number; outputTokens: number };
}

/**
 * Invoke Claude on Bedrock with a system prompt and user prompt.
 * Returns the text content and token usage.
 */
export async function invokeClaude(
  systemPrompt: string,
  userPrompt: string,
  options?: { maxTokens?: number }
): Promise<InvokeResult> {
  const maxTokens = options?.maxTokens || 4096;

  const body = JSON.stringify({
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [
      { role: 'user', content: userPrompt },
    ],
  });

  const command = new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: new TextEncoder().encode(body),
  });

  const response = await client.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));

  const text = responseBody.content?.[0]?.text || '';
  const usage = {
    inputTokens: responseBody.usage?.input_tokens || 0,
    outputTokens: responseBody.usage?.output_tokens || 0,
  };

  return { content: text, usage };
}
