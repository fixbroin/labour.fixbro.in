import type { LocationChangeRequest } from './firestore';

export interface ProviderIdCardSettings {
  isIdCardEnabled: boolean;
  downloadFee: number;
  validityYears: number;
  validityMonths: number;
  signatoryName: string;
  helplineNumber: string;
  idNumberPrefix: string;
  idNumberStartingSeq: number;
  lastAssignedSeq?: number;
  disclaimerText: string;
}

export const DEFAULT_ID_CARD_SETTINGS: ProviderIdCardSettings = {
  isIdCardEnabled: true,
  downloadFee: 0,
  validityYears: 2,
  validityMonths: 0,
  signatoryName: "Authorized Signatory - FixBro",
  helplineNumber: "+91 7353113455",
  idNumberPrefix: "",
  idNumberStartingSeq: 1001,
  disclaimerText: "This ID is not issued by Government.",
};

export interface SerializedLocationChangeRequest {
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  requestedAt: number;
  resolvedAt?: number;
  previousAddress: string;
  previousCenter?: { latitude: number; longitude: number };
  previousRadiusKm?: number;
  newAddress: string;
  newCenter: { latitude: number; longitude: number };
  newRadiusKm: number;
  rejectionReason?: string;
}

export interface PendingLocationChangeItem {
  providerId: string;
  providerName: string;
  providerPhone?: string;
  categoryName?: string;
  photoUrl?: string;
  request: SerializedLocationChangeRequest;
}

/**
 * Format a sequential ID card number respecting custom starting sequence length and prefix.
 * e.g., if startingSeq is 1001, seq is 1001, prefix is FIX -> "FIX 1001"
 * e.g., if seq is 1002, prefix is FIX -> "FIX 1002"
 * e.g., if startingSeq is 361707601001 and seq is 361707601001 -> "3617 0760 1001"
 * e.g., if seq is 361707601002 -> "3617 0760 1002"
 */
export function formatIdNumber(
  seq: number,
  startingSeq: number = 1001,
  prefix?: string
): string {
  const seqStr = String(startingSeq || 1001);
  const targetLen = Math.max(seqStr.length, String(seq).length);
  const cleanPrefix = (prefix || '').trim();
  const numStr = String(seq).padStart(targetLen, '0');

  let formattedNum = numStr;
  if (targetLen >= 12) {
    const d12 = numStr.slice(-12);
    formattedNum = `${d12.slice(0, 4)} ${d12.slice(4, 8)} ${d12.slice(8, 12)}`;
  } else if (targetLen === 6) {
    formattedNum = `${numStr.slice(0, 3)} ${numStr.slice(3, 6)}`;
  } else if (targetLen === 8) {
    formattedNum = `${numStr.slice(0, 4)} ${numStr.slice(4, 8)}`;
  }

  return cleanPrefix ? `${cleanPrefix} ${formattedNum}` : formattedNum;
}

export function generateUniqueIdCardNumber(
  seqOrUid: number | string,
  startingSeq: number = 1001,
  prefix?: string
): string {
  if (typeof seqOrUid === 'number') {
    return formatIdNumber(seqOrUid, startingSeq, prefix);
  }
  const parsed = parseInt(seqOrUid, 10);
  if (!isNaN(parsed) && parsed >= startingSeq) {
    return formatIdNumber(parsed, startingSeq, prefix);
  }
  return formatIdNumber(startingSeq, startingSeq, prefix);
}

export function formatTechnicianId(uid: string): string {
  const cleanHash = (uid || 'FXB1001').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
  return `FXB - ${cleanHash.slice(0, 4)} - ${cleanHash.slice(4, 8) || '2026'}`;
}

export interface ProviderIdCardRecord {
  providerId: string;
  fullName: string;
  mobileNumber?: string;
  email?: string;
  profilePhotoUrl?: string;
  signatureUrl?: string;
  workCategoryName?: string;
  skillLevelLabel?: string;
  workAreaAddress?: string;
  residentialAddress?: string;
  gender?: string;
  dob?: string;
  age?: number;
  idCardNumber?: string;
  idCardSeq?: number;
  technicianId: string;
  status: string;

  // ID Card Generation & Unlock Info
  idCardGenerated: boolean;
  idCardGeneratedAt?: number | null;
  idCardUnlocked: boolean;
  idCardUnlockedAt?: number | null;
  idCardExpiresAt?: number | null;
  idCardPaymentId?: string | null;
  idCardOrderId?: string | null;
  idCardPaidAmount?: number;

  // Downloads metrics
  idCardDownloadCount: number;
  idCardPdfDownloadCount: number;
  idCardFrontPngDownloadCount: number;
  idCardBackPngDownloadCount: number;
  idCardLastDownloadedAt?: number | null;
  idCardDownloads?: Array<{
    type: 'pdf' | 'front_png' | 'back_png';
    downloadedAt: number;
    id?: string;
  }>;
}
