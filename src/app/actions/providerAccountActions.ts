"use server";

import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { Timestamp } from '@/lib/mysqlDbAdmin';
import { nanoid } from 'nanoid';

interface CreateProviderAccountInput {
  fullName: string;
  mobileNumber: string;
  email?: string;
  password?: string;
  slug?: string;
  workCategoryId: string;
  workCategoryName?: string;
  seniorityLevel: string;
  dailyRate: number;
  bio?: string;
  profilePhotoUrl?: string;
  age?: number;
  experienceYears?: number;
  workAreaAddress?: string;
  workAreaRadiusKm?: number;
  isActive?: boolean;
  isOnline?: boolean;
}

const generateSlug = (name: string) => {
  if (!name) return "";
  return name.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
};

/**
 * Auto-generates a unique URL slug based on the provider's name.
 * If another provider already has the slug, appends -1, -2, etc.
 */
export async function generateUniqueProviderSlugAction(name: string, excludeId?: string): Promise<string> {
  const base = generateSlug(name) || 'provider';

  try {
    const snapshot = await adminDb.collection('providerApplications').get();
    const takenSlugs = new Set<string>();

    snapshot.docs.forEach(doc => {
      if (doc.id !== excludeId) {
        const s = doc.data()?.slug;
        if (s) takenSlugs.add(s.toLowerCase());
      }
    });

    if (!takenSlugs.has(base)) {
      return base;
    }

    let counter = 1;
    while (takenSlugs.has(`${base}-${counter}`)) {
      counter++;
    }
    return `${base}-${counter}`;
  } catch (err) {
    console.error("Error generating unique slug:", err);
    return `${base}-${nanoid(4).toLowerCase()}`;
  }
}

const formatPhoneNumber = (phone: string): string => {
  if (!phone) return "";
  let clean = phone.replace(/[^\d+]/g, '');
  if (!clean.startsWith('+')) {
    if (clean.length === 10) {
      clean = '+91' + clean;
    } else {
      clean = '+' + clean;
    }
  }
  return clean;
};

export async function createProviderAccountAction(input: CreateProviderAccountInput) {
  try {
    const {
      fullName,
      mobileNumber,
      email,
      password,
      slug: customSlug,
      workCategoryId,
      workCategoryName,
      seniorityLevel,
      dailyRate,
      bio,
      profilePhotoUrl,
      age,
      experienceYears,
      workAreaAddress,
      workAreaRadiusKm,
      isActive = true,
      isOnline = true,
    } = input;

    if (!fullName || !fullName.trim()) {
      return { success: false, error: "Full name is required." };
    }
    if (!mobileNumber || !mobileNumber.trim()) {
      return { success: false, error: "Mobile number is required." };
    }
    if (!workCategoryId) {
      return { success: false, error: "Category is required." };
    }

    const formattedMobile = formatPhoneNumber(mobileNumber.trim());
    const cleanEmail = email && email.trim() ? email.trim().toLowerCase() : undefined;
    const rawPassword = password && password.trim() ? password.trim() : `FixBro@${Math.floor(1000 + Math.random() * 9000)}`;

    let uid = `prov_${nanoid(12)}`;

    // 1. Attempt creating user in Firebase Auth if available
    try {
      const authPayload: any = {
        displayName: fullName.trim(),
        password: rawPassword,
      };
      if (cleanEmail) authPayload.email = cleanEmail;
      if (formattedMobile && formattedMobile.length >= 10) authPayload.phoneNumber = formattedMobile;

      const userRecord = await adminAuth.createUser(authPayload);
      uid = userRecord.uid;
    } catch (authError: any) {
      console.warn("Firebase Auth create warning (using DB uid fallback):", authError?.message || authError);
      // If user already exists in auth with that phone/email, retrieve user
      if (authError?.code === 'auth/phone-number-already-exists' && formattedMobile) {
        try {
          const existingUser = await adminAuth.getUserByPhoneNumber(formattedMobile);
          uid = existingUser.uid;
        } catch (_) {}
      } else if (authError?.code === 'auth/email-already-exists' && cleanEmail) {
        try {
          const existingUser = await adminAuth.getUserByEmail(cleanEmail);
          uid = existingUser.uid;
        } catch (_) {}
      }
    }

    const now = Timestamp.now();
    // Auto generate clean unique slug: e.g. "ramesh-kumar", "ramesh-kumar-1"
    const slug = customSlug && customSlug.trim()
      ? await generateUniqueProviderSlugAction(customSlug.trim(), uid)
      : await generateUniqueProviderSlugAction(fullName.trim(), uid);

    // 2. Create / Update User record in users table
    const userDocRef = adminDb.collection('users').doc(uid);
    const existingUserDoc = await userDocRef.get();
    
    const userData: any = {
      id: uid,
      uid: uid,
      displayName: fullName.trim(),
      mobileNumber: formattedMobile,
      email: cleanEmail || '',
      photoURL: profilePhotoUrl || null,
      roles: ['provider'],
      isActive: true,
      updatedAt: now,
    };

    if (!existingUserDoc.exists) {
      userData.createdAt = now;
      userData.walletBalance = 0;
      userData.userNumber = Math.floor(1000 + Math.random() * 9000);
      await userDocRef.set(userData);
    } else {
      await userDocRef.update(userData);
    }

    // 3. Create Provider Profile in providerApplications
    const providerDocRef = adminDb.collection('providerApplications').doc(uid);
    const providerData = {
      id: uid,
      userId: uid,
      fullName: fullName.trim(),
      slug,
      email: cleanEmail || '',
      mobileNumber: formattedMobile,
      workCategoryId,
      workCategoryName: workCategoryName || '',
      seniorityLevel: seniorityLevel.trim(),
      skillLevelLabel: seniorityLevel.trim(),
      experienceLevelLabel: `${experienceYears || 5} Years Experience`,
      dailyRate: Number(dailyRate) || 1200,
      bio: bio ? bio.trim() : `Experienced ${seniorityLevel} provider in ${workCategoryName || 'Daily Labour'}.`,
      profilePhotoUrl: profilePhotoUrl || '',
      age: Number(age) || 28,
      experienceYears: Number(experienceYears) || 5,
      workAreaAddress: workAreaAddress ? workAreaAddress.trim() : '',
      workAreaRadiusKm: Number(workAreaRadiusKm) || 15,
      status: 'approved',
      isActive: isActive !== false,
      isOnline: isOnline !== false,
      submittedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    await providerDocRef.set(providerData);

    return {
      success: true,
      uid,
      slug,
      provider: providerData,
      temporaryPassword: rawPassword,
    };
  } catch (error: any) {
    console.error("Error creating provider account:", error);
    return { success: false, error: error?.message || "Failed to create provider account." };
  }
}
