import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, badRequest, serverError } from '../utils/response';
import { extractClaims } from '../utils/auth';
import { randomUUID } from 'crypto';

const s3 = new S3Client({});
const BUCKET_NAME = process.env.BUCKET_NAME!;
const CDN_DOMAIN = process.env.CDN_DOMAIN;

/**
 * POST /api/user-upload - Generate a pre-signed URL for client user uploads
 * Any authenticated user. Images only.
 * Body: { filename: string, contentType: string }
 */
export async function getUserUploadUrl(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const claims = extractClaims(event);
  if (!claims) return badRequest('Authentication required');

  try {
    const body = JSON.parse(event.body || '{}');
    if (!body.filename || !body.contentType) {
      return badRequest('filename and contentType are required');
    }

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
    ];
    if (!allowedTypes.includes(body.contentType)) {
      return badRequest(
        `Invalid content type. Allowed: ${allowedTypes.join(', ')}`
      );
    }

    const ext = body.filename.split('.').pop() || 'jpg';
    const key = `uploads/user/${randomUUID()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: body.contentType,
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

    const publicUrl = CDN_DOMAIN
      ? `https://${CDN_DOMAIN}/${key}`
      : `https://${BUCKET_NAME}.s3.amazonaws.com/${key}`;

    return success({ uploadUrl, key, publicUrl });
  } catch (error) {
    console.error('getUserUploadUrl error:', error);
    return serverError('Failed to generate upload URL');
  }
}
