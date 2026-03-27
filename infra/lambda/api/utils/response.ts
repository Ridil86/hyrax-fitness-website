import type { APIGatewayProxyResult } from 'aws-lambda';

const ALLOWED_ORIGINS = [
  'https://hyraxfitness.com',
  'https://www.hyraxfitness.com',
  'http://localhost:5173',
];

let _requestOrigin: string | undefined;

export function setRequestOrigin(origin?: string): void {
  _requestOrigin = origin;
}

export function getCorsOrigin(requestOrigin?: string): string {
  const origin = requestOrigin ?? _requestOrigin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    return origin;
  }
  return ALLOWED_ORIGINS[0]; // default to production
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': getCorsOrigin(),
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  };
}

/** Remove internal DynamoDB fields before returning to client */
export function stripInternal<T extends Record<string, unknown>>(item: T): Omit<T, 'pk' | 'sk' | 'gsi1pk' | 'gsi1sk'> {
  const { pk, sk, gsi1pk, gsi1sk, ...rest } = item;
  return rest as Omit<T, 'pk' | 'sk' | 'gsi1pk' | 'gsi1sk'>;
}

export function stripInternalList<T extends Record<string, unknown>>(items: T[]): Omit<T, 'pk' | 'sk' | 'gsi1pk' | 'gsi1sk'>[] {
  return items.map(stripInternal);
}

export function success(body: unknown): APIGatewayProxyResult {
  return {
    statusCode: 200,
    headers: corsHeaders(),
    body: JSON.stringify(body),
  };
}

export function created(body: unknown): APIGatewayProxyResult {
  return {
    statusCode: 201,
    headers: corsHeaders(),
    body: JSON.stringify(body),
  };
}

export function badRequest(message: string): APIGatewayProxyResult {
  return {
    statusCode: 400,
    headers: corsHeaders(),
    body: JSON.stringify({ error: message }),
  };
}

export function forbidden(message = 'Forbidden'): APIGatewayProxyResult {
  return {
    statusCode: 403,
    headers: corsHeaders(),
    body: JSON.stringify({ error: message }),
  };
}

export function notFound(message = 'Not found'): APIGatewayProxyResult {
  return {
    statusCode: 404,
    headers: corsHeaders(),
    body: JSON.stringify({ error: message }),
  };
}

export function serverError(message = 'Internal server error'): APIGatewayProxyResult {
  return {
    statusCode: 500,
    headers: corsHeaders(),
    body: JSON.stringify({ error: message }),
  };
}
