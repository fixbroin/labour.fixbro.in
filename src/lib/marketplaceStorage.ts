import fs from 'node:fs/promises';
import path from 'node:path';
import { executeDbGetDoc } from '@/app/actions/dbActions';

/**
 * Deletes all image files associated with a marketplace ad from disk and remote storage.
 */
export async function deleteMarketplacePhotos(photos: string[] = []): Promise<void> {
  if (!Array.isArray(photos) || photos.length === 0) return;

  let remoteUploadUrl = process.env.REMOTE_UPLOAD_URL || '';
  let remoteSecretKey = process.env.REMOTE_SECRET_KEY || '';

  try {
    const storageDoc = await executeDbGetDoc('webSettings', 'storageConfiguration');
    if (storageDoc && storageDoc.exists && storageDoc.data) {
      if (storageDoc.data.remoteUploadUrl) remoteUploadUrl = storageDoc.data.remoteUploadUrl;
      if (storageDoc.data.remoteSecretKey) remoteSecretKey = storageDoc.data.remoteSecretKey;
    }
  } catch {
    // Continue with env defaults
  }

  for (const fileUrl of photos) {
    if (!fileUrl || typeof fileUrl !== 'string') continue;

    // 1. Delete from local server disk (public/uploads/)
    if (fileUrl.startsWith('/uploads/') || fileUrl.startsWith('uploads/')) {
      try {
        const cleanPath = path.normalize(fileUrl.replace(/^\/?uploads\//, '')).replace(/^(\.\.(\/|\\|$))+/, '');
        let baseDir = process.cwd();
        if (baseDir.includes(path.join('.next', 'standalone')) || baseDir.endsWith('standalone')) {
          baseDir = path.join(baseDir, '..', '..');
        }
        const targetDir = path.join(baseDir, 'public', 'uploads');
        const filePath = path.resolve(targetDir, cleanPath);

        if (filePath.startsWith(targetDir)) {
          await fs.unlink(filePath).catch(() => {});
        }
      } catch (localErr) {
        console.warn('Error deleting local marketplace image:', fileUrl, localErr);
      }
    }

    // 2. Delete from remote storage server if configured
    if (remoteUploadUrl && remoteUploadUrl.trim() !== '') {
      try {
        const remoteFormData = new FormData();
        remoteFormData.append('action', 'delete');
        remoteFormData.append('fileUrl', fileUrl);

        await fetch(remoteUploadUrl.trim(), {
          method: 'POST',
          headers: {
            'x-api-secret': remoteSecretKey,
          },
          body: remoteFormData,
        }).catch(() => {});
      } catch (remoteErr) {
        console.warn('Error deleting remote marketplace image:', fileUrl, remoteErr);
      }
    }
  }
}
