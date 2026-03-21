import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, badRequest, serverError } from '../utils/response';
import { isAdmin } from '../utils/auth';
import { randomUUID } from 'crypto';

const s3 = new S3Client({});
const BUCKET_NAME = process.env.BUCKET_NAME!;
const CDN_DOMAIN = process.env.CDN_DOMAIN;

/**
 * POST /api/upload - Generate a pre-signed URL for S3 upload
 * Body: { filename: string, contentType: string }
 */
export async function getUploadUrl(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (!isAdmin(event)) return badRequest('Admin access required');

  try {
    const body = JSON.parse(event.body || '{}');
    if (!body.filename || !body.contentType) {
      return badRequest('filename and contentType are required');
    }

    // Validate content type
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/svg+xml',
      'application/pdf',
      'video/mp4',
      'video/webm',
      'video/quicktime',
    ];
    if (!allowedTypes.includes(body.contentType)) {
      return badRequest(
        `Invalid content type. Allowed: ${allowedTypes.join(', ')}`
      );
    }

    // Generate unique key - organize videos in a separate prefix
    const ext = body.filename.split('.').pop() || 'jpg';
    const isVideo = body.contentType.startsWith('video/');
    const prefix = isVideo ? 'uploads/videos' : 'uploads';
    const key = `${prefix}/${randomUUID()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: body.contentType,
    });

    // Longer expiry for video uploads (1 hour vs 5 minutes)
    const expiresIn = isVideo ? 3600 : 300;
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn });

    // Public read URL via CloudFront CDN (falls back to S3 URL if CDN not configured)
    const publicUrl = CDN_DOMAIN
      ? `https://${CDN_DOMAIN}/${key}`
      : `https://${BUCKET_NAME}.s3.amazonaws.com/${key}`;

    return success({
      uploadUrl,
      key,
      publicUrl,
    });
  } catch (error) {
    console.error('getUploadUrl error:', error);
    return serverError('Failed to generate upload URL');
  }
}
