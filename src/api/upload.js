import { apiPost } from './client';

/**
 * Get a pre-signed URL for uploading an image to S3.
 * Returns: { uploadUrl, key, publicUrl }
 */
export async function getPresignedUrl(filename, contentType, token) {
  return apiPost('/api/upload', { filename, contentType }, token);
}

/**
 * Upload a file to S3 using a pre-signed URL.
 */
export async function uploadFile(file, token) {
  const { uploadUrl, key, publicUrl } = await getPresignedUrl(
    file.name,
    file.type,
    token
  );

  await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  });

  return { key, publicUrl };
}
