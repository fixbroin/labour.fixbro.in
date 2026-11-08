'use server';

import fs from 'node:fs';
import path from 'node:path';
import { adminDb } from '@/lib/firebaseAdmin';
import { revalidatePath } from 'next/cache';
import { triggerRefresh } from '@/lib/revalidateUtils';
import { executeDbGetDoc } from '@/app/actions/dbActions';

export interface ServerImageFile {
  url: string;
  fileName: string;
  folder: string;
  fileSize: number;
  modifiedAt: string;
  extension: string;
}

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.avif', '.ico']);

function getUploadsDirectory(): string {
  let baseDir = process.cwd();
  if (baseDir.includes(path.join('.next', 'standalone')) || baseDir.endsWith('standalone')) {
    baseDir = path.join(baseDir, '..', '..');
  }
  return path.join(baseDir, 'public', 'uploads');
}

/**
 * 1. Recursively list all image files stored on the server under public/uploads
 */
export async function listAllServerImagesAction(): Promise<{
  success: boolean;
  images: ServerImageFile[];
  folders: string[];
  totalSize: number;
  message?: string;
}> {
  try {
    const targetDir = getUploadsDirectory();

    if (!fs.existsSync(targetDir)) {
      return { success: true, images: [], folders: [], totalSize: 0 };
    }

    const images: ServerImageFile[] = [];
    const folderSet = new Set<string>();
    let totalSize = 0;

    function walkDirectory(currentDir: string) {
      try {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);
          if (entry.isDirectory()) {
            walkDirectory(fullPath);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (IMAGE_EXTENSIONS.has(ext)) {
              try {
                const stat = fs.statSync(fullPath);
                const relPath = path.relative(targetDir, fullPath).split(path.sep).join('/');
                const topFolder = relPath.includes('/') ? relPath.split('/')[0] : 'general';
                folderSet.add(topFolder);

                images.push({
                  url: `/uploads/${relPath}`,
                  fileName: entry.name,
                  folder: topFolder,
                  fileSize: stat.size,
                  modifiedAt: stat.mtime.toISOString(),
                  extension: ext.replace('.', ''),
                });
                totalSize += stat.size;
              } catch (statErr) {
                console.warn('Error stating file:', fullPath, statErr);
              }
            }
          }
        }
      } catch (dirErr) {
        console.warn('Error reading directory:', currentDir, dirErr);
      }
    }

    walkDirectory(targetDir);

    // Sort newest modified first
    images.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());

    return {
      success: true,
      images,
      folders: Array.from(folderSet).sort(),
      totalSize,
    };
  } catch (error: any) {
    console.error('Error in listAllServerImagesAction:', error);
    return {
      success: false,
      images: [],
      folders: [],
      totalSize: 0,
      message: error.message || 'Failed to list server images.',
    };
  }
}

/**
 * 2. Delete any image file permanently from the server
 */
export async function deleteServerImageAction(fileUrl: string): Promise<{ success: boolean; message: string }> {
  try {
    if (!fileUrl || typeof fileUrl !== 'string') {
      return { success: false, message: 'Invalid image URL provided.' };
    }

    const cleanUrl = fileUrl.trim();
    const targetDir = getUploadsDirectory();

    // 1. Delete from local disk
    if (cleanUrl.startsWith('/uploads/') || cleanUrl.startsWith('uploads/')) {
      const cleanRelPath = path.normalize(cleanUrl.replace(/^\/?uploads\//, '')).replace(/^(\.\.(\/|\\|$))+/, '');
      const filePath = path.resolve(targetDir, cleanRelPath);

      if (filePath.startsWith(targetDir)) {
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
          } catch (unlinkErr) {
            console.warn('Local file unlink error:', unlinkErr);
          }
        }
      }
    }

    // 2. If remote storage configured, also notify remote server
    try {
      const storageDoc = await executeDbGetDoc('webSettings', 'storageConfiguration');
      if (storageDoc?.exists && storageDoc.data?.remoteUploadUrl) {
        const remoteUrl = storageDoc.data.remoteUploadUrl.trim();
        const remoteSecretKey = storageDoc.data.remoteSecretKey || '';
        const formData = new FormData();
        formData.append('action', 'delete');
        formData.append('fileUrl', cleanUrl);

        fetch(remoteUrl, {
          method: 'POST',
          headers: { 'x-api-secret': remoteSecretKey },
          body: formData,
        }).catch((e) => console.warn('Remote file delete warning:', e));
      }
    } catch (e) {
      // Ignore remote storage check errors
    }

    // 3. Remove from adminCustomImages if tracked there
    try {
      const customSnap = await adminDb.collection('adminCustomImages').where('imageUrl', '==', cleanUrl).get();
      for (const d of customSnap.docs) {
        await d.ref.delete();
      }
    } catch (e) {
      // Ignore
    }

    revalidatePath('/admin/image-gallery');
    triggerRefresh('global-cache');

    return { success: true, message: 'Image successfully deleted from server.' };
  } catch (error: any) {
    console.error('Error in deleteServerImageAction:', error);
    return { success: false, message: error.message || 'Failed to delete server image.' };
  }
}

/**
 * 3. Update, replace, or delete a specific Provider image field
 */
export async function updateProviderImageFieldAction(params: {
  providerId: string;
  fieldPath: string;
  newUrl: string | null;
  oldUrl?: string | null;
}): Promise<{ success: boolean; message: string }> {
  try {
    const { providerId, fieldPath, newUrl, oldUrl } = params;
    if (!providerId || !fieldPath) {
      return { success: false, message: 'Provider ID and field path are required.' };
    }

    const appRef = adminDb.collection('providerApplications').doc(providerId);
    const appSnap = await appRef.get();

    if (!appSnap.exists) {
      return { success: false, message: 'Provider application document not found.' };
    }

    const appData = appSnap.data() as any;
    const updatePayload: any = {
      updatedAt: new Date(),
    };

    if (fieldPath === 'profilePhotoUrl') {
      updatePayload.profilePhotoUrl = newUrl;
      // Also sync to users doc
      try {
        const userRef = adminDb.collection('users').doc(providerId);
        await userRef.set({ photoURL: newUrl, updatedAt: new Date() }, { merge: true });
      } catch (uErr) {
        console.warn('Could not update user photoURL:', uErr);
      }
    } else if (fieldPath === 'signatureUrl') {
      updatePayload.signatureUrl = newUrl;
    } else if (fieldPath === 'bankDetails.cancelledChequeUrl') {
      updatePayload.bankDetails = {
        ...(appData.bankDetails || {}),
        cancelledChequeUrl: newUrl,
      };
    } else if (fieldPath === 'aadhaar.frontImageUrl') {
      updatePayload.aadhaar = {
        ...(appData.aadhaar || {}),
        frontImageUrl: newUrl,
      };
    } else if (fieldPath === 'aadhaar.backImageUrl') {
      updatePayload.aadhaar = {
        ...(appData.aadhaar || {}),
        backImageUrl: newUrl,
      };
    } else if (fieldPath === 'pan.frontImageUrl') {
      updatePayload.pan = {
        ...(appData.pan || {}),
        frontImageUrl: newUrl,
      };
    } else if (fieldPath === 'pan.backImageUrl') {
      updatePayload.pan = {
        ...(appData.pan || {}),
        backImageUrl: newUrl,
      };
    } else if (fieldPath.startsWith('additionalDocuments.')) {
      const parts = fieldPath.split('.');
      const idx = parseInt(parts[1], 10);
      const side = parts[2] as 'frontImageUrl' | 'backImageUrl';
      const docs = [...(appData.additionalDocuments || [])];
      if (docs[idx]) {
        docs[idx] = {
          ...docs[idx],
          [side]: newUrl,
        };
        updatePayload.additionalDocuments = docs;
      }
    } else {
      updatePayload[fieldPath] = newUrl;
    }

    await appRef.set(updatePayload, { merge: true });

    // Delete old file from storage if replacing or removing
    if (oldUrl && oldUrl !== newUrl) {
      await deleteServerImageAction(oldUrl);
    }

    revalidatePath('/admin/image-gallery');
    revalidatePath('/admin/provider-applications');
    triggerRefresh('global-cache');

    return {
      success: true,
      message: newUrl ? 'Provider image replaced successfully.' : 'Provider image deleted successfully.',
    };
  } catch (error: any) {
    console.error('Error in updateProviderImageFieldAction:', error);
    return { success: false, message: error.message || 'Failed to update provider image.' };
  }
}
