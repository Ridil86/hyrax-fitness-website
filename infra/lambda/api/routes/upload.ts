import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, badRequest, serverError } from '../utils/response';
import { isAdmin } from '../utils/auth';
import { randomUUID } from 'crypto';

const s3 = new S3Client({});
const BUCKET_NAME = process.env.BUCKET_NAME!;

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
    ];
    if (!allowedTypes.includes(body.contentType)) {
      return badRequest(
        `Invalid content type. Allowed: ${allowedTypes.join(', ')}`
      );
    }

    // Generate unique key
    const ext = body.filename.split('.').pop() || 'jpg';
    const key = `uploads/${randomUUID()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: body.contentType,
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

    // Public read URL (will use CloudFront or S3 URL)
    const publicUrl = `https://${BUCKET_NAME}.s3.amazonaws.com/${key}`;

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
