import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const client = new BedrockRuntimeClient({ region: 'us-east-1' });
const MODEL_ID = 'us.anthropic.claude-haiku-4-5-20251001-v1:0';
const MAX_RETRIES = 3;

interface InvokeResult {
  content: string;
  usage: { inputTokens: number; outputTokens: number };
}

/**
 * Invoke Claude on Bedrock with a system prompt and user prompt.
 * Retries up to MAX_RETRIES times on transient errors (ResourceNotFoundException
 * from cross-region inference routing to a region without model access).
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

  let lastError: any;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await client.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));

      const text = responseBody.content?.[0]?.text || '';
      const usage = {
        inputTokens: responseBody.usage?.input_tokens || 0,
        outputTokens: responseBody.usage?.output_tokens || 0,
      };

      return { content: text, usage };
    } catch (error: any) {
      lastError = error;
      const isRetryable =
        error.name === 'ResourceNotFoundException' ||
        error.name === 'ThrottlingException' ||
        error.name === 'ServiceUnavailableException' ||
        error.$metadata?.httpStatusCode === 429 ||
        error.$metadata?.httpStatusCode === 503;

      if (isRetryable && attempt < MAX_RETRIES) {
        const delay = 1000 * attempt; // 1s, 2s backoff
        console.warn(`Bedrock attempt ${attempt} failed (${error.name}), retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw error;
    }
  }

  throw lastError;
}
