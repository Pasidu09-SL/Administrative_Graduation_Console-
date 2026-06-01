'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  GraduationCap, LogOut, Loader2, User, Mail,
  MapPin, Phone, Award, Lock, CheckCircle2, AlertTriangle, FileText
} from 'lucide-react';

export default function StudentDashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [nameCorrection, setNameCorrection] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [slipUrl, setSlipUrl] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // Fetch student profile inside RLS context
  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/student/profile');
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/');
          return;
        }
        throw new Error('Could not retrieve student registration profile.');
      }
      const json = await res.json();
      setProfile(json.data);
      setNameCorrection(json.data.name_correction_request || '');
      setPhotoUrl(json.data.profile_photo_path || null);
      setSlipUrl(json.data.payment_slip_path || null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleLogout = async () => {
    await fetch('/api/student/auth/logout', { method: 'POST' });
    router.push('/');
  };

  // Handle uploading files (photo or payment slip)
  const handleUpload = async (file: File, type: 'photo' | 'slip') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    const res = await fetch('/api/student/profile/upload', {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `Upload of ${type} failed.`);
    }
    return data.url; // relative path, e.g. /uploads/...
  };

  const handleSaveProfile = async (confirmAttendance: boolean = false) => {
    setSaving(true);
    setError(null);
    setSaveSuccess(null);

    try {
      let finalPhotoPath = photoUrl;
      let finalSlipPath = slipUrl;

      // 1. Upload photo if selected
      if (photoFile) {
        finalPhotoPath = await handleUpload(photoFile, 'photo');
        setPhotoUrl(finalPhotoPath);
        setPhotoFile(null);
      }

      // 2. Upload slip if selected
      if (slipFile) {
        finalSlipPath = await handleUpload(slipFile, 'slip');
        setSlipUrl(finalSlipPath);
        setSlipFile(null);
      }

      // 3. Save details (PATCH profile)
      const patchData: any = {
        name_correction_request: nameCorrection || null,
        profile_photo_path: finalPhotoPath,
        payment_slip_path: finalSlipPath,
      };

      if (confirmAttendance) {
        patchData.attendance_confirmed = true;
      }

      const res = await fetch('/api/student/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchData),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to update graduation profile.');
      }

      setProfile(json.data);
      setSaveSuccess(confirmAttendance 
        ? 'Graduation attendance confirmed! Your profile is now locked in read-only mode.' 
        : 'Profile details saved successfully.'
      );
      
      if (confirmAttendance) {
        // Refresh page status
        fetchProfile();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50 flex flex-col items-center justify-center gap-4">
        <AlertTriangle className="h-10 w-10 text-red-500" />
        <p className="text-red-600 dark:text-red-400 font-semibold">{error}</p>
        <Button onClick={() => window.location.reload()} className="bg-blue-600">Retry</Button>
      </div>
    );
  }

  const isLocked = profile.attendance_confirmed;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 flex flex-col transition-colors duration-200">
      {/* Top Navbar */}
      <header className="border-b border-slate-200 dark:border-slate-900 bg-white/70 dark:bg-slate-950/70 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600/10 dark:bg-blue-600/20 text-blue-600 dark:text-blue-500 rounded-xl border border-blue-500/20 dark:border-blue-500/30">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold tracking-wider text-slate-500 dark:text-slate-400 block uppercase leading-none">{profile.faculty}</span>
            <span className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white mt-1 block">Student Self-Service Console</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <div className="hidden md:block text-right border-l border-slate-200 dark:border-slate-800 pl-4">
            <span className="text-sm font-bold text-slate-900 dark:text-white block leading-none">{profile.name_with_initials}</span>
            <span className="text-xs text-slate-500 mt-1 block">{profile.index_no}</span>
          </div>
          <Button
            variant="outline"
            onClick={handleLogout}
            className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white rounded-xl gap-2 text-xs font-semibold"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </header>

      {/* Main Panel */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8 space-y-6">
        
        {/* Status Alerts Banners */}
        {isLocked ? (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/30 rounded-2xl flex items-start gap-3.5">
            <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-500/25">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-emerald-800 dark:text-emerald-300 text-sm">Graduation Profile Locked (Read-Only)</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                You confirmed attendance on {new Date(profile.confirmed_at).toLocaleString()}. Your details have been submitted to the Exam Division for final review. Spell corrections or file modifications are disabled.
              </p>
            </div>
          </div>
        ) : profile.verification_status === 'Name Correction Requested' ? (
          <div className="p-4 bg-yellow-50 dark:bg-yellow-950/40 border border-yellow-200 dark:border-yellow-500/30 rounded-2xl flex items-start gap-3.5">
            <div className="p-2 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 rounded-xl border border-yellow-500/25">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-yellow-800 dark:text-yellow-300 text-sm">Revision Needed / Action Required</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                The Exam Division requested revisions. Your profile has been unlocked. Please re-check your spelling correction request and upload documents before confirming attendance again.
              </p>
            </div>
          </div>
        ) : profile.verification_status === 'Approved' ? (
          <div className="p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-500/30 rounded-2xl flex items-start gap-3.5">
            <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl border border-blue-500/25">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-blue-800 dark:text-blue-300 text-sm">Verified & Approved</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                Your submitted profile and corrections have been verified and approved by the Exam Division. Your Certificate serial allocation is finalized.
              </p>
            </div>
          </div>
        ) : null}

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/45 border border-red-200 dark:border-red-500/35 text-red-700 dark:text-red-300 rounded-xl text-xs font-semibold">
            {error}
          </div>
        )}
        {saveSuccess && (
          <div className="p-3 bg-blue-50 dark:bg-blue-950/45 border border-blue-200 dark:border-blue-500/35 text-blue-700 dark:text-blue-300 rounded-xl text-xs font-semibold">
            {saveSuccess}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Column 1 & 2: Details Grid */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/30 backdrop-blur-md rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-slate-950 dark:text-white">Academic Details</CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Official enrollment data imported from Faculty list.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5 p-3.5 bg-slate-100/50 dark:bg-slate-950/40 rounded-xl border border-slate-200 dark:border-slate-900">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Registration No</span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-200">{profile.registration_no}</span>
                </div>
                <div className="space-y-1.5 p-3.5 bg-slate-100/50 dark:bg-slate-950/40 rounded-xl border border-slate-200 dark:border-slate-900">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Index No</span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-200">{profile.index_no}</span>
                </div>
                <div className="space-y-1.5 p-3.5 bg-slate-100/50 dark:bg-slate-950/40 rounded-xl border border-slate-200 dark:border-slate-900">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Official Name</span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-200">{profile.full_name}</span>
                </div>
                <div className="space-y-1.5 p-3.5 bg-slate-100/50 dark:bg-slate-950/40 rounded-xl border border-slate-200 dark:border-slate-900">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Degree (Course)</span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-200">{profile.degree_name_en} ({profile.degree_type})</span>
                </div>
                <div className="space-y-1.5 p-3.5 bg-slate-100/50 dark:bg-slate-950/40 rounded-xl border border-slate-200 dark:border-slate-900">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Cumulative GPA</span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-2">
                    <Award className="h-4 w-4 text-blue-500" />
                    {profile.gpa}
                  </span>
                </div>
                <div className="space-y-1.5 p-3.5 bg-slate-100/50 dark:bg-slate-950/40 rounded-xl border border-slate-200 dark:border-slate-900">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Degree Classification</span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-200">{profile.class}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/30 backdrop-blur-md rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-slate-950 dark:text-white">Personal Contact Information</CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Addresses and contact numbers verified for graduation correspondence.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-slate-100/50 dark:bg-slate-950/40 rounded-xl border border-slate-200 dark:border-slate-900">
                  <Mail className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-500 block">Email Address</span>
                    <span className="text-xs text-slate-800 dark:text-slate-300">{profile.email}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-slate-100/50 dark:bg-slate-950/40 rounded-xl border border-slate-200 dark:border-slate-900">
                  <Phone className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-500 block">Contact Phone Number</span>
                    <span className="text-xs text-slate-800 dark:text-slate-300">{profile.contact_no}</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-slate-100/50 dark:bg-slate-950/40 rounded-xl border border-slate-200 dark:border-slate-900">
                  <MapPin className="h-4 w-4 text-slate-400 dark:text-slate-500 mt-1" />
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-500 block">Mailing Address</span>
                    <span className="text-xs text-slate-800 dark:text-slate-300">{profile.address}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Column 3: Uploads and Action Items */}
          <div className="space-y-6">
            
            {/* Upload Profile Photo */}
            <Card className="border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/30 backdrop-blur-md rounded-2xl shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-bold text-slate-950 dark:text-white uppercase tracking-wider">Profile Photo</CardTitle>
                <CardDescription className="text-[11px] text-slate-500">
                  Official JPEG/PNG image for certificates (max 2MB).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {photoUrl ? (
                  <div className="relative aspect-square w-32 mx-auto rounded-full overflow-hidden border-2 border-blue-500 bg-slate-900 flex items-center justify-center">
                    <img src={photoUrl} alt="Profile preview" className="object-cover w-full h-full" />
                  </div>
                ) : (
                  <div className="aspect-square w-32 mx-auto rounded-full bg-slate-100 dark:bg-slate-950 border border-dashed border-slate-300 dark:border-slate-800 flex flex-col items-center justify-center text-slate-400 dark:text-slate-600">
                    <User className="h-10 w-10" />
                    <span className="text-[10px] mt-1">No Photo</span>
                  </div>
                )}

                {!isLocked && (
                  <div className="space-y-2">
                    <Label htmlFor="photoUpload" className="sr-only">Upload Photo</Label>
                    <Input
                      id="photoUpload"
                      type="file"
                      accept=".png, .jpg, .jpeg"
                      onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                      className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 text-xs file:bg-blue-600/10 file:border-0 file:text-blue-600 dark:file:text-blue-500 file:text-xs file:font-semibold file:px-3 file:py-1 file:mr-3 rounded-lg file:rounded-md cursor-pointer file:cursor-pointer"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Upload Payment Slip */}
            <Card className="border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/30 backdrop-blur-md rounded-2xl shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-bold text-slate-950 dark:text-white uppercase tracking-wider">Graduation Payment Slip</CardTitle>
                <CardDescription className="text-[11px] text-slate-500">
                  PDF/JPEG receipt of registration fee (max 2MB).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {slipUrl ? (
                  <div className="p-3 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-900 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                      <FileText className="h-4 w-4" />
                      <span className="text-xs font-semibold truncate max-w-[150px]">Payment Receipt Uploaded</span>
                    </div>
                    <a
                      href={slipUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] font-bold text-blue-600 dark:text-blue-500 hover:underline"
                    >
                      View Slip
                    </a>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-100/50 dark:bg-slate-950/40 border border-dashed border-slate-200 dark:border-slate-800 text-center rounded-xl text-xs text-slate-400 dark:text-slate-600">
                    No payment slip uploaded.
                  </div>
                )}

                {!isLocked && (
                  <div className="space-y-2">
                    <Label htmlFor="slipUpload" className="sr-only">Upload Slip</Label>
                    <Input
                      id="slipUpload"
                      type="file"
                      accept=".png, .jpg, .jpeg, .pdf"
                      onChange={(e) => setSlipFile(e.target.files?.[0] || null)}
                      className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 text-xs file:bg-blue-600/10 file:border-0 file:text-blue-600 dark:file:text-blue-500 file:text-xs file:font-semibold file:px-3 file:py-1 file:mr-3 rounded-lg file:rounded-md cursor-pointer file:cursor-pointer"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Spelling Correction Request */}
            <Card className="border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/30 backdrop-blur-md rounded-2xl shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-bold text-slate-950 dark:text-white uppercase tracking-wider">Spelling Correction Request</CardTitle>
                <CardDescription className="text-[11px] text-slate-500">
                  Request changes to your certificate Full Name.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="nameCorrection" className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-bold tracking-wider">Requested Spelling</Label>
                  <Input
                    id="nameCorrection"
                    type="text"
                    disabled={isLocked}
                    value={nameCorrection}
                    onChange={(e) => setNameCorrection(e.target.value)}
                    placeholder="Enter correct name layout..."
                    className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 text-xs focus:border-blue-500 rounded-lg h-9"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Core Action buttons */}
            {!isLocked && (
              <div className="space-y-3 pt-2">
                <Button
                  onClick={() => handleSaveProfile(false)}
                  disabled={saving}
                  className="w-full bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 font-bold h-10 rounded-xl text-xs transition"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin text-slate-800 dark:text-white mx-auto" />
                  ) : (
                    'Save Draft Changes'
                  )}
                </Button>

                <Button
                  onClick={() => {
                    if (confirm('Warning: Confirming attendance will lock your details immediately. Are you sure all information is accurate?')) {
                      handleSaveProfile(true);
                    }
                  }}
                  disabled={saving || (!photoUrl && !photoFile) || (!slipUrl && !slipFile)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 rounded-xl text-xs transition relative shadow-lg shadow-blue-500/20"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin text-white mx-auto" />
                  ) : (
                    'Confirm Graduation Attendance'
                  )}
                  {(!photoUrl && !photoFile) || (!slipUrl && !slipFile) ? (
                    <span className="block text-[8px] text-blue-300 font-normal mt-0.5">(Upload documents to enable)</span>
                  ) : null}
                </Button>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-900 py-6 text-center text-xs text-slate-500 dark:text-slate-600 mt-12 transition-colors duration-200">
        © 2026 University Exam Division. Enforced Row-Level Secure Environment.
      </footer>
    </div>
  );
}
