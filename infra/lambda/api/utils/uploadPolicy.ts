/**
 * Shared content-type / extension policy for upload endpoints.
 */

export const ALLOWED_UPLOAD_TYPES = new Set<string>([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'application/pdf',
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

const CONTENT_TYPE_EXTENSIONS: Record<string, readonly string[]> = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
  'image/gif': ['gif'],
  'image/svg+xml': ['svg'],
  'application/pdf': ['pdf'],
  'video/mp4': ['mp4'],
  'video/webm': ['webm'],
  'video/quicktime': ['mov', 'qt'],
};

export function extensionForContentType(contentType: string): string {
  return CONTENT_TYPE_EXTENSIONS[contentType]?.[0] || 'bin';
}

export function extensionMatchesContentType(
  filename: string,
  contentType: string
): boolean {
  const allowed = CONTENT_TYPE_EXTENSIONS[contentType];
  if (!allowed) return false;
  const ext = filename.split('.').pop()?.toLowerCase();
  if (!ext) return false;
  return allowed.includes(ext);
}
