'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell
} from '@/components/ui/table';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  GraduationCap, Plus, Upload, Check, X, ShieldAlert,
  Loader2, Calendar, Clock, ArrowRight, UserCheck, Trash2, Download, RefreshCw, AlertCircle, FileText, LogOut
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useRouter } from 'next/navigation';

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'degrees' | 'ingest' | 'timeline' | 'audit' | 'seating' | 'print'>('degrees');

  // Updated official Faculty Names according to user request
  const FACULTIES = [
    'Faculty of Technology',
    'Faculty of Applied Science',
    'Faculty of Management Studies',
    'Faculty of Social Science and Humanities',
    'Faculty of Agriculture',
    'Faculty of Medicine and Allied Science'
  ];

  // Global loading / error
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 1. COURSE MANAGER STATE
  const [degrees, setDegrees] = useState<any[]>([]);
  const [degCode, setDegCode] = useState('');
  const [degEn, setDegEn] = useState('');
  const [degSi, setDegSi] = useState('');
  const [degTa, setDegTa] = useState('');
  const [degType, setDegType] = useState<'Internal' | 'External'>('Internal');

  // 2. INGESTION STATE
  const [ingestFile, setIngestFile] = useState<File | null>(null);
  const [ingestFaculty, setIngestFaculty] = useState(FACULTIES[0]);
  const [stagingResults, setStagingResults] = useState<any[]>([]);
  const [isValidBatch, setIsValidBatch] = useState(false);
  const [showStagingModal, setShowStagingModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 3. TIMELINE STATE
  const [openDate, setOpenDate] = useState('');
  const [closeDate, setCloseDate] = useState('');
  const [isManuallyClosed, setIsManuallyClosed] = useState(false);
  const [timelineConfig, setTimelineConfig] = useState<any>(null);

  // 4. AUDIT STATE
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [filterFaculty, setFilterFaculty] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // 5. SEATING STATE
  const [sessionAllocations, setSessionAllocations] = useState<any[]>([]);
  const [allocateFaculty, setAllocateFaculty] = useState(FACULTIES[0]);
  const [allocateSession, setAllocateSession] = useState('1');

  // 6. CERTIFICATE PRINT STATE
  const [printStatus, setPrintStatus] = useState<any>({ status: 'idle', current: 0, total: 0, error: null, outputPath: null });

  // ----------------------------------------------------
  // DATA FETCHING HOOKS
  // ----------------------------------------------------
  const loadDegrees = async () => {
    const res = await fetch('/api/degrees');
    const json = await res.json();
    if (res.ok) setDegrees(json.data);
  };

  const loadTimeline = async () => {
    const res = await fetch('/api/timeline');
    const json = await res.json();
    if (res.ok && json.data) {
      setTimelineConfig(json.data);
      setOpenDate(new Date(json.data.open_date).toISOString().slice(0, 16));
      setCloseDate(new Date(json.data.close_date).toISOString().slice(0, 16));
      setIsManuallyClosed(json.data.is_manually_closed || false);
    }
  };

  const loadStudents = async () => {
    const query = new URLSearchParams();
    if (filterFaculty) query.append('faculty', filterFaculty);
    if (filterStatus) query.append('status', filterStatus);

    const res = await fetch(`/api/admin/review?${query.toString()}`);
    const json = await res.json();
    if (res.ok) {
      setStudents(json.data);
      if (json.data.length > 0 && !selectedStudent) {
        setSelectedStudent(json.data[0]);
      }
    }
  };

  const loadAuditLogs = async () => {
    const res = await fetch('/api/admin/logs');
    const json = await res.json();
    if (res.ok) setAuditLogs(json.data);
  };

  const loadSessionAllocations = async () => {
    const res = await fetch('/api/admin/sessions');
    const json = await res.json();
    if (res.ok) setSessionAllocations(json.data);
  };

  const loadPrintStatus = async () => {
    const res = await fetch('/api/admin/certificates');
    const json = await res.json();
    if (res.ok) setPrintStatus(json.data);
  };

  useEffect(() => {
    loadDegrees();
    loadTimeline();
    loadStudents();
    loadAuditLogs();
    loadSessionAllocations();
    loadPrintStatus();
  }, [activeTab, filterFaculty, filterStatus]);

  // Periodic polling for PDF worker status
  useEffect(() => {
    let interval: any;
    if (printStatus?.status === 'processing') {
      interval = setInterval(() => {
        loadPrintStatus();
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [printStatus?.status]);

  // Helper alerts trigger
  const triggerAlert = (success: boolean, msg: string) => {
    if (success) {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(null), 5000);
    } else {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(null), 5000);
    }
  };

  // ----------------------------------------------------
  // ACTION HANDLERS
  // ----------------------------------------------------

  // 1. ADD DEGREE
  const handleAddDegree = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/degrees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: degCode,
          name_en: degEn,
          name_si: degSi,
          name_ta: degTa,
          type: degType
        })
      });

      const json = await res.json();
      if (res.ok) {
        triggerAlert(true, 'Degree course added successfully!');
        setDegCode('');
        setDegEn('');
        setDegSi('');
        setDegTa('');
        loadDegrees();
      } else {
        triggerAlert(false, json.error || 'Validation failed. Check entries.');
      }
    } catch (err) {
      triggerAlert(false, 'Network error.');
    } finally {
      setLoading(false);
    }
  };

  // 2. PARSE AND UPLOAD BULK STAGING DATA
  const handleIngestFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setIngestFile(file);
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        // Parse rows by index based on specified order:
        // no, reg no, index no, full name, name with initials, gpa, class, degree, email, address, contact no
        const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (data.length === 0) {
          triggerAlert(false, 'Uploaded Excel sheet is empty.');
          return;
        }

        // Detect if first row is a header row
        const firstRow = data[0];
        const isHeader = firstRow && firstRow.some(cell => {
          if (typeof cell === 'string') {
            const lower = cell.toLowerCase().trim();
            return ['no', 'reg no', 'index no', 'full name', 'name with initials', 'gpa', 'class', 'degree', 'email', 'address', 'contact no'].includes(lower);
          }
          return false;
        });

        const startIdx = isHeader ? 1 : 0;
        const mappedRows = [];

        for (let idx = startIdx; idx < data.length; idx++) {
          const r = data[idx];
          if (!r || r.length === 0) continue;
          
          // Skip completely empty rows
          if (r.every(cell => cell === undefined || cell === null || cell === '')) continue;
          
          mappedRows.push({
            registration_no: r[1] !== undefined && r[1] !== null ? String(r[1]).trim() : '',
            index_no: r[2] !== undefined && r[2] !== null ? String(r[2]).trim() : '',
            full_name: r[3] !== undefined && r[3] !== null ? String(r[3]).trim() : '',
            name_with_initials: r[4] !== undefined && r[4] !== null ? String(r[4]).trim() : '',
            gpa: r[5] !== undefined && r[5] !== null && r[5] !== '' ? r[5] : null,
            class: r[6] !== undefined && r[6] !== null ? String(r[6]).trim() : '',
            degree_name: r[7] !== undefined && r[7] !== null ? String(r[7]).trim() : '',
            email: r[8] !== undefined && r[8] !== null ? String(r[8]).trim() : '',
            address: r[9] !== undefined && r[9] !== null ? String(r[9]).trim() : '',
            contact_no: r[10] !== undefined && r[10] !== null ? String(r[10]).trim() : '',
            faculty: ingestFaculty
          });
        }

        // Send to staging validation endpoint
        const res = await fetch('/api/ingestion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: mappedRows })
        });

        const json = await res.json();
        if (res.ok) {
          setStagingResults(json.results);
          setIsValidBatch(json.isValidBatch);
          setShowStagingModal(true); // Open the preview modal automatically
          triggerAlert(true, `Excel parsed. ${json.results.length} rows loaded into validation staging grid.`);
        } else {
          triggerAlert(false, json.error || 'Failed parsing bulk upload.');
        }
      } catch (err: any) {
        triggerAlert(false, err.message);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleCommitIngest = async () => {
    if (!isValidBatch || stagingResults.length === 0) return;
    setLoading(true);
    try {
      const rowsToInsert = stagingResults.map(r => ({
        ...r.data,
        degreeId: r.degreeId
      }));

      const res = await fetch('/api/ingestion/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: rowsToInsert })
      });

      const json = await res.json();
      if (res.ok) {
        triggerAlert(true, `Successfully committed ${json.count} student records to production database in ${json.durationMs}ms.`);
        setStagingResults([]);
        setIngestFile(null);
        setIsValidBatch(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
        loadStudents();
      } else {
        triggerAlert(false, json.error || 'Failed to commit staging records.');
      }
    } catch (err) {
      triggerAlert(false, 'Network error.');
    } finally {
      setLoading(false);
    }
  };

  // 3. SET TIMELINE WINDOW
  const handleSaveTimeline = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/timeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          open_date: new Date(openDate).toISOString(),
          close_date: new Date(closeDate).toISOString(),
          is_manually_closed: isManuallyClosed
        })
      });

      const json = await res.json();
      if (res.ok) {
        triggerAlert(true, 'Timeline dates updated successfully.');
        setTimelineConfig(json.data);
      } else {
        triggerAlert(false, json.errors?.close_date?.[0] || json.error || 'Invalid date window bounds.');
      }
    } catch (err) {
      triggerAlert(false, 'Network error.');
    } finally {
      setLoading(false);
    }
  };

  // 4. AUDIT REVIEWS: APPROVE / REJECT
  const handleApproveStudent = async () => {
    if (!selectedStudent) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: selectedStudent.id,
          action: 'approve',
          adminId: 'ADMIN_EXAM_COORDINATOR'
        })
      });

      const json = await res.json();
      if (res.ok) {
        triggerAlert(true, 'Student profile approved and name corrections updated.');
        loadStudents();
        loadAuditLogs();
        setSelectedStudent(null);
      } else {
        triggerAlert(false, json.error || 'Approve action failed.');
      }
    } catch (err) {
      triggerAlert(false, 'Network error.');
    } finally {
      setLoading(false);
    }
  };

  const handleRejectStudent = async () => {
    if (!selectedStudent || !rejectReason) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: selectedStudent.id,
          action: 'reject',
          rejectReason,
          adminId: 'ADMIN_EXAM_COORDINATOR'
        })
      });

      const json = await res.json();
      if (res.ok) {
        triggerAlert(true, 'Registration profile rejected and successfully unlocked for student correction.');
        setShowRejectDialog(false);
        setRejectReason('');
        loadStudents();
        loadAuditLogs();
        setSelectedStudent(null);
      } else {
        triggerAlert(false, json.error || 'Reject action failed.');
      }
    } catch (err) {
      triggerAlert(false, 'Network error.');
    } finally {
      setLoading(false);
    }
  };

  // 5. SESSION ALLOCATION
  const handleAllocateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/admin/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          faculty: allocateFaculty,
          sessionNumber: allocateSession
        })
      });

      const json = await res.json();
      if (res.ok) {
        triggerAlert(true, `Successfully assigned ${allocateFaculty} list to Session ${allocateSession}. Serial numbers computed.`);
        loadSessionAllocations();
        loadStudents();
      } else {
        triggerAlert(false, json.error || 'Seating allocation algorithm error.');
      }
    } catch (err) {
      triggerAlert(false, 'Network error.');
    } finally {
      setLoading(false);
    }
  };

  // 6. CERTIFICATE PRINT PIPELINE
  const handleTriggerPrint = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/certificates', { method: 'POST' });
      const json = await res.json();
      if (res.status === 202) {
        triggerAlert(true, 'Duplex certificate compilation queue initiated in isolated background worker.');
        loadPrintStatus();
      } else {
        triggerAlert(false, json.error || 'Generation trigger failed.');
      }
    } catch (err) {
      triggerAlert(false, 'Network error.');
    } finally {
      setLoading(false);
    }
  };

  const renderStagingGrid = (isModal: boolean) => {
    if (stagingResults.length === 0) return null;
    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Staging Data Validation Grid
            </h3>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Cell highlights indicate structural or references mismatches.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isModal && (
              <Button
                variant="outline"
                onClick={() => setShowStagingModal(false)}
                className="border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-950 text-slate-700 dark:text-slate-350 rounded-xl text-xs font-bold h-9 px-4"
              >
                Close Preview
              </Button>
            )}
            <Button
              onClick={handleCommitIngest}
              disabled={loading || !isValidBatch}
              className={`font-bold h-9 text-xs rounded-xl px-4 flex items-center gap-1.5 transition ${
                isValidBatch 
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow' 
                  : 'bg-slate-100 dark:bg-slate-900 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-800'
              }`}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Commit Validated Registry
            </Button>
          </div>
        </div>

        <div className="border border-slate-200 dark:border-slate-900 rounded-xl overflow-x-auto overflow-y-auto max-h-[400px]">
          <Table className="text-[11px] whitespace-nowrap min-w-[1300px]">
            <TableHeader className="bg-slate-100 dark:bg-slate-950/70 sticky top-0 z-10">
              <TableRow className="border-b border-slate-200 dark:border-slate-900">
                <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-3 py-2 w-12">Row</TableHead>
                <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-3 py-2">Index No</TableHead>
                <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-3 py-2">Reg No</TableHead>
                <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-3 py-2">Full Name</TableHead>
                <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-3 py-2">Name with Initials</TableHead>
                <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-3 py-2">Email Address</TableHead>
                <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-3 py-2">Degree</TableHead>
                <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-3 py-2">GPA</TableHead>
                <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-3 py-2">Class</TableHead>
                <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-3 py-2">Errors</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-200 dark:divide-slate-900">
              {stagingResults.map((r, i) => (
                <TableRow key={i} className={`border-b border-slate-200 dark:border-slate-900 hover:bg-slate-100/30 dark:hover:bg-slate-900/10 transition-colors ${
                  !r.isValid ? 'bg-red-500/5 dark:bg-red-950/15' : ''
                }`}>
                  <TableCell className="px-3 py-2 text-slate-400 dark:text-slate-500 font-bold">{r.rowNumber}</TableCell>
                  <TableCell className={`px-3 py-2 font-bold ${r.errors.index_no ? 'text-red-600 dark:text-red-400 bg-red-500/5 dark:bg-red-950/20' : 'text-slate-800 dark:text-slate-200'}`}>
                    {r.data.index_no}
                  </TableCell>
                  <TableCell className={`px-3 py-2 ${r.errors.registration_no ? 'text-red-600 dark:text-red-400 bg-red-500/5 dark:bg-red-950/20' : 'text-slate-700 dark:text-slate-300'}`}>
                    {r.data.registration_no}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-slate-800 dark:text-slate-300 font-semibold">{r.data.full_name}</TableCell>
                  <TableCell className="px-3 py-2 text-slate-800 dark:text-slate-300 font-semibold">{r.data.name_with_initials}</TableCell>
                  <TableCell className={`px-3 py-2 ${r.errors.email ? 'text-red-600 dark:text-red-400 bg-red-500/5 dark:bg-red-950/20' : 'text-slate-600 dark:text-slate-400'}`}>
                    {r.data.email}
                  </TableCell>
                  <TableCell className={`px-3 py-2 ${r.errors.degree_name ? 'text-red-600 dark:text-red-400 bg-red-500/5 dark:bg-red-950/20' : 'text-slate-800 dark:text-slate-300'}`}>
                    {r.data.degree_name}
                  </TableCell>
                  <TableCell className={`px-3 py-2 ${r.errors.gpa ? 'text-red-600 dark:text-red-400 bg-red-500/5 dark:bg-red-950/20' : 'text-slate-700 dark:text-slate-300'}`}>
                    {r.data.gpa}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-slate-700 dark:text-slate-300">{r.data.class}</TableCell>
                  <TableCell className="px-3 py-2 text-red-650 dark:text-red-400 font-medium whitespace-normal break-words min-w-[250px]">
                    {Object.values(r.errors).join('; ')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 flex flex-col font-sans transition-colors duration-200">
      {/* Top Navbar */}
      <header className="border-b border-slate-200 dark:border-slate-900 bg-white/70 dark:bg-slate-950/70 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600/10 dark:bg-blue-600/20 text-blue-600 dark:text-blue-500 rounded-xl border border-blue-500/20 dark:border-blue-500/30">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold tracking-wider text-slate-500 dark:text-slate-400 block uppercase leading-none">Exam Division Portal</span>
            <span className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white mt-1 block">Administrative Graduation Console</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Button
            variant="ghost"
            onClick={() => router.push('/')}
            className="text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white text-xs font-semibold"
          >
            ← Back to Student Portal
          </Button>
        </div>
      </header>

      {/* Main Admin Tabbed Interface */}
      <div className="flex-1 w-full flex flex-col md:flex-row">
        
        {/* Left Side Sidebar Navigation */}
        <aside className="w-full md:w-72 flex flex-col justify-between border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-6 md:sticky md:top-[73px] md:h-[calc(100vh-73px)] gap-6 shrink-0 z-40 transition-colors">
          <div className="flex flex-col gap-2">
            {[
              { id: 'degrees', label: 'Course Manager' },
              { id: 'ingest', label: 'Bulk Data Ingestion' },
              { id: 'timeline', label: 'Timeline Control' },
              { id: 'audit', label: 'Split Audit Center' },
              { id: 'seating', label: 'Session and Seating' },
              { id: 'print', label: 'Certificate Generation' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/10'
                    : 'bg-white dark:bg-slate-900/40 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800 pt-4 mt-auto space-y-3">
            <div className="flex items-center gap-3 px-2">
              <div className="h-8 w-8 rounded-full bg-blue-600/10 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs border border-blue-500/20">
                EC
              </div>
              <div>
                <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200 leading-none">Exam Coordinator</div>
                <div className="text-[9px] text-slate-555 dark:text-slate-500 font-medium mt-1">Exam Division Staff</div>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => router.push('/')}
              className="w-full border-red-200 dark:border-red-950/40 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-655 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 rounded-xl text-xs font-bold gap-2 h-9"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </aside>

        {/* Right Side Main Workspaces */}
        <main className="flex-1 min-w-0 p-8 space-y-6 bg-slate-50/50 dark:bg-slate-950/20">
          {successMsg && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-bold flex items-center gap-2">
              <Check className="h-4 w-4" />
              {successMsg}
            </div>
          )}
          {errorMsg && (
            <div className="p-3 bg-red-50 dark:bg-red-950/45 border border-red-200 dark:border-red-500/35 text-red-700 dark:text-red-300 rounded-xl text-xs font-bold flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {errorMsg}
            </div>
          )}

          {/* 1. COURSE MANAGER WORKSPACE */}
          {activeTab === 'degrees' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Form to Add Degree */}
                <Card className="border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/30 backdrop-blur-md rounded-2xl lg:col-span-1 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base font-bold text-slate-950 dark:text-white">Add University Degree</CardTitle>
                    <CardDescription className="text-[11px] text-slate-500">Official multi-lingual metadata registry.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleAddDegree} className="space-y-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="degCode" className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Degree Code</Label>
                        <Input id="degCode" required value={degCode} onChange={(e) => setDegCode(e.target.value)} placeholder="BSc-CS" className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 text-xs rounded-lg h-9" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="degEn" className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Degree Name (English)</Label>
                        <Input id="degEn" required value={degEn} onChange={(e) => setDegEn(e.target.value)} placeholder="BSc in Computer Science" className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 text-xs rounded-lg h-9" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="degSi" className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Degree Name (Sinhala)</Label>
                        <Input id="degSi" required value={degSi} onChange={(e) => setDegSi(e.target.value)} placeholder="පරිගණක විද්‍යා උපාධිය" className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 text-xs rounded-lg h-9" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="degTa" className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Degree Name (Tamil)</Label>
                        <Input id="degTa" required value={degTa} onChange={(e) => setDegTa(e.target.value)} placeholder="கணினி அறிவியல் பட்டம்" className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 text-xs rounded-lg h-9" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="degType" className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Degree Type</Label>
                        <select
                          id="degType"
                          value={degType}
                          onChange={(e) => setDegType(e.target.value as any)}
                          className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 text-xs text-slate-800 dark:text-slate-300 px-3 py-2 rounded-lg focus:outline-none"
                        >
                          <option value="Internal">Internal</option>
                          <option value="External">External</option>
                        </select>
                      </div>
                      <Button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-9 text-xs rounded-lg mt-2 shadow">
                        {loading ? <Loader2 className="h-4 w-4 animate-spin mx-auto text-white" /> : 'Register Degree'}
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                {/* Table displaying Degrees */}
                <Card className="border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/30 backdrop-blur-md rounded-2xl lg:col-span-2 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base font-bold text-slate-950 dark:text-white">Degree Registry</CardTitle>
                    <CardDescription className="text-[11px] text-slate-500">Currently configured academic programs.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0 overflow-hidden border-t border-slate-100 dark:border-slate-900">
                    <Table className="text-xs">
                      <TableHeader className="bg-slate-100/50 dark:bg-slate-950/50">
                        <TableRow className="border-b border-slate-200 dark:border-slate-900">
                          <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-4 py-3">Code</TableHead>
                          <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-4 py-3">Name (English)</TableHead>
                          <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-4 py-3">Type</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="divide-y divide-slate-100 dark:divide-slate-900 font-medium">
                        {degrees.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center py-8 text-slate-500">No degrees registered. Add one using the form.</TableCell>
                          </TableRow>
                        ) : (
                          degrees.map((d) => (
                            <TableRow key={d.id} className="border-b border-slate-200 dark:border-slate-900 hover:bg-slate-100/30 dark:hover:bg-slate-900/10 transition-colors">
                              <TableCell className="px-4 py-2.5 font-bold text-slate-900 dark:text-white">{d.code}</TableCell>
                              <TableCell className="px-4 py-2.5 text-slate-800 dark:text-slate-300">
                                <div>{d.name_en}</div>
                                <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{d.name_si} | {d.name_ta}</div>
                              </TableCell>
                              <TableCell className="px-4 py-2.5">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  d.type === 'Internal' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20'
                                }`}>
                                  {d.type}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* 2. BULK DATA INGESTION WORKSPACE */}
          {activeTab === 'ingest' && (
            <div className="space-y-6">
              <Card className="border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/30 backdrop-blur-md rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base font-bold text-slate-950 dark:text-white">Bulk Faculty Student Onboarding</CardTitle>
                  <CardDescription className="text-[11px] text-slate-500">Upload official Excel or CSV student registry list.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div className="space-y-1.5 col-span-1">
                      <Label htmlFor="ingestFaculty" className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Target Faculty</Label>
                      <select
                        id="ingestFaculty"
                        value={ingestFaculty}
                        onChange={(e) => setIngestFaculty(e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 text-xs text-slate-800 dark:text-slate-300 px-3 py-2.5 rounded-lg focus:outline-none h-10"
                      >
                        {FACULTIES.map((f) => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>

                    <div className="space-y-1.5 col-span-2">
                      <Label htmlFor="excelFile" className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Select Excel / CSV Registry Sheet</Label>
                      <Input
                        ref={fileInputRef}
                        id="excelFile"
                        type="file"
                        accept=".xlsx, .xls, .csv"
                        onChange={handleIngestFileChange}
                        disabled={loading}
                        className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 text-xs file:bg-blue-600/10 file:border-0 file:text-blue-600 dark:file:text-blue-500 file:text-xs file:font-semibold file:px-3 file:py-1.5 file:mr-3 rounded-lg cursor-pointer h-10"
                      />
                    </div>
                  </div>

                  {/* Validation Staging Grid - Inline Normal View */}
                  {stagingResults.length > 0 && (
                    <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-900">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-550 dark:text-slate-400">Staging Data details are loaded.</span>
                        <Button
                          variant="outline"
                          onClick={() => setShowStagingModal(true)}
                          className="border-slate-200 dark:border-slate-800 text-blue-600 hover:text-blue-750 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/20 text-xs font-bold h-8 rounded-lg px-3"
                        >
                          Re-open Pop-up View
                        </Button>
                      </div>
                      {renderStagingGrid(false)}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* 3. TIMELINE & WINDOW CONTROL WORKSPACE */}
          {activeTab === 'timeline' && (
            <div className="space-y-6">
              <Card className="border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/30 backdrop-blur-md rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base font-bold text-slate-950 dark:text-white">System Access Timeline</CardTitle>
                  <CardDescription className="text-[11px] text-slate-500">Configure global calendar and clock datetime bounds for student access.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <form onSubmit={handleSaveTimeline} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="openDate" className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block">
                          Portal Open Date & Time
                        </Label>
                        <div className="relative">
                          <Input
                            id="openDate"
                            type="datetime-local"
                            value={openDate}
                            onChange={(e) => setOpenDate(e.target.value)}
                            required
                            className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:border-blue-500 rounded-xl pl-10 text-xs h-11"
                          />
                          <Calendar className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400 dark:text-slate-600" />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="closeDate" className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block">
                          Portal Close Date & Time
                        </Label>
                        <div className="relative">
                          <Input
                            id="closeDate"
                            type="datetime-local"
                            value={closeDate}
                            onChange={(e) => setCloseDate(e.target.value)}
                            required
                            className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:border-blue-500 rounded-xl pl-10 text-xs h-11"
                          />
                          <Clock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400 dark:text-slate-600" />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-900 pt-6">
                      <div className="text-xs text-slate-600 dark:text-slate-400">
                        Date Window Check: {
                          timelineConfig && new Date() >= new Date(timelineConfig.open_date) && new Date() <= new Date(timelineConfig.close_date) && !isManuallyClosed
                            ? <span className="text-emerald-600 dark:text-emerald-400 font-bold">Active / Open</span>
                            : <span className="text-red-600 dark:text-red-400 font-bold">Inactive / Closed</span>
                        }
                      </div>
                      <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-10 rounded-xl px-6 text-xs transition">
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Date Settings'}
                      </Button>
                    </div>
                  </form>

                  {/* Emergency Manual Override Portal Open/Close Toggle Button */}
                  <div className="p-4 bg-slate-100 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-slate-950 dark:text-white block">Manual Emergency Toggle</span>
                      <span className="text-[10px] text-slate-500 block leading-tight">Instantly open or lock the portal, bypassing the date schedule settings.</span>
                    </div>
                    <Button
                      type="button"
                      disabled={loading || !openDate || !closeDate}
                      onClick={async () => {
                        const nextState = !isManuallyClosed;
                        setIsManuallyClosed(nextState);
                        setLoading(true);
                        try {
                          const res = await fetch('/api/timeline', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              open_date: new Date(openDate).toISOString(),
                              close_date: new Date(closeDate).toISOString(),
                              is_manually_closed: nextState
                            })
                          });
                          if (res.ok) {
                            const json = await res.json();
                            setTimelineConfig(json.data);
                            triggerAlert(true, nextState ? 'Emergency override active: Portal manual close triggered.' : 'Override disabled: Resumed standard date timeline schedule.');
                          }
                        } catch {
                          triggerAlert(false, 'Override toggling connection error.');
                        } finally {
                          setLoading(false);
                        }
                      }}
                      className={`font-bold text-xs h-10 px-5 rounded-xl transition ${
                        isManuallyClosed
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow shadow-emerald-500/20'
                          : 'bg-red-600 hover:bg-red-700 text-white shadow shadow-red-500/20'
                      }`}
                    >
                      {isManuallyClosed ? 'Emergency Open (Resume Dates)' : 'Emergency Close Instantly'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* 4. SPLIT AUDIT CENTER WORKSPACE */}
          {activeTab === 'audit' && (
            <div className="space-y-6">
              
              {/* Audit grid filters */}
              <div className="flex flex-col sm:flex-row gap-4">
                <select
                  value={filterFaculty}
                  onChange={(e) => setFilterFaculty(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-900 text-xs text-slate-800 dark:text-slate-300 px-3 py-2 rounded-xl focus:outline-none"
                >
                  <option value="">All Faculties</option>
                  {FACULTIES.map(f => <option key={f} value={f}>{f}</option>)}
                </select>

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-900 text-xs text-slate-800 dark:text-slate-300 px-3 py-2 rounded-xl focus:outline-none"
                >
                  <option value="">All Verification Statuses</option>
                  <option value="Pending Verification">Pending Verification</option>
                  <option value="Approved">Approved</option>
                  <option value="Name Correction Requested">Name Correction Requested</option>
                </select>
              </div>

              {students.length === 0 ? (
                <Card className="border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/30 backdrop-blur-md rounded-2xl py-12 text-center text-slate-500 text-xs shadow-sm">
                  No graduation records match the selected filters.
                </Card>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Left Column: Student List Selection */}
                  <Card className="border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/30 backdrop-blur-md rounded-2xl lg:col-span-1 max-h-[500px] overflow-y-auto shadow-sm">
                    <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-900">
                      <CardTitle className="text-sm font-bold text-slate-950 dark:text-white uppercase tracking-wider">Candidate Registry</CardTitle>
                    </CardHeader>
                    <CardContent className="p-2 space-y-1">
                      {students.map((st) => (
                        <div
                          key={st.id}
                          onClick={() => setSelectedStudent(st)}
                          className={`p-3 rounded-xl cursor-pointer transition text-left flex flex-col gap-1 border ${
                            selectedStudent?.id === st.id
                              ? 'bg-blue-600/10 border-blue-500 text-slate-900 dark:text-white'
                              : 'bg-slate-50/50 dark:bg-slate-950/20 border-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-slate-900/40 hover:text-slate-900 dark:hover:text-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold">{st.name_with_initials}</span>
                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${
                              st.verification_status === 'Approved' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' :
                              st.verification_status === 'Name Correction Requested' ? 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400' : 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                            }`}>
                              {st.verification_status === 'Pending Verification' ? 'Pending' : st.verification_status === 'Approved' ? 'Approved' : 'Correction'}
                            </span>
                          </div>
                          <div className="text-[10px] flex items-center justify-between text-slate-400 dark:text-slate-500 font-mono">
                            <span>{st.index_no}</span>
                            <span>{st.degree_code}</span>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Right Column: Split Screen Comparison View */}
                  {selectedStudent && (
                    <Card className="border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/30 backdrop-blur-md rounded-2xl lg:col-span-2 shadow-sm">
                      <CardHeader className="border-b border-slate-100 dark:border-slate-900 flex flex-row items-center justify-between pb-4">
                        <div>
                          <CardTitle className="text-sm font-bold text-slate-950 dark:text-white uppercase tracking-wider">Split-Screen Audit Console</CardTitle>
                          <CardDescription className="text-[10px] text-slate-500 mt-0.5">Compare faculty data against student submitted corrections.</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={handleApproveStudent}
                            disabled={loading || selectedStudent.verification_status === 'Approved'}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-8 text-[10px] px-3.5 rounded-lg flex items-center gap-1"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Approve
                          </Button>
                          <Button
                            onClick={() => setShowRejectDialog(true)}
                            disabled={loading}
                            className="bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-red-600 dark:text-red-400 border border-slate-200 dark:border-slate-850 font-bold h-8 text-[10px] px-3.5 rounded-lg flex items-center gap-1"
                          >
                            <X className="h-3.5 w-3.5" />
                            Reject & Unlock
                          </Button>
                        </div>
                      </CardHeader>

                      <CardContent className="p-4 grid grid-cols-2 divide-x divide-slate-200 dark:divide-slate-900">
                        {/* LEFT: Faculty Registry */}
                        <div className="pr-4 space-y-4">
                          <h4 className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Original Faculty Import</h4>
                          
                          <div className="space-y-1">
                            <span className="text-[9px] text-slate-400 dark:text-slate-600 font-bold block">FULL NAME</span>
                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-300 block">{selectedStudent.full_name}</span>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[9px] text-slate-400 dark:text-slate-600 font-bold block">GPA</span>
                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-300 block">{selectedStudent.gpa}</span>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[9px] text-slate-400 dark:text-slate-600 font-bold block">DEGREE CLASSIFICATION</span>
                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-300 block">{selectedStudent.class}</span>
                          </div>
                        </div>

                        {/* RIGHT: Student Submission */}
                        <div className="pl-4 space-y-4">
                          <h4 className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Student Submission</h4>
                          
                          <div className="space-y-1">
                            <span className="text-[9px] text-slate-400 dark:text-slate-600 font-bold block">SPELLING CORRECTION REQUEST</span>
                            {selectedStudent.name_correction_request ? (
                              <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 border border-blue-200 dark:border-blue-500/25 px-2 py-0.5 rounded block">
                                {selectedStudent.name_correction_request}
                              </span>
                            ) : (
                              <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 block italic">No correction requested</span>
                            )}
                          </div>

                          <div className="space-y-2">
                            <span className="text-[9px] text-slate-400 dark:text-slate-600 font-bold block">PROFILE PHOTO</span>
                            {selectedStudent.profile_photo_path ? (
                              <div className="relative aspect-square w-20 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 flex items-center justify-center">
                                <img src={selectedStudent.profile_photo_path} alt="Submission" className="object-cover w-full h-full" />
                              </div>
                            ) : (
                              <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 block italic">Photo missing</span>
                            )}
                          </div>

                          <div className="space-y-1.5">
                            <span className="text-[9px] text-slate-400 dark:text-slate-600 font-bold block">PAYMENT SLIP</span>
                            {selectedStudent.payment_slip_path ? (
                              <a
                                href={selectedStudent.payment_slip_path}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-500 hover:underline font-bold"
                              >
                                <FileText className="h-4 w-4" />
                                View Uploaded Slip
                              </a>
                            ) : (
                              <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 block italic">Receipt missing</span>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* Immutable Audit Trail Section */}
              <Card className="border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/30 backdrop-blur-md rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xs font-bold text-slate-950 dark:text-white uppercase tracking-wider">Immutable Audit Trail Logs</CardTitle>
                </CardHeader>
                <CardContent className="p-0 overflow-hidden border-t border-slate-100 dark:border-slate-900">
                  <Table className="text-xs">
                    <TableHeader className="bg-slate-100/50 dark:bg-slate-950/50">
                      <TableRow className="border-b border-slate-200 dark:border-slate-900">
                        <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-4 py-3">Timestamp</TableHead>
                        <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-4 py-3">Actor (Admin)</TableHead>
                        <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-4 py-3">Target Candidate</TableHead>
                        <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-4 py-3">Action Recorded</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-slate-200 dark:divide-slate-900 font-medium">
                      {auditLogs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-slate-500">No actions logged yet.</TableCell>
                        </TableRow>
                      ) : (
                        auditLogs.map((log) => (
                          <TableRow key={log.id} className="border-b border-slate-200 dark:border-slate-900 hover:bg-slate-100/30 dark:hover:bg-slate-900/10 transition-colors">
                            <TableCell className="px-4 py-2.5 text-slate-400 dark:text-slate-500 font-mono">{new Date(log.timestamp).toLocaleString()}</TableCell>
                            <TableCell className="px-4 py-2.5 font-bold text-slate-900 dark:text-white">{log.admin_id}</TableCell>
                            <TableCell className="px-4 py-2.5 text-slate-800 dark:text-slate-300">
                              <div>{log.name_with_initials}</div>
                              <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">{log.index_no} | {log.email}</div>
                            </TableCell>
                            <TableCell className="px-4 py-2.5 text-slate-600 dark:text-slate-400 font-semibold">{log.action_taken}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Rejection popup prompt */}
              {showRejectDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                  <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 w-full max-w-md mx-6 rounded-2xl relative shadow-2xl">
                    <CardHeader>
                      <CardTitle className="text-sm font-bold text-slate-950 dark:text-white uppercase tracking-wider">Provide Rejection Feedback</CardTitle>
                      <CardDescription className="text-[10px] text-slate-500 dark:text-slate-400">Explain the reason for rejecting spelling corrections or documents.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="rejReason" className="sr-only">Rejection Reason</Label>
                        <Input
                          id="rejReason"
                          type="text"
                          required
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="e.g. Spelling correction does not match NIC, or Payment slip blurry."
                          className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 text-xs rounded-lg h-10"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          onClick={() => { setShowRejectDialog(false); setRejectReason(''); }}
                          className="text-slate-500 hover:text-slate-800 dark:hover:text-white text-xs font-semibold"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleRejectStudent}
                          disabled={!rejectReason}
                          className="bg-red-600 hover:bg-red-700 text-white font-bold h-9 text-xs rounded-lg px-4"
                        >
                          Reject & Unlock
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}

          {/* 5. SESSION MANAGEMENT & SEATING ALLOCATION WORKSPACE */}
          {activeTab === 'seating' && (
            <div className="space-y-6">
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Allocator Form */}
                <Card className="border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/30 backdrop-blur-md rounded-2xl lg:col-span-1 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base font-bold text-slate-950 dark:text-white">Assign Faculty Session</CardTitle>
                    <CardDescription className="text-[11px] text-slate-500">Maps entire faculty list to graduation session slots.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleAllocateSession} className="space-y-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="allocFaculty" className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Select Faculty</Label>
                        <select
                          id="allocFaculty"
                          value={allocateFaculty}
                          onChange={(e) => setAllocateFaculty(e.target.value)}
                          className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 text-xs text-slate-800 dark:text-slate-300 px-3 py-2 rounded-lg focus:outline-none"
                        >
                          {FACULTIES.map((f) => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="allocSess" className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Target Session (1-4)</Label>
                        <select
                          id="allocSess"
                          value={allocateSession}
                          onChange={(e) => setAllocateSession(e.target.value)}
                          className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 text-xs text-slate-800 dark:text-slate-300 px-3 py-2 rounded-lg focus:outline-none"
                        >
                          <option value="1">Session 1</option>
                          <option value="2">Session 2</option>
                          <option value="3">Session 3</option>
                          <option value="4">Session 4</option>
                        </select>
                      </div>

                      <Button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-9 text-xs rounded-lg mt-2 flex items-center justify-center gap-1.5 shadow">
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        Allocate Seating
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                {/* Seating allocations list */}
                <Card className="border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/30 backdrop-blur-md rounded-2xl lg:col-span-2 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base font-bold text-slate-950 dark:text-white">Graduation Session Slots</CardTitle>
                    <CardDescription className="text-[11px] text-slate-500">Overview of 4 sessions housing up to 2 faculties each.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {[1, 2, 3, 4].map((sessNum) => {
                      const facultiesInSession = sessionAllocations.filter(alloc => alloc.session_number === sessNum);
                      return (
                        <div key={sessNum} className="p-4 bg-white dark:bg-slate-950/40 rounded-xl border border-slate-200 dark:border-slate-900 flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="space-y-1">
                            <span className="text-xs font-bold text-slate-900 dark:text-white">Session {sessNum}</span>
                            <div className="text-[10px] text-slate-500">Maximum capacity: 2 faculties</div>
                          </div>

                          <div className="flex flex-1 md:justify-end gap-3">
                            {facultiesInSession.length === 0 ? (
                              <span className="text-xs text-slate-400 dark:text-slate-600 font-semibold italic">Unallocated slot</span>
                            ) : (
                              facultiesInSession.map((alloc) => (
                                <div key={alloc.faculty} className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center justify-between gap-4 text-xs">
                                  <div>
                                    <span className="font-bold text-blue-600 dark:text-blue-400 block leading-none">{alloc.faculty}</span>
                                    <span className="text-[9px] text-slate-500 mt-1 block">{alloc.student_count} Candidates</span>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* 6. CERTIFICATE PRINT WORKSPACE */}
          {activeTab === 'print' && (
            <div className="space-y-6">
              <Card className="border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/30 backdrop-blur-md rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base font-bold text-slate-950 dark:text-white">Document Compiler Pipeline</CardTitle>
                  <CardDescription className="text-[11px] text-slate-500">Programmatic coordinate-based duplex layout compiling engine.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 text-center py-12">
                  <div className="max-w-md mx-auto space-y-4">
                    <GraduationCap className="h-16 w-16 text-blue-600 dark:text-blue-500 mx-auto animate-bounce" />
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Duplex Master PDF Compilation</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      This triggers a background worker compiler that loads pre-uploaded cached layouts (Internal Front/Back, External Front/Back), loops through all verified candidates alphabetically, injects names and certificate serial numbers at pixel locations, and exports a single printing-ready PDF with alternating front and back pages.
                    </p>

                    {printStatus.status === 'idle' ? (
                      <Button
                        onClick={handleTriggerPrint}
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                      >
                        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        Trigger Compilation Queue
                      </Button>
                    ) : printStatus.status === 'processing' ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                          <span>Compiling page maps ({printStatus.current} / {printStatus.total})</span>
                          <span className="font-bold text-blue-600 dark:text-blue-500">{Math.round((printStatus.current / printStatus.total) * 100)}%</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-200 dark:border-slate-900">
                          <div className="bg-blue-600 h-full transition-all duration-300" style={{ width: `${(printStatus.current / printStatus.total) * 100}%` }} />
                        </div>
                        <div className="text-[10px] text-slate-500 italic">Isolated background worker thread active. Server responsive.</div>
                      </div>
                    ) : printStatus.status === 'completed' ? (
                      <div className="space-y-4">
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-2">
                          <Check className="h-4 w-4 text-emerald-650" />
                          Compilation completed! {printStatus.total} certificates merged successfully.
                        </div>
                        <a
                          href={printStatus.outputPath}
                          download
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 rounded-xl text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-blue-500/20"
                        >
                          <Download className="h-4 w-4" />
                          Download Printing Master PDF
                        </a>
                        <Button
                          variant="link"
                          onClick={() => setPrintStatus({ status: 'idle', current: 0, total: 0, error: null, outputPath: null })}
                          className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-xs mt-2"
                        >
                          Restart Generation
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="p-3 bg-red-50 dark:bg-red-950/45 border border-red-200 dark:border-red-500/35 text-red-700 dark:text-red-300 rounded-xl text-xs font-semibold">
                          Compilation Failed: {printStatus.error}
                        </div>
                        <Button
                          onClick={handleTriggerPrint}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 rounded-xl text-xs"
                        >
                          Retry Generation
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>
      
      {/* Bulk Ingestion Staging Dialog Modal */}
      {showStagingModal && stagingResults.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 w-full max-w-6xl max-h-[90vh] rounded-3xl relative shadow-2xl flex flex-col overflow-hidden">
            <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-950 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <Upload className="h-5 w-5 text-blue-500 animate-pulse" />
                    Staging Validation Preview
                  </CardTitle>
                  <CardDescription className="text-[10px] text-slate-500 mt-1">
                    Review parsed row validation before database execution.
                  </CardDescription>
                </div>
                <button
                  onClick={() => setShowStagingModal(false)}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition"
                  title="Close Preview"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-6">
              {renderStagingGrid(true)}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-900 py-6 text-center text-xs text-slate-500 dark:text-slate-600 mt-12 transition-colors duration-200">
        © 2026 University Exam Division. Enforced Row-Level Secure Environment. All rights reserved.
      </footer>
    </div>
  );
}
