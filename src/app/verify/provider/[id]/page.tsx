import React from 'react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getPublicProviderVerificationAction } from '@/app/actions/providerIdCardActions';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  ShieldCheck, 
  User, 
  Calendar, 
  MapPin, 
  Briefcase, 
  ArrowLeft 
} from 'lucide-react';

interface VerifyPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: VerifyPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  return {
    title: `Service Partner Verification - ${resolvedParams.id || 'FixBro'}`,
    description: "Official identity and validity verification for registered service professionals.",
  };
}

export default async function ProviderVerifyPage({ params }: VerifyPageProps) {
  const resolvedParams = await params;
  const id = resolvedParams.id;
  const result = await getPublicProviderVerificationAction(id);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-200 dark:from-slate-950 dark:to-slate-900 py-10 px-4 flex flex-col items-center justify-center font-sans">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
        
        {/* Tricolor Header Stripe */}
        <div className="h-2 w-full flex">
          <div className="flex-1 bg-[#FF9933]" />
          <div className="flex-1 bg-white" />
          <div className="flex-1 bg-[#138808]" />
        </div>

        {/* Card Header */}
        <div className="px-6 pt-5 pb-4 bg-slate-900 text-white text-center border-b border-slate-800">
          <div className="text-[11px] uppercase tracking-widest text-slate-400 font-semibold">
            Service Partner Record
          </div>
          <h1 className="text-base font-bold tracking-tight text-white mt-0.5">
            {result.found && result.provider ? `Indian ${result.provider.workCategoryName} ID Card` : 'Identity Verification'}
          </h1>
        </div>

        {!result.found || !result.provider ? (
          // Not Found State
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
              <XCircle className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Record Not Found</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {result.message || "No verified service partner was found for this identification."}
              </p>
            </div>
            <div className="pt-2">
              <Link 
                href="/"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Return to Homepage
              </Link>
            </div>
          </div>
        ) : (
          // Found Verified Details
          <div className="p-6 space-y-5">
            
            {/* Status Indicator */}
            <div>
              {result.provider.status === 'active' ? (
                <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider">Status: Active</div>
                      <div className="text-[11px] text-emerald-700 dark:text-emerald-400">Validated Service Professional</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-600 text-white uppercase">
                    Active
                  </span>
                </div>
              ) : result.provider.status === 'expired' ? (
                <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider">Status: Expired</div>
                      <div className="text-[11px] text-amber-700 dark:text-amber-400">Card validity has expired</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-600 text-white uppercase">
                    Expired
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0" />
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider">Status: Suspended / Inactive</div>
                      <div className="text-[11px] text-rose-700 dark:text-rose-400">Account not active</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-600 text-white uppercase">
                    Inactive
                  </span>
                </div>
              )}
            </div>

            {/* Profile Picture & Name */}
            <div className="flex items-center gap-4 pt-1">
              <div className="relative w-20 h-24 rounded-xl overflow-hidden border border-slate-300 dark:border-slate-700 bg-slate-100 shrink-0 shadow-sm">
                {result.provider.profilePhotoUrl ? (
                  <Image
                    src={result.provider.profilePhotoUrl}
                    alt={result.provider.fullName}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400">
                    <User className="h-8 w-8" />
                  </div>
                )}
              </div>

              <div className="space-y-1 min-w-0">
                <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  Service Professional
                </div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100 truncate">
                  {result.provider.fullName}
                </h2>
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 text-xs font-bold">
                  <Briefcase className="h-3 w-3" />
                  {result.provider.workCategoryName}
                </div>
                {result.provider.skillLevelLabel && (
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                    Skill Level: <span className="font-semibold text-slate-800 dark:text-slate-200">{result.provider.skillLevelLabel}</span>
                  </div>
                )}
              </div>
            </div>

            {/* ID Number Box */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-center">
              <div className="text-[10px] uppercase font-bold tracking-widest text-slate-500">
                Partner ID Number
              </div>
              <div className="text-lg font-mono font-black text-slate-900 dark:text-slate-100 tracking-widest mt-0.5">
                {result.provider.idCardNumber}
              </div>
            </div>

            {/* Demographic & Validity Details */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                <span className="text-[10px] text-slate-500 font-semibold block uppercase">Gender / लिंग</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {result.provider.gender || 'Male'}
                </span>
              </div>

              <div className="p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                <span className="text-[10px] text-slate-500 font-semibold block uppercase">Date of Birth / जन्म तिथि</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {result.provider.dob || (result.provider.age ? `Age: ${result.provider.age}` : 'On Record')}
                </span>
              </div>

              <div className="p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                <span className="text-[10px] text-slate-500 font-semibold block uppercase">Issued Date</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {result.provider.issueDateStr}
                </span>
              </div>

              <div className="p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                <span className="text-[10px] text-slate-500 font-semibold block uppercase">Valid Thru</span>
                <span className={`font-bold ${result.provider.isExpired ? 'text-rose-600' : 'text-slate-800 dark:text-slate-200'}`}>
                  {result.provider.validThruStr}
                </span>
              </div>
            </div>

            {/* Legal Notice */}
            <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800 text-[10px] text-slate-500 leading-relaxed text-center">
              This professional work identity is issued for skilled service partner verification and is NOT issued by the Government.
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-100 dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 text-center">
          <div className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
            FixBro Service Network
          </div>
        </div>
      </div>
    </div>
  );
}
