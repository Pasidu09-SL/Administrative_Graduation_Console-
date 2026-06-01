'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ThemeToggle } from '@/components/ThemeToggle';
import { GraduationCap, ShieldCheck, Mail, KeyRound, Loader2 } from 'lucide-react';

export default function EntryPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [indexNo, setIndexNo] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Trigger passwordless MFA OTP
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !indexNo) return;
    
    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      const res = await fetch('/api/student/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, index_no: indexNo }),
      });

      const data = await res.json();
      if (res.ok) {
        setStep('otp');
        setInfo('A 6-digit verification code has been generated and printed to the system logs.');
      } else {
        if (data.code === 'PORTAL_CLOSED') {
          setError('Portal Closed: Registration access is currently inactive outside the configured timeline.');
        } else {
          setError(data.error || 'Student authentication checkpoint failed.');
        }
      }
    } catch (err) {
      setError('A network error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP code and login
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/student/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, index_no: indexNo, code: otp }),
      });

      const data = await res.json();
      if (res.ok) {
        // Redirect to RLS student dashboard
        router.push('/student');
      } else {
        setError(data.error || 'Verification code is invalid or has expired.');
      }
    } catch (err) {
      setError('A network error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 flex flex-col relative overflow-hidden transition-colors duration-200">
      {/* Background Gradient Glows */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-blue-600/5 dark:bg-blue-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-blue-500/5 dark:bg-blue-500/10 blur-[120px] pointer-events-none" />

      {/* Top Navbar */}
      <header className="border-b border-slate-200 dark:border-slate-900 bg-white/70 dark:bg-slate-950/70 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600/10 dark:bg-blue-600/20 text-blue-600 dark:text-blue-500 rounded-xl border border-blue-500/20 dark:border-blue-500/30">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold tracking-wider text-slate-500 dark:text-slate-400 block uppercase leading-none">University Office</span>
            <span className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white mt-1 block">Unified Graduation Portal</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button
            variant="outline"
            onClick={() => router.push('/admin')}
            className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white gap-2 rounded-xl text-xs font-semibold"
          >
            <ShieldCheck className="h-4 w-4 text-blue-500" />
            Exam Division Login
          </Button>
        </div>
      </header>

      {/* Main Grid View */}
      <main className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-12 max-w-7xl mx-auto w-full px-6 py-12">
        {/* Left column: Info section */}
        <div className="flex-1 space-y-6 lg:max-w-md">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-semibold border border-blue-500/20 dark:border-blue-500/25">
            2026 Academic Session
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-none text-slate-900 dark:text-white">
            Secure Student <br />
            <span className="bg-gradient-to-r from-blue-600 to-blue-500 dark:from-blue-400 dark:to-blue-600 bg-clip-text text-transparent">Self-Service Console</span>
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
            Welcome to the secure graduation registration system. Here you can verify your academic credentials, request name spelling corrections, upload graduation documentation (photo & slips), and confirm attendance.
          </p>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200 dark:border-slate-900">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Security Protocol</span>
              <span className="text-sm font-bold text-slate-800 dark:text-slate-300">PostgreSQL RLS</span>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Login MFA</span>
              <span className="text-sm font-bold text-slate-800 dark:text-slate-300">Secure OTP</span>
            </div>
          </div>
        </div>

        {/* Right column: Login Card */}
        <div className="w-full max-w-md">
          <Card className="border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/30 backdrop-blur-md rounded-3xl shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-blue-500 via-sky-500 to-blue-600" />
            <CardHeader className="space-y-1 pb-6">
              <CardTitle className="text-xl font-extrabold text-slate-900 dark:text-white">Student Authenticator</CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                Verify index number and secure MFA verification.
              </CardDescription>
            </CardHeader>

            <CardContent>
              {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/45 border border-red-200 dark:border-red-500/35 text-red-700 dark:text-red-300 rounded-xl text-xs font-semibold">
                  {error}
                </div>
              )}
              {info && (
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/45 border border-blue-200 dark:border-blue-500/35 text-blue-700 dark:text-blue-300 rounded-xl text-xs font-semibold">
                  {info}
                </div>
              )}

              {step === 'credentials' ? (
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      University Email Address
                    </Label>
                    <div className="relative">
                      <Input
                        id="email"
                        type="email"
                        placeholder="student@science.cmb.ac.lk"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl pl-10 text-sm h-11"
                      />
                      <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400 dark:text-slate-600" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="indexNo" className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      Student Index Number
                    </Label>
                    <div className="relative">
                      <Input
                        id="indexNo"
                        type="text"
                        placeholder="22001015"
                        value={indexNo}
                        onChange={(e) => setIndexNo(e.target.value)}
                        required
                        className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl pl-10 text-sm h-11"
                      />
                      <KeyRound className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400 dark:text-slate-600" />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 rounded-xl mt-2 relative transition-colors shadow-lg shadow-blue-500/20"
                  >
                    {loading ? (
                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-white" />
                    ) : (
                      'Request Verification OTP'
                    )}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="otp" className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block text-center mb-2">
                      Enter 6-Digit Verification Code
                    </Label>
                    <Input
                      id="otp"
                      type="text"
                      maxLength={6}
                      placeholder="• • • • • •"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      required
                      className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl text-center text-2xl font-bold tracking-[0.5em] h-14"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 rounded-xl mt-2 shadow-lg shadow-blue-500/20"
                  >
                    {loading ? (
                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-white" />
                    ) : (
                      'Verify & Enter Portal'
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="link"
                    onClick={() => setStep('credentials')}
                    className="w-full text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-xs font-semibold mt-1"
                  >
                    Back to login details
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-900 py-6 text-center text-xs text-slate-500 dark:text-slate-600 transition-colors duration-200">
        © 2026 University Exam Division. Enforced Row-Level Secure Environment. All rights reserved.
      </footer>
    </div>
  );
}
