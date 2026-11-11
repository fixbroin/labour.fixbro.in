"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ProviderApplication, FirestoreCategory } from "@/types/firestore";
import { Loader2, Image as ImageIcon, Upload, CheckCircle, KeyRound, Info, AlertCircle } from "lucide-react";
import AppImage from "@/components/ui/AppImage";
import { storage, db } from "@/lib/firebase";
import { doc, getDoc } from "@/lib/mysqlDb";
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "@/lib/mysqlStorage";
import { useToast } from "@/hooks/use-toast";

interface ProviderFormProps {
  initialData?: ProviderApplication | null;
  categories: FirestoreCategory[];
  onSubmit: (data: Partial<ProviderApplication> & { password?: string }) => Promise<void>;
  onClose: () => void;
  isSubmitting: boolean;
}

const generateSlug = (name: string) => {
  if (!name) return "";
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
};

export default function ProviderForm({
  initialData,
  categories,
  onSubmit,
  onClose,
  isSubmitting,
}: ProviderFormProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState(initialData?.fullName || "");
  const [slug, setSlug] = useState(initialData?.slug || (initialData?.fullName ? generateSlug(initialData.fullName) : ""));
  const [workCategoryId, setWorkCategoryId] = useState(initialData?.workCategoryId || (categories[0]?.id || ""));
  const [seniorityLevel, setSeniorityLevel] = useState(initialData?.seniorityLevel || initialData?.skillLevelLabel || "Senior");
  const [dailyRate, setDailyRate] = useState<number | string>(initialData?.dailyRate ?? 1200);
  const [bio, setBio] = useState(initialData?.bio || "");
  const [mobileNumber, setMobileNumber] = useState(initialData?.mobileNumber || "");
  const [email, setEmail] = useState(initialData?.email || "");
  const [password, setPassword] = useState("");
  const [age, setAge] = useState<number | string>(initialData?.age ?? 28);
  const [experienceYears, setExperienceYears] = useState<number | string>(
    initialData?.experienceYears ?? (initialData?.experienceLevelLabel?.includes("5") ? 5 : 3)
  );
  const [workAreaAddress, setWorkAreaAddress] = useState(initialData?.workAreaAddress || "");
  const [workAreaRadiusKm, setWorkAreaRadiusKm] = useState<number | string>(initialData?.workAreaRadiusKm ?? 15);
  const [isActive, setIsActive] = useState(initialData?.isActive !== false);
  const [isOnline, setIsOnline] = useState(initialData?.isOnline !== false);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(initialData?.profilePhotoUrl || "");
  const [imagePreview, setImagePreview] = useState<string | null>(initialData?.profilePhotoUrl || null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [availableSkillLevels, setAvailableSkillLevels] = useState<{ id: string; label: string }[]>([]);

  useEffect(() => {
    async function loadSkillLevels() {
      try {
        const docRef = doc(db, "providerControlOptions", "skillLevels");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          const lvls = (data.levels || []).map((l: any) => ({ id: l.id || l.label, label: l.label }));
          setAvailableSkillLevels(lvls);
        }
      } catch (err) {
        console.error("Error loading skill levels in ProviderForm:", err);
      }
    }
    loadSkillLevels();
  }, []);

  useEffect(() => {
    if (!initialData && fullName && !slug) {
      setSlug(generateSlug(fullName));
    }
  }, [fullName, initialData, slug]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const selectedCat = categories.find(c => c.id === workCategoryId);
  const rawRates = selectedCat?.seniorityRates;
  const categoryRates: any[] = Array.isArray(rawRates)
    ? rawRates
    : (typeof rawRates === 'string' ? JSON.parse(rawRates || '[]') : []);

  const dynamicSkillOptions = (categoryRates && categoryRates.length > 0)
    ? categoryRates.map((r: any) => ({ id: r.skillLevelLabel || r.skillLevelId, label: r.skillLevelLabel || r.skillLevelId }))
    : (availableSkillLevels.length > 0)
      ? availableSkillLevels.map(l => ({ id: l.label, label: l.label }))
      : [
          { id: 'Beginner', label: 'Beginner' },
          { id: 'Intermediate', label: 'Intermediate' },
          { id: 'Expert', label: 'Expert' }
        ];

  const finalSkillOptions = [...dynamicSkillOptions];
  if (seniorityLevel && !finalSkillOptions.some(o => o.label.toLowerCase() === seniorityLevel.toLowerCase() || o.id.toLowerCase() === seniorityLevel.toLowerCase())) {
    finalSkillOptions.unshift({ id: seniorityLevel, label: seniorityLevel });
  }

  const activeRateRule = categoryRates.find((r: any) => {
    const lbl = (r.skillLevelLabel || '').toLowerCase();
    const cur = (seniorityLevel || '').toLowerCase();
    const ruleId = (r.skillLevelId || '').toLowerCase();
    return lbl === cur || ruleId === cur || (r.skillLevelLabel && seniorityLevel && r.skillLevelLabel.trim().toLowerCase() === seniorityLevel.trim().toLowerCase());
  });

  const minDailyRate = activeRateRule?.minRate ?? 500;
  const maxDailyRate = activeRateRule?.maxRate ?? 2500;

  const numRate = dailyRate !== '' ? Number(dailyRate) : null;
  let rateError = null;
  if (numRate !== null && !isNaN(numRate)) {
    if (numRate < minDailyRate) {
      rateError = `Daily rate cannot be less than ₹${minDailyRate}. Please enter at least ₹${minDailyRate}.`;
    } else if (numRate > maxDailyRate) {
      rateError = `Daily rate cannot exceed ₹${maxDailyRate}. Please enter at most ₹${maxDailyRate}.`;
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast({ title: "Validation Error", description: "Full name is required.", variant: "destructive" });
      return;
    }
    
    if (rateError) {
      toast({ title: "Invalid Daily Rate", description: rateError, variant: "destructive" });
      return;
    }

    if (!workCategoryId) {
      toast({ title: "Validation Error", description: "Category is required.", variant: "destructive" });
      return;
    }

    let finalPhotoUrl = profilePhotoUrl;

    if (selectedFile) {
      setIsUploadingImage(true);
      try {
        const ext = selectedFile.name.split('.').pop() || 'jpg';
        const filename = `providers/${Date.now()}-${generateSlug(fullName)}.${ext}`;
        const fileRef = storageRef(storage, filename);
        const uploadTask = uploadBytesResumable(fileRef, selectedFile);
        
        finalPhotoUrl = await new Promise<string>((resolve, reject) => {
          uploadTask.on(
            'state_changed',
            undefined,
            (error) => reject(error),
            async () => {
              const url = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(url);
            }
          );
        });
      } catch (err) {
        console.error("Image upload failed:", err);
        toast({ title: "Upload Failed", description: "Could not upload profile photo.", variant: "destructive" });
        setIsUploadingImage(false);
        return;
      }
      setIsUploadingImage(false);
    }

    const selectedCategory = categories.find(c => c.id === workCategoryId);

    const payload: Partial<ProviderApplication> & { password?: string } = {
      fullName: fullName.trim(),
      slug: (slug.trim() || generateSlug(fullName)).toLowerCase(),
      workCategoryId,
      workCategoryName: selectedCategory ? selectedCategory.name : initialData?.workCategoryName || "",
      seniorityLevel: seniorityLevel.trim(),
      dailyRate: Number(dailyRate) || 0,
      bio: bio.trim(),
      profilePhotoUrl: finalPhotoUrl,
      mobileNumber: mobileNumber.trim(),
      email: email.trim(),
      age: Number(age) || 0,
      experienceYears: Number(experienceYears) || 0,
      experienceLevelLabel: `${experienceYears} Years Experience`,
      skillLevelLabel: seniorityLevel.trim(),
      workAreaAddress: workAreaAddress.trim(),
      workAreaRadiusKm: Number(workAreaRadiusKm) || 10,
      isActive,
      isOnline,
      status: initialData?.status || 'approved',
      password: password.trim() || undefined,
    };

    await onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto px-1">
      {/* Profile Photo */}
      <div className="flex items-center gap-4 p-3 bg-muted/40 rounded-lg border">
        <div className="relative w-20 h-20 rounded-full overflow-hidden bg-muted border flex items-center justify-center flex-shrink-0">
          {imagePreview ? (
            <AppImage src={imagePreview} alt="Preview" fill sizes="80px" className="object-cover" />
          ) : (
            <ImageIcon className="h-8 w-8 text-muted-foreground" />
          )}
        </div>
        <div className="space-y-2 flex-1">
          <Label className="text-sm font-semibold">Profile Photo</Label>
          <div className="flex gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-1.5" /> Upload Photo
            </Button>
            {imagePreview && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedFile(null);
                  setImagePreview(null);
                  setProfilePhotoUrl("");
                }}
              >
                Remove
              </Button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">Recommended: Square format JPG/PNG</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Full Name */}
        <div className="space-y-1.5">
          <Label htmlFor="fullName" className="text-sm font-semibold">Full Name *</Label>
          <Input
            id="fullName"
            value={fullName}
            onChange={(e) => {
              const newName = e.target.value;
              setFullName(newName);
              if (!initialData && (!slug || slug === generateSlug(fullName))) {
                setSlug(generateSlug(newName));
              }
            }}
            placeholder="e.g. Ramesh Kumar"
            required
          />
        </div>

        {/* URL Slug */}
        <div className="space-y-1.5">
          <Label htmlFor="slug" className="text-sm font-semibold">URL Slug</Label>
          <Input
            id="slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="e.g. ramesh-kumar"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Category */}
        <div className="space-y-1.5">
          <Label htmlFor="category" className="text-sm font-semibold">Category *</Label>
          <Select value={workCategoryId} onValueChange={setWorkCategoryId}>
            <SelectTrigger id="category">
              <SelectValue placeholder="Select Category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Seniority Level */}
        <div className="space-y-1.5">
          <Label htmlFor="seniority" className="text-sm font-semibold">Seniority Level *</Label>
          <Select value={seniorityLevel} onValueChange={setSeniorityLevel}>
            <SelectTrigger id="seniority">
              <SelectValue placeholder="Select Seniority" />
            </SelectTrigger>
            <SelectContent>
              {finalSkillOptions.map((opt) => (
                <SelectItem key={opt.id} value={opt.label || opt.id}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Daily Rate (₹) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="dailyRate" className="text-sm font-semibold">Daily Rate (₹) *</Label>
            <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20 font-semibold">
              Allowed: ₹{minDailyRate} - ₹{maxDailyRate}
            </Badge>
          </div>
          <Input
            id="dailyRate"
            type="number"
            value={dailyRate}
            onChange={(e) => setDailyRate(e.target.value)}
            placeholder={activeRateRule ? `e.g. ${activeRateRule.minRate}` : "1200"}
            min={minDailyRate}
            max={maxDailyRate}
            className={cn(rateError && "border-destructive focus-visible:ring-destructive")}
            required
          />
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Info className="h-3 w-3 text-primary shrink-0" />
            Allowed rate: ₹{minDailyRate} to ₹{maxDailyRate} for {seniorityLevel} in {selectedCat?.name || 'selected category'}.
          </p>
          {rateError && (
            <p className="text-xs font-semibold text-destructive flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {rateError}
            </p>
          )}
        </div>
      </div>

      {/* About / Bio */}
      <div className="space-y-1.5">
        <Label htmlFor="bio" className="text-sm font-semibold">About / Bio *</Label>
        <Textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Brief description about the provider's skills, experience, and background..."
          rows={3}
        />
      </div>

      {!initialData && (
        <div className="space-y-2 bg-primary/5 p-3 rounded-lg border border-primary/20">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-sm font-semibold flex items-center gap-1.5">
              <KeyRound className="h-4 w-4 text-primary" /> Initial Password (for Provider Account Login) *
            </Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 text-xs text-primary hover:text-primary/80"
              onClick={() => setPassword(`FixBro@${Math.floor(1000 + Math.random() * 9000)}`)}
            >
              Generate Password
            </Button>
          </div>
          <Input
            id="password"
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="e.g. FixBro@2026"
            required={!initialData}
          />
          <p className="text-[11px] text-muted-foreground">
            Worker can log in using this password with their email/mobile. If email login is disabled, they can log in via Mobile OTP.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Age */}
        <div className="space-y-1.5">
          <Label htmlFor="age" className="text-sm font-semibold">Age</Label>
          <Input
            id="age"
            type="number"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder="28"
            min="18"
            max="80"
          />
        </div>

        {/* Experience (Years) */}
        <div className="space-y-1.5">
          <Label htmlFor="experienceYears" className="text-sm font-semibold">Experience (Yrs)</Label>
          <Input
            id="experienceYears"
            type="number"
            value={experienceYears}
            onChange={(e) => setExperienceYears(e.target.value)}
            placeholder="5"
            min="0"
          />
        </div>

        {/* Mobile Number */}
        <div className="space-y-1.5">
          <Label htmlFor="mobileNumber" className="text-sm font-semibold">Mobile Number</Label>
          <Input
            id="mobileNumber"
            value={mobileNumber}
            onChange={(e) => setMobileNumber(e.target.value)}
            placeholder="+91 9876543210"
          />
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-sm font-semibold">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="provider@example.com"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Work Area Address */}
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="workAreaAddress" className="text-sm font-semibold">Service Location / Address</Label>
          <Input
            id="workAreaAddress"
            value={workAreaAddress}
            onChange={(e) => setWorkAreaAddress(e.target.value)}
            placeholder="e.g. Indiranagar, Bengaluru, Karnataka"
          />
        </div>

        {/* Service Radius (Km) */}
        <div className="space-y-1.5">
          <Label htmlFor="workAreaRadiusKm" className="text-sm font-semibold">Service Radius (Km)</Label>
          <Input
            id="workAreaRadiusKm"
            type="number"
            value={workAreaRadiusKm}
            onChange={(e) => setWorkAreaRadiusKm(e.target.value)}
            placeholder="15"
            min="1"
          />
        </div>
      </div>

      {/* Switches for Active and Online */}
      <div className="flex flex-wrap gap-6 pt-2 border-t">
        <div className="flex items-center space-x-2">
          <Switch id="isActive" checked={isActive} onCheckedChange={setIsActive} />
          <Label htmlFor="isActive" className="text-sm font-medium">Approved & Active</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Switch id="isOnline" checked={isOnline} onCheckedChange={setIsOnline} />
          <Label htmlFor="isOnline" className="text-sm font-medium">Online (Accepting Bookings)</Label>
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting || isUploadingImage}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting || isUploadingImage}>
          {(isSubmitting || isUploadingImage) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {initialData ? "Save Changes" : "Create Provider"}
        </Button>
      </div>
    </form>
  );
}
