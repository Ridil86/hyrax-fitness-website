import type { APIGatewayProxyResult } from 'aws-lambda';

const ALLOWED_ORIGINS = [
  'https://hyraxfitness.com',
  'https://www.hyraxfitness.com',
  'http://localhost:5173',
];

export function getCorsOrigin(requestOrigin?: string): string {
  if (requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)) {
    return requestOrigin;
  }
  return ALLOWED_ORIGINS[0]; // default to production
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS[0],
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
};

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
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

export function created(body: unknown): APIGatewayProxyResult {
  return {
    statusCode: 201,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

export function badRequest(message: string): APIGatewayProxyResult {
  return {
    statusCode: 400,
    headers: CORS_HEADERS,
    body: JSON.stringify({ error: message }),
  };
}

export function forbidden(message = 'Forbidden'): APIGatewayProxyResult {
  return {
    statusCode: 403,
    headers: CORS_HEADERS,
    body: JSON.stringify({ error: message }),
  };
}

export function notFound(message = 'Not found'): APIGatewayProxyResult {
  return {
    statusCode: 404,
    headers: CORS_HEADERS,
    body: JSON.stringify({ error: message }),
  };
}

export function serverError(message = 'Internal server error'): APIGatewayProxyResult {
  return {
    statusCode: 500,
    headers: CORS_HEADERS,
    body: JSON.stringify({ error: message }),
  };
}
