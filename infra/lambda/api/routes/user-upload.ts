import { S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, badRequest, serverError } from '../utils/response';
import { extractClaims } from '../utils/auth';
import { checkRateLimit } from '../utils/rateLimit';
import { randomUUID } from 'crypto';
import {
  extensionMatchesContentType,
  extensionForContentType,
} from '../utils/uploadPolicy';

const s3 = new S3Client({});
const BUCKET_NAME = process.env.BUCKET_NAME!;
const CDN_DOMAIN = process.env.CDN_DOMAIN;

// Images only for client portal uploads (support tickets, community posts).
const USER_ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const USER_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

/**
 * POST /api/user-upload - Presigned POST for any authenticated user (images only).
 */
export async function getUserUploadUrl(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const claims = extractClaims(event);
  if (!claims) return badRequest('Authentication required');

  try {
    if (!(await checkRateLimit(`USER_UPLOAD#${claims.sub}`, 50, 3600))) {
      return badRequest('Rate limit exceeded: 50 uploads per hour');
    }

    const body = JSON.parse(event.body || '{}');
    if (!body.filename || !body.contentType) {
      return badRequest('filename and contentType are required');
    }

    const contentType = String(body.contentType);
    if (!USER_ALLOWED_TYPES.has(contentType)) {
      return badRequest(`Invalid content type: ${contentType}`);
    }

    const filename = String(body.filename);
    if (!extensionMatchesContentType(filename, contentType)) {
      return badRequest('filename extension does not match contentType');
    }

    const ext = extensionForContentType(contentType);
    // Scope the key under the user's sub so uploads can't trample each other.
    const key = `uploads/user/${claims.sub}/${randomUUID()}.${ext}`;

    const presigned = await createPresignedPost(s3, {
      Bucket: BUCKET_NAME,
      Key: key,
      Conditions: [
        ['content-length-range', 1, USER_IMAGE_MAX_BYTES],
        ['eq', '$Content-Type', contentType],
      ],
      Fields: { 'Content-Type': contentType },
      Expires: 300,
    });

    const publicUrl = CDN_DOMAIN
      ? `https://${CDN_DOMAIN}/${key}`
      : `https://${BUCKET_NAME}.s3.amazonaws.com/${key}`;

    return success({
      uploadUrl: presigned.url,
      uploadFields: presigned.fields,
      key,
      publicUrl,
      maxBytes: USER_IMAGE_MAX_BYTES,
    });
  } catch (error) {
    console.error('getUserUploadUrl error:', error);
    return serverError('Failed to generate upload URL');
  }
}
