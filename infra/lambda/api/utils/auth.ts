import type { APIGatewayProxyEvent } from 'aws-lambda';

export interface CognitoClaims {
  sub: string;
  email: string;
  groups: string[];
  given_name?: string;
  family_name?: string;
  [key: string]: unknown;
}

/**
 * Extract Cognito claims from the API Gateway event.
 * The Cognito authorizer places claims in requestContext.authorizer.claims.
 */
export function extractClaims(event: APIGatewayProxyEvent): CognitoClaims | null {
  const claims = event.requestContext?.authorizer?.claims;
  if (!claims) return null;

  const groupsRaw = claims['cognito:groups'] || '';
  const groups = typeof groupsRaw === 'string' && groupsRaw.length > 0
    ? groupsRaw.split(',').map((g: string) => g.trim())
    : [];

  return {
    sub: claims.sub || '',
    email: claims.email || '',
    groups,
    given_name: claims.given_name || undefined,
    family_name: claims.family_name || undefined,
  };
}

/**
 * Check if the authenticated user is in the Admin group.
 */
export function isAdmin(event: APIGatewayProxyEvent): boolean {
  const claims = extractClaims(event);
  return claims ? claims.groups.includes('Admin') : false;
}
