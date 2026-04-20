import { apiPost } from './client';

/**
 * Get a presigned POST payload for uploading to S3.
 * Returns: { uploadUrl, uploadFields, key, publicUrl, maxBytes }
 */
export async function getPresignedUrl(filename, contentType, token) {
  return apiPost('/api/upload', { filename, contentType }, token);
}

async function uploadToPresignedPost(presigned, file) {
  const form = new FormData();
  for (const [k, v] of Object.entries(presigned.uploadFields || {})) {
    form.append(k, v);
  }
  // S3 requires the file field last.
  form.append('file', file);

  const res = await fetch(presigned.uploadUrl, { method: 'POST', body: form });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Upload failed (${res.status}): ${text.slice(0, 200)}`);
  }
}

/**
 * Upload a file via the admin upload endpoint.
 */
export async function uploadFile(file, token) {
  const presigned = await getPresignedUrl(file.name, file.type, token);
  if (presigned.maxBytes && file.size > presigned.maxBytes) {
    throw new Error(
      `File is larger than the ${Math.round(presigned.maxBytes / (1024 * 1024))}MB limit`
    );
  }
  await uploadToPresignedPost(presigned, file);
  return { key: presigned.key, publicUrl: presigned.publicUrl };
}

/**
 * Get a presigned POST payload for user uploads (images only).
 */
export async function getUserPresignedUrl(filename, contentType, token) {
  return apiPost('/api/user-upload', { filename, contentType }, token);
}

/**
 * Upload an image via the authenticated-user upload endpoint.
 */
export async function uploadUserFile(file, token) {
  const presigned = await getUserPresignedUrl(file.name, file.type, token);
  if (presigned.maxBytes && file.size > presigned.maxBytes) {
    throw new Error(
      `Image is larger than the ${Math.round(presigned.maxBytes / (1024 * 1024))}MB limit`
    );
  }
  await uploadToPresignedPost(presigned, file);
  return { key: presigned.key, publicUrl: presigned.publicUrl };
}
