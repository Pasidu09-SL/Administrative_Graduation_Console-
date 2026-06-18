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
  MapPin, Phone, Award, Lock, CheckCircle2, AlertTriangle, FileText, X
} from 'lucide-react';

export default function StudentDashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [nameCorrection, setNameCorrection] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [slipUrl, setSlipUrl] = useState<string | null>(null);
  const [attendingConvocation, setAttendingConvocation] = useState<boolean | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

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
      setAttendingConvocation(json.data.attending_convocation);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    if (saveSuccess) {
      const timer = setTimeout(() => setSaveSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [saveSuccess]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [error]);

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

  const handlePhotoUpload = async (file: File) => {
    setSaving(true);
    setError(null);
    setSaveSuccess(null);
    try {
      const path = await handleUpload(file, 'photo');
      setPhotoUrl(path);
      
      const res = await fetch('/api/student/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_photo_path: path }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to auto-save profile photo.');
      setProfile(json.data);
      setSaveSuccess('Profile photo uploaded and saved.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSlipUpload = async (file: File) => {
    setSaving(true);
    setError(null);
    setSaveSuccess(null);
    try {
      const path = await handleUpload(file, 'slip');
      setSlipUrl(path);
      
      const res = await fetch('/api/student/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_slip_path: path }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to auto-save payment slip.');
      setProfile(json.data);
      setSaveSuccess('Payment slip uploaded and saved.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAttendanceChange = async (val: boolean | null) => {
    setSaving(true);
    setError(null);
    setSaveSuccess(null);
    try {
      const res = await fetch('/api/student/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attending_convocation: val }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to auto-save attendance preference.');
      setProfile(json.data);
      setAttendingConvocation(json.data.attending_convocation);
      setSaveSuccess('Attendance preference saved.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleNameCorrectionBlur = async () => {
    const trimmedVal = nameCorrection.trim() || null;
    const dbVal = profile?.name_correction_request || null;
    if (trimmedVal === dbVal) return;
    
    setSaving(true);
    setError(null);
    setSaveSuccess(null);
    try {
      const res = await fetch('/api/student/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name_correction_request: trimmedVal }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to auto-save name correction request.');
      setProfile(json.data);
      setNameCorrection(json.data.name_correction_request || '');
      setSaveSuccess('Spelling correction request saved.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleClearInputs = async () => {
    if (!confirm('Are you sure you want to clear all your uploaded files and inputs? This action cannot be undone.')) {
      return;
    }

    setSaving(true);
    setError(null);
    setSaveSuccess(null);
    try {
      const res = await fetch('/api/student/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_photo_path: null,
          payment_slip_path: null,
          name_correction_request: null,
          attending_convocation: null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to clear inputs.');
      setProfile(json.data);
      setPhotoUrl(null);
      setSlipUrl(null);
      setNameCorrection('');
      setAttendingConvocation(null);

      const photoInput = document.getElementById('photoUpload') as HTMLInputElement;
      const slipInput = document.getElementById('slipUpload') as HTMLInputElement;
      if (photoInput) photoInput.value = '';
      if (slipInput) slipInput.value = '';

      setSaveSuccess('All inputs cleared successfully.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitResponse = async () => {
    setSaving(true);
    setError(null);
    setSaveSuccess(null);
    try {
      const res = await fetch('/api/student/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attendance_confirmed: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to submit response.');
      setProfile(json.data);
      setSaveSuccess('Graduation response submitted successfully! Your profile is now locked in read-only mode.');
      fetchProfile();
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

  if (!profile) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50 flex flex-col items-center justify-center gap-4">
        <AlertTriangle className="h-10 w-10 text-red-500" />
        <p className="text-red-600 dark:text-red-400 font-semibold">{error || 'Could not load student profile. Please try logging in again.'}</p>
        <Button onClick={() => window.location.reload()} className="bg-blue-600">Retry</Button>
      </div>
    );
  }

  const isLocked = profile.attendance_confirmed;
  const hasAnyInput = !!photoUrl || !!slipUrl || (nameCorrection !== undefined && nameCorrection !== null && nameCorrection.trim() !== '') || attendingConvocation !== null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 flex flex-col transition-colors duration-200">
      {/* Floating Toast Container */}
      <div className="fixed top-6 right-6 z-[100] flex flex-col gap-3 w-full max-w-sm pointer-events-none">
        {saveSuccess && (
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-emerald-500/20 dark:border-emerald-500/35 shadow-2xl rounded-2xl p-4 flex items-start gap-3 w-full max-w-sm pointer-events-auto animate-in slide-in-from-top-4 duration-300">
            <div className="p-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg border border-emerald-500/20">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div className="flex-1 space-y-0.5">
              <h4 className="text-xs font-black tracking-wide text-slate-855 dark:text-white uppercase">Success</h4>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 leading-snug">{saveSuccess}</p>
            </div>
            <button
              type="button"
              onClick={() => setSaveSuccess(null)}
              className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {error && (
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-red-500/20 dark:border-red-500/35 shadow-2xl rounded-2xl p-4 flex items-start gap-3 w-full max-w-sm pointer-events-auto animate-in slide-in-from-top-4 duration-300">
            <div className="p-1.5 bg-red-500/10 text-red-655 dark:text-red-400 rounded-lg border border-red-500/20">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div className="flex-1 space-y-0.5">
              <h4 className="text-xs font-black tracking-wide text-slate-855 dark:text-white uppercase">Error</h4>
              <p className="text-xs font-semibold text-slate-655 dark:text-red-450 leading-snug whitespace-pre-wrap">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Top Navbar */}
      <header className="border-b border-slate-200 dark:border-slate-900 bg-white/70 dark:bg-slate-950/70 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600/10 dark:bg-blue-600/20 text-blue-600 dark:text-blue-500 rounded-xl border border-blue-500/20 dark:border-blue-500/30">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <span className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white block">Student Registration Console</span>
            <span className="text-[10px] font-bold tracking-wider text-slate-500 dark:text-slate-400 block uppercase mt-0.5">Rajarata University of Sri Lanka</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsProfileOpen(true)}
            onMouseEnter={() => setIsProfileOpen(true)}
            className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 rounded-xl flex items-center justify-center"
          >
            <User className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Side Profile Drawer */}
      <div 
        className={`fixed inset-0 z-50 flex justify-end transition-opacity duration-300 ${isProfileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      >
        {/* Backdrop */}
        <div 
          className="absolute inset-0 bg-slate-950/20 backdrop-blur-sm"
          onClick={() => setIsProfileOpen(false)}
        />
        
        {/* Drawer panel */}
        <div 
          className={`relative w-80 max-w-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 h-full shadow-2xl flex flex-col justify-between transition-transform duration-300 ease-out z-10 ${isProfileOpen ? 'translate-x-0' : 'translate-x-full'}`}
          onMouseLeave={() => setIsProfileOpen(false)}
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Student Profile</h2>
              <button 
                onClick={() => setIsProfileOpen(false)}
                className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            {/* Avatar Circle */}
            <div className="flex flex-col items-center py-4">
              {photoUrl ? (
                <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-blue-500 shadow-md">
                  <img src={photoUrl} alt="Avatar" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700">
                  <User className="h-12 w-12" />
                </div>
              )}
              <h3 className="mt-4 text-center text-base font-bold text-slate-900 dark:text-white leading-tight">
                {profile.name_with_initials}
              </h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase mt-1 tracking-wider text-center max-w-[90%] truncate">
                {profile.faculty}
              </p>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 p-6 space-y-4 overflow-y-auto">
            <div className="space-y-1">
              <span className="text-[9px] uppercase font-bold text-slate-500 block">Registration No</span>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{profile.registration_no}</span>
            </div>
            <div className="space-y-1">
              <span className="text-[9px] uppercase font-bold text-slate-500 block">Index Number</span>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{profile.index_no || "-"}</span>
            </div>

            <div className="space-y-1">
              <span className="text-[9px] uppercase font-bold text-slate-500 block">Faculty</span>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-snug">{profile.faculty}</span>
            </div>
          </div>

          {/* Footer containing Logout */}
          <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
            <Button
              onClick={handleLogout}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold h-11 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </div>

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
                You submitted your response on {new Date(profile.confirmed_at).toLocaleString()}. Your details have been submitted to the Exam Division for final review. Spell corrections or file modifications are disabled.
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
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-200">{profile.index_no || "-"}</span>
                </div>
                <div className="space-y-1.5 p-3.5 bg-slate-100/50 dark:bg-slate-950/40 rounded-xl border border-slate-200 dark:border-slate-900">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Full Name</span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-200">{profile.full_name}</span>
                </div>
                <div className="space-y-1.5 p-3.5 bg-slate-100/50 dark:bg-slate-950/40 rounded-xl border border-slate-200 dark:border-slate-900">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Degree (Course)</span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-200">{profile.degree_name_en} ({profile.degree_type})</span>
                </div>
                <div className="space-y-1.5 p-3.5 bg-slate-100/50 dark:bg-slate-950/40 rounded-xl border border-slate-200 dark:border-slate-900">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Final GPA</span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-2">
                    <Award className="h-4 w-4 text-blue-500" />
                    {profile.gpa !== null && profile.gpa !== undefined ? profile.gpa : "-"}
                  </span>
                </div>
                <div className="space-y-1.5 p-3.5 bg-slate-100/50 dark:bg-slate-950/40 rounded-xl border border-slate-200 dark:border-slate-900">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Degree Classification (Class)</span>
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
                <CardTitle className="text-sm font-bold text-slate-950 dark:text-white uppercase tracking-wider flex items-center justify-between">
                  <span>Profile Photo</span>
                  <span className="text-red-500 text-xs font-extrabold">* Required</span>
                </CardTitle>
                <CardDescription className="text-[11px] text-slate-500">
                  Official JPEG/PNG image (max 2MB).
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
                      disabled={saving}
                      accept=".png, .jpg, .jpeg"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handlePhotoUpload(file);
                      }}
                      className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 text-xs file:bg-blue-600/10 file:border-0 file:text-blue-600 dark:file:text-blue-500 file:text-xs file:font-semibold file:px-3 file:py-1 file:mr-3 rounded-lg file:rounded-md cursor-pointer file:cursor-pointer disabled:opacity-50"
                    />
                    
                    {photoUrl && (
                      <Button
                        variant="outline"
                        onClick={async () => {
                          if (!confirm('Remove profile photo?')) return;
                          setSaving(true);
                          try {
                            const res = await fetch('/api/student/profile', {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ profile_photo_path: null }),
                            });
                            if (!res.ok) throw new Error();
                            setPhotoUrl(null);
                            const input = document.getElementById('photoUpload') as HTMLInputElement;
                            if (input) input.value = '';
                          } catch {
                            setError('Failed to remove profile photo.');
                          } finally {
                            setSaving(false);
                          }
                        }}
                        className="w-full border-slate-200 dark:border-slate-800 text-xs font-semibold h-8 rounded-lg mt-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
                      >
                        Remove Photo
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Upload Payment Slip */}
            <Card className="border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/30 backdrop-blur-md rounded-2xl shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-bold text-slate-950 dark:text-white uppercase tracking-wider flex items-center justify-between">
                  <span>Graduation Payment Slip</span>
                  <span className="text-red-500 text-xs font-extrabold">* Required</span>
                </CardTitle>
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
                      disabled={saving}
                      accept=".png, .jpg, .jpeg, .pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleSlipUpload(file);
                      }}
                      className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 text-xs file:bg-blue-600/10 file:border-0 file:text-blue-600 dark:file:text-blue-500 file:text-xs file:font-semibold file:px-3 file:py-1 file:mr-3 rounded-lg file:rounded-md cursor-pointer file:cursor-pointer disabled:opacity-50"
                    />

                    {slipUrl && (
                      <Button
                        variant="outline"
                        onClick={async () => {
                          if (!confirm('Remove payment slip?')) return;
                          setSaving(true);
                          try {
                            const res = await fetch('/api/student/profile', {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ payment_slip_path: null }),
                            });
                            if (!res.ok) throw new Error();
                            setSlipUrl(null);
                            const input = document.getElementById('slipUpload') as HTMLInputElement;
                            if (input) input.value = '';
                          } catch {
                            setError('Failed to remove payment slip.');
                          } finally {
                            setSaving(false);
                          }
                        }}
                        className="w-full border-slate-200 dark:border-slate-800 text-xs font-semibold h-8 rounded-lg mt-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
                      >
                        Remove Slip
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Spelling Correction Request */}
            <Card className="border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/30 backdrop-blur-md rounded-2xl shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-bold text-slate-950 dark:text-white uppercase tracking-wider flex items-center justify-between">
                  <span>Spelling Correction Request</span>
                  {nameCorrection && !isLocked && (
                    <Button
                      variant="outline"
                      onClick={async () => {
                        setNameCorrection('');
                        setSaving(true);
                        try {
                          await fetch('/api/student/profile', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ name_correction_request: null }),
                          });
                        } catch {
                          setError('Failed to clear name correction.');
                        } finally {
                          setSaving(false);
                        }
                      }}
                      className="border-slate-200 dark:border-slate-800 text-[10px] font-semibold h-7 px-2 rounded-md text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900/50"
                    >
                      Clear Request
                    </Button>
                  )}
                </CardTitle>
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
                     disabled={isLocked || saving}
                     value={nameCorrection}
                     onChange={(e) => setNameCorrection(e.target.value)}
                     onBlur={handleNameCorrectionBlur}
                     onKeyDown={(e) => {
                       if (e.key === 'Enter') {
                         handleNameCorrectionBlur();
                       }
                     }}
                     placeholder="Enter correct name layout..."
                     className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 text-xs focus:border-blue-500 rounded-lg h-9"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Convocation Attendance Choice (Moved to bottom) */}
            <Card className="border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/30 backdrop-blur-md rounded-2xl shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-bold text-slate-950 dark:text-white uppercase tracking-wider">Convocation Attendance</CardTitle>
                <CardDescription className="text-[11px] text-slate-500">
                  Confirm whether you will attend the convocation day.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">


                <div className="space-y-2">
                  <Label htmlFor="attendanceChoice" className="sr-only">Attendance Choice</Label>
                  <select
                    id="attendanceChoice"
                    disabled={isLocked || saving}
                    value={attendingConvocation === null ? '' : attendingConvocation ? 'true' : 'false'}
                    onChange={(e) => {
                      const val = e.target.value;
                      const booleanVal = val === '' ? null : val === 'true';
                      handleAttendanceChange(booleanVal);
                    }}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 h-9 disabled:opacity-75"
                  >
                    <option value="" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Choose option...</option>
                    <option value="true" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">I will attend the convocation</option>
                    <option value="false" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">I will not attend the convocation (in absentia)</option>
                  </select>
                </div>
              </CardContent>
            </Card>

            {/* Core Action buttons */}
            {!isLocked && (
              <div className="space-y-3 pt-2">
                <Button
                  onClick={() => {
                    if (confirm('Are you sure you want to submit? Once submitted, you will not be able to make any further changes.')) {
                      handleSubmitResponse();
                    }
                  }}
                  disabled={
                    saving || 
                    attendingConvocation === null || 
                    !photoUrl || 
                    !slipUrl
                  }
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 rounded-xl text-xs transition relative shadow-lg shadow-blue-500/20 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin text-white mx-auto" />
                  ) : (
                    'Submit Response'
                  )}
                  {attendingConvocation === null ? (
                    <span className="block text-[8px] text-blue-300 font-normal mt-0.5">(Choose attendance option to enable)</span>
                  ) : (!photoUrl || !slipUrl) ? (
                    <span className="block text-[8px] text-blue-300 font-normal mt-0.5">(Upload documents to enable)</span>
                  ) : null}
                </Button>

                {hasAnyInput && (
                  <Button
                    onClick={handleClearInputs}
                    disabled={saving}
                    variant="outline"
                    className="w-full border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-600 dark:text-red-400 font-bold h-10 rounded-xl text-xs transition"
                  >
                    Clear All Inputs
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-900 py-6 text-center text-xs text-slate-500 dark:text-slate-600 mt-12 transition-colors duration-200">
        © {new Date().getFullYear()} Exam Division, Rajarata University of Sri Lanka, All Rights Reserved.
      </footer>
    </div>
  );
}
