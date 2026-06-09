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
  const [nicNo, setNicNo] = useState('');
  const [token, setToken] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isEmailLocked, setIsEmailLocked] = useState(false);
  const [isTokenMissing, setIsTokenMissing] = useState(false);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const emailParam = params.get('email');
      const tokenParam = params.get('token');
      if (emailParam) {
        setEmail(emailParam);
        setIsEmailLocked(true);
      }
      if (tokenParam) {
        setToken(tokenParam);
        setIsTokenMissing(false);
      } else {
        setIsTokenMissing(true);
        setError('Access Denied: Please use the unique registration link sent to your email to access this portal.');
      }
      const errorParam = params.get('error');
      if (errorParam) {
        setError(errorParam);
      }
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !indexNo || !nicNo || !token) return;
    
    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      const res = await fetch('/api/student/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, index_no: indexNo, nic_no: nicNo, token }),
      });

      const data = await res.json();
      if (res.ok) {
        // Redirect to RLS student dashboard
        router.push('/student');
      } else {
        if (data.code === 'PORTAL_CLOSED') {
          setError('Portal Closed: Registration access is currently inactive outside the configured timeline.');
        } else {
          setError(data.error || 'Student credentials verification failed.');
        }
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
            <span className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white block">Graduation Registration Portal</span>
            <span className="text-[10px] font-bold tracking-wider text-slate-500 dark:text-slate-400 block uppercase mt-0.5">Rajarata University of Sri Lanka</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
        </div>
      </header>

      {/* Main Grid View */}
      <main className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-12 max-w-7xl mx-auto w-full px-6 py-12">
        {/* Left column: Info section */}
        <div className="flex-1 space-y-6 lg:max-w-md">
          {/* University crest logo */}
          <div className="flex items-center">
            <img src="/templates/RUSL.png" alt="Rajarata University of Sri Lanka Logo" className="w-30 h-25 object-contain" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-semibold border border-blue-500/20 dark:border-blue-500/25">
            Convocation {new Date().getFullYear()}
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-none text-slate-900 dark:text-white">
            Student <br />
            <span className="bg-gradient-to-r from-blue-600 to-blue-500 dark:from-blue-400 dark:to-blue-600 bg-clip-text text-transparent">Registration Console</span>
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
            Welcome to the graduation registration system of Rajarata University of Sri Lanka. Here you can verify your academic credentials, request name spelling corrections, upload graduation documentation (photo & slips), and confirm attendance.
          </p>
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

                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      University Email Address
                    </Label>
                    <div className="relative">
                      <Input
                        id="email"
                        type="email"
                        placeholder="student@uni.ac.lk"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={isEmailLocked || isTokenMissing}
                        className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl pl-10 text-sm h-11 disabled:opacity-75 disabled:cursor-not-allowed"
                      />
                      <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400 dark:text-slate-600" />
                    </div>
                    {isEmailLocked && !isTokenMissing && (
                      <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold mt-1">
                        ✓ Email pre-filled and locked from verification link.
                      </p>
                    )}
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
                        disabled={isTokenMissing}
                        className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl pl-10 text-sm h-11 disabled:opacity-75"
                      />
                      <KeyRound className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400 dark:text-slate-600" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="nicNo" className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      NIC Number
                    </Label>
                    <div className="relative">
                      <Input
                        id="nicNo"
                        type="text"
                        placeholder="200012345678"
                        value={nicNo}
                        onChange={(e) => setNicNo(e.target.value)}
                        required
                        disabled={isTokenMissing}
                        className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl pl-10 text-sm h-11 disabled:opacity-75"
                      />
                      <ShieldCheck className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400 dark:text-slate-600" />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading || isTokenMissing}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 rounded-xl mt-2 relative transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-white" />
                    ) : (
                      'Verify & Enter'
                    )}
                  </Button>
                </form>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-900 py-6 text-center text-xs text-slate-500 dark:text-slate-600 transition-colors duration-200">
        © {new Date().getFullYear()} Exam Division, Rajarata University of Sri Lanka, All Rights Reserved.
      </footer>
    </div>
  );
}
