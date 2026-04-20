import { S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { success, badRequest, serverError } from '../utils/response';
import { isAdmin } from '../utils/auth';
import { randomUUID } from 'crypto';
import {
  ALLOWED_UPLOAD_TYPES,
  extensionMatchesContentType,
  extensionForContentType,
} from '../utils/uploadPolicy';

const s3 = new S3Client({});
const BUCKET_NAME = process.env.BUCKET_NAME!;
const CDN_DOMAIN = process.env.CDN_DOMAIN;

// Per-type maximum sizes for admin uploads (bytes)
const ADMIN_SIZE_LIMITS: Record<string, number> = {
  'image/jpeg': 10 * 1024 * 1024,
  'image/png': 10 * 1024 * 1024,
  'image/webp': 10 * 1024 * 1024,
  'image/gif': 10 * 1024 * 1024,
  'image/svg+xml': 2 * 1024 * 1024,
  'application/pdf': 20 * 1024 * 1024,
  'video/mp4': 500 * 1024 * 1024,
  'video/webm': 500 * 1024 * 1024,
  'video/quicktime': 500 * 1024 * 1024,
};

/**
 * POST /api/upload - Generate a presigned POST for S3 upload (admin).
 * Returns { uploadUrl, uploadFields, key, publicUrl }. The client submits a
 * multipart/form-data POST to uploadUrl, including every uploadFields entry
 * as a form field and the file as the last "file" field.
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

    const contentType = String(body.contentType);
    if (!ALLOWED_UPLOAD_TYPES.has(contentType)) {
      return badRequest(`Invalid content type: ${contentType}`);
    }

    const filename = String(body.filename);
    if (!extensionMatchesContentType(filename, contentType)) {
      return badRequest('filename extension does not match contentType');
    }

    const max = ADMIN_SIZE_LIMITS[contentType];
    if (!max) return badRequest('No size policy for this contentType');

    const isVideo = contentType.startsWith('video/');
    const prefix = isVideo ? 'uploads/videos' : 'uploads';
    const ext = extensionForContentType(contentType);
    const key = `${prefix}/${randomUUID()}.${ext}`;
    const expires = isVideo ? 3600 : 300;

    const presigned = await createPresignedPost(s3, {
      Bucket: BUCKET_NAME,
      Key: key,
      Conditions: [
        ['content-length-range', 1, max],
        ['eq', '$Content-Type', contentType],
      ],
      Fields: { 'Content-Type': contentType },
      Expires: expires,
    });

    const publicUrl = CDN_DOMAIN
      ? `https://${CDN_DOMAIN}/${key}`
      : `https://${BUCKET_NAME}.s3.amazonaws.com/${key}`;

    return success({
      uploadUrl: presigned.url,
      uploadFields: presigned.fields,
      key,
      publicUrl,
      maxBytes: max,
    });
  } catch (error) {
    console.error('getUploadUrl error:', error);
    return serverError('Failed to generate upload URL');
  }
}
