"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  GraduationCap,
  Plus,
  Upload,
  Check,
  X,
  ShieldAlert,
  Loader2,
  Calendar,
  Clock,
  ArrowRight,
  UserCheck,
  Trash2,
  Search,
  Download,
  RefreshCw,
  AlertCircle,
  FileText,
  LogOut,
  Edit,
  Mail,
} from "lucide-react";
import * as XLSX from "xlsx";
import { useRouter } from "next/navigation";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  HeadingLevel,
  TabStopPosition,
  TabStopType,
  LeaderType,
} from "docx";
import jsPDF from "jspdf";

const wrapPlaceholdersInHtml = (htmlStr: string) => {
  if (typeof window === "undefined" || !htmlStr) return htmlStr;
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlStr, "text/html");
  
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.nodeValue || "";
      if (text.includes("{{") && text.includes("}}")) {
        const parent = node.parentNode;
        if (parent && parent.nodeName !== "SCRIPT" && parent.nodeName !== "STYLE") {
          const tempDiv = document.createElement("div");
          tempDiv.innerHTML = text.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (match, name) => {
            return `<span class="variable-badge" contenteditable="false" style="background: rgba(37, 99, 235, 0.1); color: #2563eb; border: 1px solid rgba(37, 99, 235, 0.2); padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 12px; font-weight: bold; pointer-events: none; user-select: none; display: inline-block;">{{${name}}}</span>`;
          });
          
          while (tempDiv.firstChild) {
            parent.insertBefore(tempDiv.firstChild, node);
          }
          parent.removeChild(node);
        }
      }
    } else {
      const children = Array.from(node.childNodes);
      for (const child of children) {
        walk(child);
      }
    }
  };
  
  walk(doc.body);
  
  let html = "";
  if (doc.doctype) {
    html += new XMLSerializer().serializeToString(doc.doctype) + "\n";
  }
  html += doc.documentElement.outerHTML;
  return html;
};

const unwrapPlaceholdersInHtml = (htmlStr: string) => {
  if (typeof window === "undefined" || !htmlStr) return htmlStr;
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlStr, "text/html");
  
  const badges = doc.querySelectorAll("span.variable-badge");
  badges.forEach((badge) => {
    const textNode = doc.createTextNode(badge.textContent || "");
    badge.parentNode?.replaceChild(textNode, badge);
  });
  
  let html = "";
  if (doc.doctype) {
    html += new XMLSerializer().serializeToString(doc.doctype) + "\n";
  }
  html += doc.documentElement.outerHTML;
  return html;
};

const DEFAULT_LAYOUT = {
  studentNameY: 490,
  studentNameFontSize: 26,
  degreeNameY: 405,
  degreeNameFontSize: 20,
  dateDigitalText: "15th January 2023",
  dateDigitalY: 350,
  dateVerbalText: "Twenty Seventh Day of July in the Year Two Thousand Twenty Three",
  dateVerbalY: 245,

  titleY: 500,
  preambleY: 482,
  preambleSiInternal: "මෙම විශ්වවිද්‍යාලයේ අභ්‍යන්තර අපේක්ෂකයෙකු ලෙස\nනියමිත අධ්‍යයන පාඨමාලා සහ පරීක්ෂණ සාර්ථක\nලෙස නිම කිරීමෙන් පසු මෙහි පසු පිටේ නම\nසඳහන් අය වෙත",
  preambleSiExternal: "මෙම විශ්වවිද්‍යාලයේ බාහිර අපේක්ෂකයෙකු ලෙස\nනියමිත අධ්‍යයන පාඨමාලා සහ පරීක්ෂණ සාර්ථක\nලෙස නිම කිරීමෙන් පසු මෙහි පසු පිටේ නම\nසඳහන් අය වෙත",
  preambleTaInternal: "இப்பல்கலைக்கழகத்தில் குறிப்பிட்ட உள்வாரி கற்கை\nநெறிகளையும் பரீட்சைகளையும் வெற்றிகரமாக\nநிறைவு செய்ததன் பின்னர், இச்சான்றிதழின்\nமறுபக்கத்தில் பெயர் குறிப்பிடப்பட்டுள்ளவருக்கு",
  preambleTaExternal: "இப்பல்கலைக்கழகத்தில் குறிப்பிட்ட வெளிவாரி கற்கை\nநெறிகளையும் பரீட்சைகளையும் வெற்றிகரமாக\nநிறைவு செய்ததன் பின்னர், இச்சான்றிதழின்\nமறுபக்கத்தில் பெயர் குறிப்பிடப்பட்டுள்ளவருக்கு",
  suffixSi: "පිරිනමන ලද බව මෙයින් සහතික කරමු.",
  suffixTa: "வழங்கப்பட்டதென இத்தால்\nஉறுதிப்படுத்துகின்றோம்.",
  dateSiLine1: "වලංගු වීමේ දිනය: 15/01/2023",
  dateSiLine2: "උපාධි ප්‍රදානෝත්සවය: 2023 ජූලි මස 27",
  dateTaLine1: "செல்லுபடியாகும் திகதி: 15/01/2023",
  dateTaLine2: "பட்டமளிப்பு விழா: 27 ஜூலை 2023",
  registrarName: "එස්.සී. හේරත් / எஸ்.சி.ஹேரத்",
  registrarTitle: "ලේඛකාධිකාරි / பதிவாளர்",
  vcName: "වෛද්‍ය පී.එච්.ජේ. පුෂ්පකුමාර / வைத்தியர் பி.எச்.ஜி.ஜே. புஷ்பகுமார",
  vcTitle: "වැඩ බලන උපකුලපති / பதில் உபவேந்தர்",
  registrarX: 99.213,
  vcX: 496.063,
  signatureY: 118,
};

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<
    | "degrees"
    | "ingest"
    | "timeline"
    | "audit"
    | "seating"
    | "print"
    | "accounts"
    | "email_templates"
    | "registry"
    | "faculties_sessions"
    | "audit_logs"
    | "db_maintenance"
    | "dispatch"
    | "cert_layout"
    | "session_allocation"
  >("degrees");
  const [expandedSection, setExpandedSection] = useState<"admin" | "general">(
    "admin",
  );

  // Student Registry States
  const [registryYear, setRegistryYear] = useState("");
  const [registryFaculty, setRegistryFaculty] = useState("");
  const [registryDegree, setRegistryDegree] = useState("");
  const [registrySession, setRegistrySession] = useState("");
  const [registryAttendance, setRegistryAttendance] = useState("");
  const [registrySearch, setRegistrySearch] = useState("");
  const [registryStudents, setRegistryStudents] = useState<any[]>([]);

  // Verification Letter Modal States
  const [verLetterStudent, setVerLetterStudent] = useState<any | null>(null);
  const [verLetterStep, setVerLetterStep] = useState<"form" | "preview">("form");
  const [verLetterGenerating, setVerLetterGenerating] = useState(false);
  const [verLetterInputs, setVerLetterInputs] = useState({
    yourNumber: "",
    ourRef: "",
    myNumber: "",
    fileNumber: "",
    refLetterDate: "",
    addressee: "",
    staffName: "",
  });
  const [verLetterPdfBlob, setVerLetterPdfBlob] = useState<Blob | null>(null);

  // Staff Authentication States
  const [staffUser, setStaffUser] = useState<any | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);

  // Staff Account Registry States
  const [staffList, setStaffList] = useState<any[]>([]);
  const [newStaffUsername, setNewStaffUsername] = useState("");
  const [newStaffPassword, setNewStaffPassword] = useState("");
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffRole, setNewStaffRole] = useState<"Staff" | "Administrator">(
    "Staff",
  );

  // Global loading / error
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 1. COURSE MANAGER STATE
  const [degrees, setDegrees] = useState<any[]>([]);
  const [degCode, setDegCode] = useState("");
  const [degFaculty, setDegFaculty] = useState("Faculty of Technology");
  const [degNo, setDegNo] = useState("");
  const [degEn, setDegEn] = useState("");
  const [degSi, setDegSi] = useState("");
  const [degTa, setDegTa] = useState("");
  const [degType, setDegType] = useState<"Internal" | "External">("Internal");

  // Edit degree states
  const [editingDegree, setEditingDegree] = useState<any | null>(null);
  const [editEn, setEditEn] = useState("");
  const [editSi, setEditSi] = useState("");
  const [editTa, setEditTa] = useState("");
  const [editType, setEditType] = useState<"Internal" | "External">("Internal");

  const [filterRegFaculty, setFilterRegFaculty] = useState("");
  const [filterRegType, setFilterRegType] = useState("");

  const filteredDegrees = React.useMemo(() => {
    return degrees.filter((d) => {
      if (filterRegFaculty && d.faculty !== filterRegFaculty) return false;
      if (filterRegType && d.type !== filterRegType) return false;
      return true;
    });
  }, [degrees, filterRegFaculty, filterRegType]);

  // 2. INGESTION STATE
  const [ingestFile, setIngestFile] = useState<File | null>(null);
  const [ingestFaculty, setIngestFaculty] = useState("");
  const [ingestDegreeId, setIngestDegreeId] = useState("");
  const [stagingResults, setStagingResults] = useState<any[]>([]);
  const [isValidBatch, setIsValidBatch] = useState(false);
  const [showStagingModal, setShowStagingModal] = useState(false);
  const [degreeStagingResults, setDegreeStagingResults] = useState<any[]>([]);
  const [isDegreeBatchValid, setIsDegreeBatchValid] = useState(false);
  const [showDegreeStagingModal, setShowDegreeStagingModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 3. TIMELINE STATE
  const [openDate, setOpenDate] = useState("");
  const [closeDate, setCloseDate] = useState("");
  const [isManuallyClosed, setIsManuallyClosed] = useState(false);
  const [timelineConfig, setTimelineConfig] = useState<any>(null);

  // 3.1. CERTIFICATE LAYOUT MANAGER STATE
  const [layoutConfig, setLayoutConfig] = useState<any>(null);
  const [layoutLoading, setLayoutLoading] = useState(false);
  const [layoutSide, setLayoutSide] = useState<"front" | "back">("front");

  // 4. AUDIT STATE
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [filterFaculty, setFilterFaculty] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterAttending, setFilterAttending] = useState("");
  const [filterResponseStatus, setFilterResponseStatus] =
    useState<string>("all");
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Admin logs filter states
  const [logSearchActor, setLogSearchActor] = useState("");
  const [logSearchQuery, setLogSearchQuery] = useState("");
  const [logSearchAction, setLogSearchAction] = useState("");
  const [logDateFrom, setLogDateFrom] = useState("");
  const [logDateTo, setLogDateTo] = useState("");

  const filteredAuditLogs = React.useMemo(() => {
    return auditLogs.filter((log) => {
      if (
        logSearchActor &&
        !log.admin_id.toLowerCase().includes(logSearchActor.toLowerCase())
      ) {
        return false;
      }
      if (logSearchQuery) {
        const query = logSearchQuery.toLowerCase();
        const matchesStudent =
          (log.name_with_initials || "").toLowerCase().includes(query) ||
          (log.index_no || "").toLowerCase().includes(query) ||
          (log.email || "").toLowerCase().includes(query);
        if (!matchesStudent) return false;
      }
      if (
        logSearchAction &&
        !log.action_taken.toLowerCase().includes(logSearchAction.toLowerCase())
      ) {
        return false;
      }
      if (logDateFrom && new Date(log.timestamp) < new Date(logDateFrom)) {
        return false;
      }
      if (logDateTo) {
        const toDate = new Date(logDateTo);
        toDate.setHours(23, 59, 59, 999);
        if (new Date(log.timestamp) > toDate) {
          return false;
        }
      }
      return true;
    });
  }, [
    auditLogs,
    logSearchActor,
    logSearchQuery,
    logSearchAction,
    logDateFrom,
    logDateTo,
  ]);

  // 5. SEATING STATE
  const [sessionAllocations, setSessionAllocations] = useState<any[]>([]);
  const [allocateFaculty, setAllocateFaculty] = useState(
    "Faculty of Technology (Internal)",
  );
  const [allocateSession, setAllocateSession] = useState("1");

  // 6. CERTIFICATE PRINT STATE
  const [printStatus, setPrintStatus] = useState<any>({
    status: "idle",
    current: 0,
    total: 0,
    error: null,
    outputPath: null,
  });
  const [printFaculty, setPrintFaculty] = useState("");
  const [printDegreeId, setPrintDegreeId] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  useEffect(() => {
    if (errorMsg) {
      const timer = setTimeout(() => setErrorMsg(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [errorMsg]);

  useEffect(() => {
    if (loginError) {
      const timer = setTimeout(() => setLoginError(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [loginError]);

  useEffect(() => {
    setPrintDegreeId("");
  }, [printFaculty]);

  // 7. MULTI-YEAR, DISPATCH, PARAMS & TEMPLATES STATES
  const [facultiesList, setFacultiesList] = useState<any[]>([]);
  const [newFacultyName, setNewFacultyName] = useState("");

  const [convocationSessions, setConvocationSessions] = useState<any[]>([]);
  const [newSessionNumber, setNewSessionNumber] = useState("");
  const [newSessionName, setNewSessionName] = useState("");

  const [activeConvocationYear, setActiveConvocationYear] = useState("2026");
  const [convocationYears, setConvocationYears] = useState<any[]>([]);
  const [filterConvocationYear, setFilterConvocationYear] = useState("");
  const [transitionYear, setTransitionYear] = useState("");

  const yearOptions = React.useMemo(() => {
    const dbYears = convocationYears.map((y: any) => y.convocation_year);
    const currentYear = new Date().getFullYear();
    const futureYears = Array.from({ length: 6 }, (_, i) =>
      String(currentYear + i),
    );
    const merged = Array.from(new Set([...dbYears, ...futureYears]));
    return merged.sort((a, b) => b.localeCompare(a));
  }, [convocationYears]);

  const SESSIONS = React.useMemo(() => {
    if (convocationSessions.length > 0) {
      const nums = convocationSessions.map((s: any) => Number(s.session_number));
      return Array.from(new Set(nums)).sort((a, b) => a - b);
    }
    return [1, 2, 3, 4];
  }, [convocationSessions]);

  const [emailTemplates, setEmailTemplates] = useState<any[]>([]);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<
    "magic_link" | "rejection" | "confirmation" | "in_absentia"
  >("magic_link");
  const [templateSubject, setTemplateSubject] = useState("");
  const [templateBody, setTemplateBody] = useState("");
  const [initialTemplateBody, setInitialTemplateBody] = useState("");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [dispatcherStudents, setDispatcherStudents] = useState<any[]>([]);
  const [selectedDispatcherStudents, setSelectedDispatcherStudents] = useState<
    any[]
  >([]);
  const [dispatchType, setDispatchType] = useState<"onboarding" | "confirmation" | "in_absentia">("onboarding");
  const [dispatchFacultyFilter, setDispatchFacultyFilter] = useState("");
  const [dispatchDegreeFilter, setDispatchDegreeFilter] = useState("");
  const [dispatchSearchRegNo, setDispatchSearchRegNo] = useState("");
  const [dispatchStatusFilter, setDispatchStatusFilter] = useState<"" | "Sent" | "Pending">("");

  // Session Allocation workspace states
  const [sessAllocGroup, setSessAllocGroup] = useState("");
  const [sessAllocSession, setSessAllocSession] = useState("");
  // ISO date string (YYYY-MM-DD) stored internally, displayed as "25th May 2026"
  const [sessAllocDate, setSessAllocDate] = useState("");
  // 24h time string (HH:MM) stored internally, displayed as "09.00 a.m."
  const [sessAllocTime, setSessAllocTime] = useState("");

  /** Format ISO date string to "25th May 2026" */
  const formatSessionDate = (isoDate: string): string => {
    if (!isoDate) return "";
    const d = new Date(isoDate + "T00:00:00");
    const day = d.getDate();
    const ordinal = (n: number) => {
      if (n >= 11 && n <= 13) return n + "th";
      switch (n % 10) { case 1: return n + "st"; case 2: return n + "nd"; case 3: return n + "rd"; default: return n + "th"; }
    };
    const month = d.toLocaleString("en-GB", { month: "long" });
    return `${ordinal(day)} ${month} ${d.getFullYear()}`;
  };

  /** Format 24h time string "HH:MM" to "09.00 a.m." */
  const formatSessionTime = (time24: string): string => {
    if (!time24) return "";
    const [hStr, mStr] = time24.split(":");
    let h = parseInt(hStr, 10);
    const m = mStr ? mStr.substring(0, 2) : "00";
    const period = h >= 12 ? "p.m." : "a.m.";
    h = h % 12 || 12;
    return `${String(h).padStart(2, "0")}.${m} ${period}`;
  };

  const [showAddDegreeModal, setShowAddDegreeModal] = useState(false);

  // 8. BULK DATA INGESTION DELETION STATES
  const [ingestStudents, setIngestStudents] = useState<any[]>([]);
  const [ingestSearchIndex, setIngestSearchIndex] = useState("");
  const [ingestFacultyFilter, setIngestFacultyFilter] = useState("");
  const [ingestDegreeFilter, setIngestDegreeFilter] = useState("");
  const [selectedIngestStudents, setSelectedIngestStudents] = useState<string[]>([]);

  // Updated official Faculty Names according to user request
  const FACULTIES =
    facultiesList.length > 0
      ? facultiesList.map((f: any) => f.name)
      : [
          "Faculty of Technology",
          "Faculty of Applied Sciences",
          "Faculty of Management Studies",
          "Faculty of Social Sciences & Humanities",
          "Faculty of Agriculture",
          "Faculty of Medicine and Allied Sciences",
        ];

  // ----------------------------------------------------
  // DATA FETCHING HOOKS
  // ----------------------------------------------------
  const loadDispatcherStudents = async () => {
    try {
      const res = await fetch(
        `/api/admin/review?convocationYear=${activeConvocationYear}`,
      );
      const json = await res.json();
      if (res.ok && json.success) {
        setDispatcherStudents(json.data);
      }
    } catch (err) {
      console.error("Failed to load dispatcher students:", err);
    }
  };

  const checkSession = async () => {
    try {
      const res = await fetch("/api/admin/auth/session");
      const json = await res.json();
      if (res.ok && json.success) {
        setStaffUser(json.user);
      } else {
        setStaffUser(null);
      }
    } catch {
      setStaffUser(null);
    } finally {
      setSessionChecked(true);
    }
  };

  const loadDegrees = async () => {
    const res = await fetch("/api/degrees");
    const json = await res.json();
    if (res.ok) setDegrees(json.data);
  };

  const loadTimeline = async () => {
    const res = await fetch("/api/timeline");
    const json = await res.json();
    if (res.ok && json.data) {
      setTimelineConfig(json.data);
      setIsManuallyClosed(json.data.is_manually_closed || false);
      if (json.data.convocation_year) {
        setActiveConvocationYear(json.data.convocation_year);
      }

      const formatLocal = (d: Date) => {
        const offset = d.getTimezoneOffset();
        const local = new Date(d.getTime() - (offset * 60 * 1000));
        return local.toISOString().slice(0, 16);
      };

      const now = new Date();
      const openTime = new Date(json.data.open_date);
      const closeTime = new Date(json.data.close_date);

      const isEpoch = openTime.getFullYear() <= 1970;
      const isCurrentlyClosed = now < openTime || now > closeTime || json.data.is_manually_closed;

      if (isEpoch || isCurrentlyClosed) {
        setOpenDate(formatLocal(now));
      } else {
        setOpenDate(formatLocal(openTime));
      }

      if (closeTime.getFullYear() <= 1970) {
        const defaultClose = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        setCloseDate(formatLocal(defaultClose));
      } else {
        setCloseDate(formatLocal(closeTime));
      }
    }
  };

  const loadLayoutConfig = async (year: string) => {
    setLayoutLoading(true);
    try {
      const res = await fetch(`/api/admin/certificate-layout?convocation_year=${year}`);
      const json = await res.json();
      if (res.ok && json.success) {
        setLayoutConfig(json.data);
      } else {
        setErrorMsg(json.error || "Failed to load certificate layout settings.");
      }
    } catch (err) {
      setErrorMsg("Failed to connect to certificate layout configuration API.");
    } finally {
      setLayoutLoading(false);
    }
  };

  const updateLayoutField = (key: string, value: any) => {
    setLayoutConfig((prev: any) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSaveLayoutConfig = async () => {
    if (!layoutConfig) return;
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch("/api/admin/certificate-layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          convocation_year: activeConvocationYear,
          layout_data: layoutConfig,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setSuccessMsg(`Certificate layout settings for ${activeConvocationYear} saved successfully.`);
        setLayoutConfig(json.data);
      } else {
        setErrorMsg(json.error || "Failed to save certificate layout configuration.");
      }
    } catch (err) {
      setErrorMsg("Network error saving layout configuration.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetLayoutConfig = async () => {
    if (!confirm(`Are you sure you want to reset the layout coordinates and texts for ${activeConvocationYear} to system defaults?`)) {
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch("/api/admin/certificate-layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          convocation_year: activeConvocationYear,
          layout_data: {},
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setSuccessMsg("Certificate layout coordinates reset to system defaults.");
        setLayoutConfig(json.data);
      } else {
        setErrorMsg(json.error || "Failed to reset layout coordinates.");
      }
    } catch (err) {
      setErrorMsg("Network error resetting layout configuration.");
    } finally {
      setLoading(false);
    }
  };

  const loadStudents = async () => {
    const query = new URLSearchParams();
    if (filterFaculty) query.append("faculty", filterFaculty);
    if (filterStatus) query.append("status", filterStatus);
    if (filterAttending) query.append("attending", filterAttending);
    if (filterResponseStatus)
      query.append("responseStatus", filterResponseStatus);
    if (filterConvocationYear)
      query.append("convocationYear", filterConvocationYear);

    const res = await fetch(`/api/admin/review?${query.toString()}`);
    const json = await res.json();
    if (res.ok) {
      const emailSentStudents = json.data.filter((st: any) => st.email_sent === true);
      setStudents(emailSentStudents);
      if (emailSentStudents.length > 0 && (!selectedStudent || !emailSentStudents.some((s: any) => s.id === selectedStudent.id))) {
        setSelectedStudent(emailSentStudents[0]);
      } else if (emailSentStudents.length === 0) {
        setSelectedStudent(null);
      }
    }
  };

  const loadIngestStudents = async () => {
    try {
      const res = await fetch(
        `/api/admin/review?convocationYear=${activeConvocationYear}`,
      );
      const json = await res.json();
      if (res.ok && json.success) {
        setIngestStudents(json.data);
      }
    } catch (err) {
      console.error("Failed to load ingest students:", err);
    }
  };

  const handleDeleteStudent = async (studentId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this student from the system? This action is permanent and will delete all their records.",
      )
    ) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/review", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        triggerAlert(true, "Student deleted successfully.");
        loadIngestStudents();
        loadStudents();
      } else {
        triggerAlert(false, json.error || "Failed to delete student.");
      }
    } catch (err) {
      triggerAlert(false, "Network error.");
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDeleteStudents = async () => {
    if (selectedIngestStudents.length === 0) return;
    if (
      !confirm(
        `Are you sure you want to delete the ${selectedIngestStudents.length} selected students? This action is permanent and will delete all their records.`,
      )
    ) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/review", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentIds: selectedIngestStudents }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        triggerAlert(
          true,
          `${selectedIngestStudents.length} students deleted successfully.`,
        );
        setSelectedIngestStudents([]);
        loadIngestStudents();
        loadStudents();
      } else {
        triggerAlert(false, json.error || "Failed to delete students.");
      }
    } catch (err) {
      triggerAlert(false, "Network error.");
    } finally {
      setLoading(false);
    }
  };

  const filteredIngestStudents = React.useMemo(() => {
    return ingestStudents.filter((s) => {
      if (ingestFacultyFilter && s.faculty !== ingestFacultyFilter) return false;
      if (ingestDegreeFilter && s.degree_id !== ingestDegreeFilter) return false;
      if (ingestSearchIndex) {
        const query = ingestSearchIndex.toLowerCase().trim();
        return (
          (s.registration_no || "").toLowerCase().includes(query) ||
          (s.index_no || "").toLowerCase().includes(query) ||
          (s.full_name || "").toLowerCase().includes(query) ||
          (s.name_with_initials || "").toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [
    ingestStudents,
    ingestFacultyFilter,
    ingestDegreeFilter,
    ingestSearchIndex,
  ]);

  const loadAuditLogs = async () => {
    const res = await fetch("/api/admin/logs");
    const json = await res.json();
    if (res.ok) setAuditLogs(json.data);
  };

  const loadSessionAllocations = async () => {
    const res = await fetch("/api/admin/sessions");
    const json = await res.json();
    if (res.ok) setSessionAllocations(json.data);
  };

  const loadPrintStatus = async () => {
    const res = await fetch("/api/admin/certificates");
    const json = await res.json();
    if (res.ok) setPrintStatus(json.data);
  };

  const loadStaff = async () => {
    try {
      const res = await fetch("/api/admin/staff");
      const json = await res.json();
      if (res.ok && json.success) {
        setStaffList(json.data);
      }
    } catch (err) {
      console.error("Failed to load staff list:", err);
    }
  };

  const loadFaculties = async () => {
    try {
      const res = await fetch("/api/admin/faculties");
      const json = await res.json();
      if (res.ok && json.success) setFacultiesList(json.data);
    } catch (err) {
      console.error("Failed to load faculties:", err);
    }
  };

  const loadConvocationSessions = async () => {
    try {
      const res = await fetch("/api/admin/convocation-sessions");
      const json = await res.json();
      if (res.ok && json.success) setConvocationSessions(json.data);
    } catch (err) {
      console.error("Failed to load sessions:", err);
    }
  };

  const loadConvocationYears = async () => {
    try {
      const res = await fetch("/api/admin/active-session");
      const json = await res.json();
      if (res.ok && json.success) setConvocationYears(json.data);
    } catch (err) {
      console.error("Failed to load convocation years:", err);
    }
  };

  const loadEmailTemplates = async () => {
    try {
      const res = await fetch("/api/admin/email-templates");
      const json = await res.json();
      if (res.ok && json.success) {
        setEmailTemplates(json.data);
        const current = json.data.find(
          (t: any) => t.template_key === selectedTemplateKey,
        );
        if (current) {
          setTemplateSubject(current.subject);
          setTemplateBody(current.body);
          setInitialTemplateBody(wrapPlaceholdersInHtml(current.body));
        }
      }
    } catch (err) {
      console.error("Failed to load email templates:", err);
    }
  };

  // Check session on page mount
  useEffect(() => {
    checkSession();
  }, []);

  // Fetch certificate layout config when tab or year changes
  useEffect(() => {
    if (staffUser && activeTab === "cert_layout" && activeConvocationYear) {
      loadLayoutConfig(activeConvocationYear);
    }
  }, [staffUser, activeTab, activeConvocationYear]);

  // Fetch dashboard data if authenticated
  useEffect(() => {
    if (staffUser) {
      loadDegrees();
      loadTimeline();
      loadStudents();
      loadAuditLogs();
      loadSessionAllocations();
      loadPrintStatus();
      loadFaculties();
      loadConvocationSessions();
      loadConvocationYears();
      loadEmailTemplates();
      loadDispatcherStudents();
      if (staffUser.role === "Administrator") {
        loadStaff();
      }
    }
  }, [
    activeTab,
    filterFaculty,
    filterStatus,
    filterAttending,
    filterResponseStatus,
    filterConvocationYear,
    selectedTemplateKey,
    staffUser,
  ]);

  // Periodic polling for PDF worker status
  useEffect(() => {
    let interval: any;
    if (printStatus?.status === "processing") {
      interval = setInterval(() => {
        loadPrintStatus();
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [printStatus?.status]);

  const loadRegistryStudents = async () => {
    const query = new URLSearchParams();
    query.append("convocationYear", registryYear || activeConvocationYear);
    if (registryFaculty) query.append("faculty", registryFaculty);
    if (registryDegree) query.append("degreeId", registryDegree);
    if (registrySession) query.append("session", registrySession);
    if (registryAttendance) query.append("attending", registryAttendance);

    try {
      const res = await fetch(`/api/admin/review?${query.toString()}`);
      const json = await res.json();
      if (res.ok && json.success) {
        setRegistryStudents(json.data);
      }
    } catch (err) {
      console.error("Failed to load registry students:", err);
    }
  };

  // ─── DOCUMENT 1: Graduation List Word Document ───────────────────────────
  const generateGraduationListDocx = async () => {
    const allStudents = filteredRegistryStudents;

    // Helper: determine if a degree is a bachelor's
    const isBachelors = (degreeName: string) =>
      /bachelor/i.test(degreeName || "");

    // Sort class order for attending
    const CLASS_ORDER: Record<string, number> = {
      "First Class": 0,
      "Second Class (Upper Division)": 1,
      "Second Class Upper": 1,
      "Second Class (Lower Division)": 2,
      "Second Class Lower": 2,
      "Pass": 3,
      "General": 3,
    };

    const normaliseClass = (cls: string | null | undefined): string => {
      if (!cls) return "Pass";
      const c = cls.trim();
      if (/first/i.test(c)) return "First Class";
      if (/upper/i.test(c)) return "Second Class (Upper Division)";
      if (/lower/i.test(c)) return "Second Class (Lower Division)";
      return "Pass";
    };

    // Group students by faculty → degree
    const byFaculty: Record<string, Record<string, any[]>> = {};
    for (const st of allStudents) {
      const fac = st.faculty || "Unknown Faculty";
      const deg = st.degree_name_en || "Unknown Degree";
      if (!byFaculty[fac]) byFaculty[fac] = {};
      if (!byFaculty[fac][deg]) byFaculty[fac][deg] = [];
      byFaculty[fac][deg].push(st);
    }

    const sortedFaculties = Object.keys(byFaculty).sort();
    const docChildren: Paragraph[] = [];

    const makePara = (
      text: string,
      opts: {
        bold?: boolean;
        size?: number;
        allCaps?: boolean;
        center?: boolean;
        underline?: boolean;
        color?: string;
        spaceBefore?: number;
        spaceAfter?: number;
        indent?: number;
      } = {}
    ) =>
      new Paragraph({
        alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
        spacing: {
          before: (opts.spaceBefore ?? 0) * 20,
          after: (opts.spaceAfter ?? 0) * 20,
        },
        indent: opts.indent ? { left: opts.indent * 20 } : undefined,
        children: [
          new TextRun({
            text,
            bold: opts.bold,
            size: (opts.size ?? 11) * 2,
            allCaps: opts.allCaps,
            underline: opts.underline ? {} : undefined,
            color: opts.color,
          }),
        ],
      });

    for (const faculty of sortedFaculties) {
      const degreeMap = byFaculty[faculty];
      const sortedDegrees = Object.keys(degreeMap).sort();

      // Faculty heading
      docChildren.push(makePara(faculty.toUpperCase(), { bold: true, size: 14, center: true, spaceBefore: 20, spaceAfter: 4 }));
      docChildren.push(makePara(`Presented by the Dean / ${faculty}`, { size: 11, center: true, spaceAfter: 12 }));

      for (const degreeName of sortedDegrees) {
        const students = degreeMap[degreeName];
        const attending = students.filter((s) => s.attending_convocation === true);
        const inAbsentia = students.filter((s) => s.attending_convocation === false);

        // Degree heading
        docChildren.push(makePara(degreeName.toUpperCase(), { bold: true, size: 12, underline: true, spaceBefore: 10, spaceAfter: 6 }));

        if (isBachelors(degreeName)) {
          // ── ATTENDING sections ──
          const classGroups: Record<string, string[]> = {
            "First Class": [],
            "Second Class (Upper Division)": [],
            "Second Class (Lower Division)": [],
            "Pass": [],
          };
          for (const st of attending) {
            const cls = normaliseClass(st.degree_class);
            classGroups[cls]?.push(st.full_name || st.name_with_initials || "");
          }

          for (const [cls, names] of Object.entries(classGroups)) {
            docChildren.push(makePara(cls.toUpperCase(), { bold: true, size: 11, spaceBefore: 6, spaceAfter: 3 }));
            if (names.length === 0) {
              docChildren.push(makePara("NIL", { size: 11, indent: 36 }));
            } else {
              names.forEach((name, i) => {
                docChildren.push(
                  new Paragraph({
                    indent: { left: 36 * 20 },
                    children: [
                      new TextRun({ text: String(i + 1).padStart(3, "0"), size: 22, bold: true }),
                      new TextRun({ text: "\t" + name, size: 22 }),
                    ],
                  })
                );
              });
            }
          }

          // ── IN ABSENTIA ──
          docChildren.push(makePara("IN ABSENTIA", { bold: true, size: 11, color: "555555", spaceBefore: 10, spaceAfter: 4 }));

          const absentiaGroups: Record<string, string[]> = {
            "First Class": [],
            "Second Class (Upper Division)": [],
            "Second Class (Lower Division)": [],
            "Pass": [],
          };
          for (const st of inAbsentia) {
            const cls = normaliseClass(st.degree_class);
            absentiaGroups[cls]?.push(st.full_name || st.name_with_initials || "");
          }

          for (const [cls, names] of Object.entries(absentiaGroups)) {
            docChildren.push(makePara(cls.toUpperCase(), { bold: true, size: 11, spaceBefore: 4, spaceAfter: 2 }));
            if (names.length === 0) {
              docChildren.push(makePara("NIL", { size: 11, indent: 36 }));
            } else {
              names.forEach((name, i) => {
                docChildren.push(
                  new Paragraph({
                    indent: { left: 36 * 20 },
                    children: [
                      new TextRun({ text: String(i + 1).padStart(3, "0"), size: 22, bold: true }),
                      new TextRun({ text: "\t" + name, size: 22 }),
                    ],
                  })
                );
              });
            }
          }
        } else {
          // ── NON-BACHELOR: only PASS ──
          docChildren.push(makePara("PASS", { bold: true, size: 11, spaceBefore: 4, spaceAfter: 2 }));
          if (attending.length === 0) {
            docChildren.push(makePara("NIL", { size: 11, indent: 36 }));
          } else {
            attending.forEach((st, i) => {
              docChildren.push(
                new Paragraph({
                  indent: { left: 36 * 20 },
                  children: [
                    new TextRun({ text: String(i + 1).padStart(3, "0"), size: 22, bold: true }),
                    new TextRun({ text: "\t" + (st.full_name || st.name_with_initials || ""), size: 22 }),
                  ],
                })
              );
            });
          }

          // In Absentia PASS
          docChildren.push(makePara("IN ABSENTIA", { bold: true, size: 11, color: "555555", spaceBefore: 8, spaceAfter: 2 }));
          docChildren.push(makePara("PASS", { bold: true, size: 11, spaceBefore: 2, spaceAfter: 2 }));
          if (inAbsentia.length === 0) {
            docChildren.push(makePara("NIL", { size: 11, indent: 36 }));
          } else {
            inAbsentia.forEach((st, i) => {
              docChildren.push(
                new Paragraph({
                  indent: { left: 36 * 20 },
                  children: [
                    new TextRun({ text: String(i + 1).padStart(3, "0"), size: 22, bold: true }),
                    new TextRun({ text: "\t" + (st.full_name || st.name_with_initials || ""), size: 22 }),
                  ],
                })
              );
            });
          }
        }
      }

      // Page break after each faculty (except last)
      if (faculty !== sortedFaculties[sortedFaculties.length - 1]) {
        docChildren.push(new Paragraph({ pageBreakBefore: true, children: [] }));
      }
    }

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: docChildren,
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Graduation_List_${registryYear || activeConvocationYear}.docx`;
    a.click();
    URL.revokeObjectURL(url);
  };

// ─── DOCUMENT 2: Verification Letter PDF ────────────────────────────────
const generateVerificationLetterPDF = async (
  student: any,
  inputs: typeof verLetterInputs
): Promise<Blob> => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const margin = 20;
  const contentWidth = W - margin * 2; // Exactly 170mm print space
  let y = 15;

  // Helper: Render complex scripts via canvas to get perfect native browser shaping
  const renderComplexTextToDataURL = (
    text: string, 
    fontFamily: string, 
    fontSizePx: number, 
    isBold = false,
    align: 'left' | 'right' = 'left'
  ): string => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    // Crisp high-resolution canvas bounds
    canvas.width = 1200;
    canvas.height = 80;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#000000";
    ctx.font = `${isBold ? "bold" : "normal"} ${fontSizePx}px "${fontFamily}", sans-serif`;
    ctx.textBaseline = "middle";

    if (align === 'left') {
      ctx.textAlign = "left";
      ctx.fillText(text, 0, canvas.height / 2);
    } else {
      ctx.textAlign = "right";
      ctx.fillText(text, canvas.width, canvas.height / 2);
    }

    return canvas.toDataURL("image/png");
  };

  // ── Load logo ──
  const loadImageAsDataURL = (src: string): Promise<string> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject("No canvas context");
        ctx.filter = "grayscale(100%)";
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = reject;
      img.src = src;
    });

  let logoDataUrl: string | null = null;
  try {
    logoDataUrl = await loadImageAsDataURL("/templates/RUSL.png");
  } catch {
    logoDataUrl = null;
  }

  // ── HEADER (3 columns aligned to logo base) ──
  // Logo sits at y=15 with height=20mm (bottom is at y=35).
  // Aligning text lines down so the final English lines hit precisely around y=34.5.
  const headerTextY = y + 11.5;

  // Center: Logo
  if (logoDataUrl) {
    const logoW = 20;
    const logoH = 20;
    const logoX = (W - logoW) / 2;
    doc.addImage(logoDataUrl, "PNG", logoX, y, logoW, logoH);
  } else {
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("[LOGO]", W / 2, y + 10, { align: "center" });
  }

  // Left Side: University Names (Perfect Browser Shaping via Canvas)
  const sinhalaLeftImg = renderComplexTextToDataURL("රජරට විශ්වවිද්‍යාලය", "Abhaya Libre", 36, true, 'left');
  const tamilLeftImg = renderComplexTextToDataURL("ராஜரட பல்கலைக்கழகம்", "Pavanam", 32, true, 'left');

  if (sinhalaLeftImg) doc.addImage(sinhalaLeftImg, "PNG", margin, headerTextY - 3, 55, 4);
  if (tamilLeftImg) doc.addImage(tamilLeftImg, "PNG", margin, headerTextY + 1.5, 55, 4);

  // English (Latin stays native)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Rajarata University of Sri Lanka", margin, headerTextY + 9, { align: "left" });


  // Right Side: Mihinthale Location Details
  const sinhalaRightImg = renderComplexTextToDataURL("මිහින්තලේ, ශ්‍රී ලංකාව", "Abhaya Libre", 36, false, 'right');
  const tamilRightImg = renderComplexTextToDataURL("மிஹிந்தலே, இலங்கை", "Pavanam", 32, false, 'right');

  if (sinhalaRightImg) doc.addImage(sinhalaRightImg, "PNG", W - margin - 55, headerTextY - 3, 55, 4);
  if (tamilRightImg) doc.addImage(tamilRightImg, "PNG", W - margin - 55, headerTextY + 1.5, 55, 4);

  // English
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Mihinthale Sri Lanka", W - margin, headerTextY + 9, { align: "right" });

  y = 39; // Secure spacing beneath logo baseline bounds

  // Header divider
  doc.setDrawColor(0);
  doc.setLineWidth(0.4);
  doc.line(margin, y, W - margin, y);
  y += 4;

  // Tel / Fax Info Row
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.text("Tel: +94 25 226 5600  |  Fax: +94 25 226 5601  |  Email: registrar@rjt.ac.lk", W / 2, y, { align: "center" });
  y += 4;

  doc.line(margin, y, W - margin, y);
  y += 7;

  // ── REFERENCE COLUMNS (Strict Grid Structure) ──
  doc.setFontSize(9);
  const refLeft = margin;
  const refRight = W / 2 + 14;
  const labelW = 28;

  // Row 1
  doc.setFont("helvetica", "bold");
  doc.text("Your Number:", refLeft, y);
  doc.text("My Number:", refRight, y);
  doc.setFont("helvetica", "normal");
  doc.text(inputs.yourNumber || ".....................", refLeft + labelW, y);
  doc.text(inputs.myNumber || ".....................", refRight + labelW, y);
  y += 5.5;

  // Row 2
  doc.setFont("helvetica", "bold");
  doc.text("Our Ref:", refLeft, y);
  doc.text("File Number:", refRight, y);
  doc.setFont("helvetica", "normal");
  doc.text(inputs.ourRef || ".....................", refLeft + labelW, y);
  doc.text(inputs.fileNumber || ".....................", refRight + labelW, y);
  y += 5.5;

  // Row 3
  doc.setFont("helvetica", "bold");
  doc.text("Date:", refRight, y);
  doc.setFont("helvetica", "normal");
  const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  doc.text(today, refRight + labelW, y);
  y += 11;

  // ── ADDRESSEE ──
  const addressLines = (inputs.addressee || "").split("\n");
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "normal");
  for (const line of addressLines) {
    doc.text(line, margin, y);
    y += 5;
  }
  y += 2;

  // ── SUBJECT (Dynamic wrap and underlines) ──
  const subject = `Verification of Degree Certificate - ${student.name_with_initials}`;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("Subject: ", margin, y);
  
  const subjectX = margin + doc.getTextWidth("Subject: ");
  const maxSubjectW = W - margin - subjectX;
  const wrappedSubject = doc.splitTextToSize(subject, maxSubjectW);
  
  doc.setFont("helvetica", "normal");
  wrappedSubject.forEach((line: string, index: number) => {
    doc.text(line, subjectX, y);
    const lineW = doc.getTextWidth(line);
    doc.line(subjectX, y + 0.5, subjectX + lineW, y + 0.5);
    if (index < wrappedSubject.length - 1) y += 5;
  });
  y += 8;

  // ── REFERENCE SENTENCE ──
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const refDate = inputs.refLetterDate || "........................";
  const refSentence = `This has reference to your letter ${refDate} on the above subject.`;
  const refLines = doc.splitTextToSize(refSentence, contentWidth);
  doc.text(refLines, margin, y);
  y += refLines.length * 5 + 6;

  // ── DETAIL FIELDS (Bounded Column Widths matching layout lines) ──
  const fields: [string, string][] = [
    ["Name of the Certificate", "Degree Certificate"],
    ["Name in Full", student.full_name || student.name_with_initials || ""],
    ["Degree", student.degree_name_en || ""],
    ["Effective Date of the Degree", student.effective_date ? new Date(student.effective_date).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) : (student.convocation_year || "")],
    ["Graduation Date", (() => {
      if (typeof convocationSessions === "undefined" || !student.session_number) return student.convocation_year || "";
      const sess = convocationSessions.find((s: any) => s.session_number === student.session_number);
      return sess?.session_date ? new Date(sess.session_date).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) : (student.convocation_year || "");
    })()],
    ["Serial No. of the Certificate", student.certificate_number ? String(student.certificate_number) : ""],
    ["Reg. NO / Index No.", `${student.registration_no || ""}  /  ${student.index_no || ""}`],
    ["Final GPA & Class", `${student.gpa ? Number(student.gpa).toFixed(2) : " - "}${student.class ? " - " + student.class : ""}`],
  ];

  const col1Width = 62; 
  const col2X = margin + col1Width; 
  const col3X = col2X + 5; 
  const maxValWidth = W - margin - col3X; // Rigid width clamp keeping values inside contentWidth boundary

  doc.setFontSize(9.5);
  fields.forEach(([label, value], i) => {
    doc.setFont("helvetica", "bold");
    doc.text(`${i + 1}.`, margin, y);
    doc.text(label, margin + 6, y);
    
    doc.setFont("helvetica", "normal");
    doc.text("-", col2X, y);
    
    const wrappedVal = doc.splitTextToSize(value, maxValWidth);
    doc.text(wrappedVal, col3X, y);
    
    y += wrappedVal.length > 1 ? wrappedVal.length * 5.2 : 6.5;
  });

  y += 4;

  // ── CLOSING ──
  const closing = "I am pleased to inform you that the above information is Genuine and the Degree has been awarded by the Rajarata University of Sri Lanka.";
  const closingLines = doc.splitTextToSize(closing, contentWidth);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text(closingLines, margin, y);
  y += closingLines.length * 5 + 14;

  // ── SIGNATURE ──
  doc.setFont("helvetica", "normal");
  doc.text(inputs.staffName || ".......................................................", margin, y);
  y += 5.5;
  doc.setFont("helvetica", "bold");
  doc.text("Deputy Registrar", margin, y);

  return doc.output("blob");
};

  useEffect(() => {
    if (activeConvocationYear && !registryYear) {
      setRegistryYear(activeConvocationYear);
    }
  }, [activeConvocationYear]);

  useEffect(() => {
    if (staffUser && activeTab === "registry") {
      loadRegistryStudents();
    }
  }, [
    activeTab,
    registryYear,
    registryFaculty,
    registryDegree,
    registrySession,
    registryAttendance,
    staffUser,
  ]);

  useEffect(() => {
    if (staffUser && activeTab === "ingest") {
      loadIngestStudents();
    }
  }, [activeTab, activeConvocationYear, staffUser]);

  useEffect(() => {
    if (staffUser && activeTab === "dispatch") {
      loadDispatcherStudents();
    }
  }, [activeTab, activeConvocationYear, staffUser]);

  const visibleDispatcherStudents = React.useMemo(() => {
    let list = dispatcherStudents;
    if (dispatchType === "confirmation") {
      list = list.filter(
        (s) =>
          s.verification_status === "Approved" &&
          s.session_number !== null &&
          s.attending_convocation === true,
      );
    } else if (dispatchType === "in_absentia") {
      list = list.filter(
        (s) =>
          s.verification_status === "Approved" &&
          s.attending_convocation === false,
      );
    }
    return list.filter((s) => {
      const matchFaculty =
        !dispatchFacultyFilter || s.faculty === dispatchFacultyFilter;
      const matchDegree =
        !dispatchDegreeFilter || s.degree_id === dispatchDegreeFilter;
      const matchSearch =
        !dispatchSearchRegNo ||
        (s.registration_no || "")
          .toLowerCase()
          .includes(dispatchSearchRegNo.toLowerCase().trim()) ||
        (s.name_with_initials || "")
          .toLowerCase()
          .includes(dispatchSearchRegNo.toLowerCase().trim());
      const isSent = dispatchType === "onboarding" ? s.email_sent : s.confirmation_email_sent;
      const matchStatus =
        !dispatchStatusFilter ||
        (dispatchStatusFilter === "Sent" ? isSent : !isSent);
      return matchFaculty && matchDegree && matchSearch && matchStatus;
    });
  }, [
    dispatcherStudents,
    dispatchType,
    dispatchFacultyFilter,
    dispatchDegreeFilter,
    dispatchSearchRegNo,
    dispatchStatusFilter,
  ]);

  useEffect(() => {
    setSelectedDispatcherStudents([]);
  }, [dispatchType, dispatchFacultyFilter, dispatchDegreeFilter, dispatchStatusFilter]);

  const filteredRegistryStudents = React.useMemo(() => {
    const validStudents = registryStudents.filter(
      (s) =>
        s.verification_status === "Approved" &&
        (s.attending_convocation === false || (s.session_number !== null && s.seat_number !== null)) &&
        s.certificate_number !== null &&
        s.email_sent === true
    );

    if (!registrySearch.trim()) return validStudents;
    const q = registrySearch.toLowerCase().trim();
    return validStudents.filter(
      (s) =>
        (s.full_name || "").toLowerCase().includes(q) ||
        (s.name_with_initials || "").toLowerCase().includes(q) ||
        (s.index_no || "").toLowerCase().includes(q) ||
        (s.registration_no || "").toLowerCase().includes(q) ||
        (s.nic_no || "").toLowerCase().includes(q) ||
        (s.certificate_number ? String(s.certificate_number).toLowerCase().includes(q) : false),
    );
  }, [registryStudents, registrySearch]);

  useEffect(() => {
    if (
      [
        "accounts",
        "db_maintenance",
        "faculties_sessions",
        "audit_logs",
        "email_templates",
      ].includes(activeTab)
    ) {
      setExpandedSection("admin");
    } else {
      setExpandedSection("general");
    }
  }, [activeTab]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertPlaceholderTag = (tag: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);

    const newValue = before + tag + after;
    setTemplateBody(newValue);

    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + tag.length;
    }, 50);
  };

  const getTemplatePreview = () => {
    let html = templateBody || "";
    const mockName = "Jane Doe";
    const mockRejection =
      "The uploaded payment slip is blurry and could not be verified by the admin panel.";
    const mockMagicLink =
      typeof window !== "undefined"
        ? `${window.location.origin}/api/student/auth/magic-login?email=student@uni.lk&token=mock-token`
        : "";
    const mockLoginLink =
      typeof window !== "undefined"
        ? `${window.location.origin}/?email=student@uni.lk&token=mock-token`
        : "";

    html = html
      .replace(/\{\{student_name\}\}/g, mockName)
      .replace(/\{\{magic_link_url\}\}/g, mockMagicLink)
      .replace(/\{\{rejection_reason\}\}/g, mockRejection)
      .replace(/\{\{login_url\}\}/g, mockLoginLink);

    return html;
  };

  const handleIframeLoad = () => {
    const iframe = iframeRef.current;
    if (!iframe || !iframe.contentDocument) return;
    const doc = iframe.contentDocument;

    doc.body.contentEditable = "true";
    doc.body.setAttribute("spellcheck", "false");

    const style = doc.createElement("style");
    style.innerHTML = `
      body:focus { outline: none !important; }
      * { outline: none !important; }
    `;
    doc.head.appendChild(style);

    const handleInput = () => {
      let html = "";
      if (doc.doctype) {
        html += new XMLSerializer().serializeToString(doc.doctype) + "\n";
      }
      html += doc.documentElement.outerHTML;
      setTemplateBody(html);
    };

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest("a");
      if (anchor) {
        e.preventDefault();
      }
    };

        doc.body.addEventListener("input", handleInput);
    doc.addEventListener("click", handleClick);
  };

  const execEditorCommand = (command: string, value: string = "") => {
    const iframe = iframeRef.current;
    if (!iframe || !iframe.contentDocument) return;
    const doc = iframe.contentDocument;
    iframe.contentWindow?.focus();
    doc.body.focus();
    doc.execCommand(command, false, value);
    let html = "";
    if (doc.doctype) {
      html += new XMLSerializer().serializeToString(doc.doctype) + "\n";
    }
    html += doc.documentElement.outerHTML;
    setTemplateBody(html);
  };

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

  // Auto-calculate degree_no for selected faculty
  useEffect(() => {
    const facultyDegrees = degrees.filter((d) => d.faculty === degFaculty);
    const nextNo =
      facultyDegrees.length > 0
        ? Math.max(...facultyDegrees.map((d) => d.degree_no)) + 1
        : 1;
    setDegNo(String(nextNo));
  }, [degFaculty, degrees]);

  // Synchronize allocateFaculty option with dynamic FACULTIES list
  useEffect(() => {
    if (FACULTIES.length > 0) {
      const validChoices = [
        ...FACULTIES.map((f) => `${f} (Internal)`),
        "All External Degrees",
      ];
      if (!validChoices.includes(allocateFaculty)) {
        setAllocateFaculty(`${FACULTIES[0]} (Internal)`);
      }
    }
  }, [FACULTIES, allocateFaculty]);

  // Ingestion selected degree cascade
  useEffect(() => {
    setIngestDegreeId("");
  }, [ingestFaculty]);

  // Edit / Update degree handlers
  const handleEditClick = (deg: any) => {
    setEditingDegree(deg);
    setEditEn(deg.name_en);
    setEditSi(deg.name_si);
    setEditTa(deg.name_ta);
    setEditType(deg.type);
  };

  const handleUpdateDegree = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDegree) return;
    setLoading(true);
    try {
      const res = await fetch("/api/degrees", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingDegree.id,
          name_en: editEn,
          name_si: editSi,
          name_ta: editTa,
          type: editType,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        triggerAlert(true, "Degree details updated successfully!");
        setEditingDegree(null);
        loadDegrees();
      } else {
        triggerAlert(false, json.error || "Failed to update degree.");
      }
    } catch {
      triggerAlert(false, "Network error.");
    } finally {
      setLoading(false);
    }
  };

  const handleImportDegreesExcel = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: "binary" });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

          if (data.length === 0) {
            triggerAlert(false, "The uploaded sheet is empty.");
            setLoading(false);
            return;
          }

          // Dynamic header detection in the top 5 rows
          let headerRowIdx = -1;
          let facultyIdx = 1;
          let degreeNoIdx = 2;
          let nameEnIdx = 3;
          let nameSiIdx = 4;
          let nameTaIdx = 5;
          let typeIdx = 6;

          for (let rIdx = 0; rIdx < Math.min(data.length, 5); rIdx++) {
            const row = data[rIdx];
            if (row && Array.isArray(row)) {
              let matches = 0;
              row.forEach((cell) => {
                if (cell !== undefined && cell !== null) {
                  const val = String(cell).toLowerCase().trim();
                  if (
                    val === "faculty" ||
                    val.includes("f.no") ||
                    val.includes("degree title") ||
                    val.includes("degree type") ||
                    val.includes("sinhala") ||
                    val.includes("tamil") ||
                    val.includes("english")
                  ) {
                    matches++;
                  }
                }
              });
              if (matches >= 2) {
                headerRowIdx = rIdx;
                row.forEach((cell, cIdx) => {
                  if (cell !== undefined && cell !== null) {
                    const val = String(cell).toLowerCase().trim();
                    if (val === "faculty") {
                      facultyIdx = cIdx;
                    } else if (
                      val.includes("f.no") ||
                      val.includes("f. no") ||
                      val.includes("degree no") ||
                      val.includes("degree number") ||
                      val === "fno"
                    ) {
                      degreeNoIdx = cIdx;
                    } else if (
                      val.includes("english") ||
                      val.includes("en") ||
                      val.includes("title in english")
                    ) {
                      nameEnIdx = cIdx;
                    } else if (
                      val.includes("sinhala") ||
                      val.includes("si") ||
                      val.includes("title in sinhala")
                    ) {
                      nameSiIdx = cIdx;
                    } else if (
                      val.includes("tamil") ||
                      val.includes("ta") ||
                      val.includes("title in tamil")
                    ) {
                      nameTaIdx = cIdx;
                    } else if (val.includes("type")) {
                      typeIdx = cIdx;
                    }
                  }
                });
                break;
              }
            }
          }

          const startIdx = headerRowIdx !== -1 ? headerRowIdx + 1 : 1;

          const parsedRows = [];
          for (let i = startIdx; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length === 0) continue;

            const cellFaculty = row[facultyIdx];
            const cellDegreeNo = row[degreeNoIdx];
            const cellNameEn = row[nameEnIdx];
            const cellNameSi = row[nameSiIdx];
            const cellNameTa = row[nameTaIdx];
            const cellType = row[typeIdx];

            const faculty =
              cellFaculty !== undefined && cellFaculty !== null
                ? String(cellFaculty).trim()
                : "";
            const degreeNoStr =
              cellDegreeNo !== undefined && cellDegreeNo !== null
                ? String(cellDegreeNo).trim()
                : "";
            const nameEn =
              cellNameEn !== undefined && cellNameEn !== null
                ? String(cellNameEn).trim()
                : "";
            const nameSi =
              cellNameSi !== undefined && cellNameSi !== null
                ? String(cellNameSi).trim()
                : "";
            const nameTa =
              cellNameTa !== undefined && cellNameTa !== null
                ? String(cellNameTa).trim()
                : "";
            const typeRaw =
              cellType !== undefined && cellType !== null
                ? String(cellType).trim()
                : "";

            // Skip completely empty rows
            if (
              !faculty &&
              !degreeNoStr &&
              !nameEn &&
              !nameSi &&
              !nameTa &&
              !typeRaw
            ) {
              continue;
            }

            let type = typeRaw;
            if (typeRaw.toLowerCase() === "internal") {
              type = "Internal";
            } else if (typeRaw.toLowerCase() === "external") {
              type = "External";
            }

            let matchedFaculty = faculty;
            if (faculty) {
              const found = FACULTIES.find(
                (f) => f.toLowerCase() === faculty.toLowerCase(),
              );
              if (found) {
                matchedFaculty = found;
              }
            }

            const degreeNo =
              degreeNoStr && !isNaN(parseInt(degreeNoStr, 10))
                ? parseInt(degreeNoStr, 10)
                : undefined;

            parsedRows.push({
              faculty: matchedFaculty || undefined,
              degree_no: degreeNo,
              name_en: nameEn || undefined,
              name_si: nameSi || undefined,
              name_ta: nameTa || undefined,
              type: type || undefined,
            });
          }

          if (parsedRows.length === 0) {
            triggerAlert(false, "No valid degree records found in the sheet.");
            setLoading(false);
            return;
          }

          const res = await fetch("/api/degrees/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rows: parsedRows }),
          });

          const json = await res.json();
          if (res.ok && json.success) {
            setDegreeStagingResults(json.results);
            setIsDegreeBatchValid(json.isValidBatch);
            setShowDegreeStagingModal(true); // Open preview modal automatically
            triggerAlert(
              true,
              `Excel parsed. ${json.results.length} degrees loaded into validation staging grid.`,
            );
          } else {
            triggerAlert(false, json.error || "Failed parsing bulk upload.");
          }
        } catch (err: any) {
          triggerAlert(false, "Failed parsing excel: " + err.message);
        } finally {
          setLoading(false);
          e.target.value = "";
        }
      };
      reader.readAsBinaryString(file);
    } catch (err: any) {
      triggerAlert(false, "File read error: " + err.message);
      setLoading(false);
    }
  };

  const handleCommitDegreeImport = async () => {
    if (!isDegreeBatchValid || degreeStagingResults.length === 0) return;
    setLoading(true);
    try {
      const rowsToInsert = degreeStagingResults.map((r) => r.data);
      const res = await fetch("/api/degrees/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: rowsToInsert }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        triggerAlert(
          true,
          `Successfully committed ${json.count} degree records to production database.`,
        );
        setDegreeStagingResults([]);
        setShowDegreeStagingModal(false);
        loadDegrees();
      } else {
        triggerAlert(false, json.error || "Failed to commit staging records.");
      }
    } catch {
      triggerAlert(false, "Network error.");
    } finally {
      setLoading(false);
    }
  };

  const handleClearDegreeStaging = () => {
    setDegreeStagingResults([]);
    setIsDegreeBatchValid(false);
    setShowDegreeStagingModal(false);
    triggerAlert(true, "Degree staging data validation grid cleared.");
  };

  const renderDegreeStagingGrid = (isModal: boolean) => {
    if (degreeStagingResults.length === 0) return null;
    return (
      <div className="space-y-4 font-sans">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Degree Staging Data Validation Grid
            </h3>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Cell highlights indicate validation issues. Double check spelling
              and faculty names.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isModal && (
              <Button
                variant="outline"
                onClick={() => setShowDegreeStagingModal(false)}
                className="border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-950 text-slate-700 dark:text-slate-355 rounded-xl text-xs font-bold h-9 px-4"
              >
                Close Preview
              </Button>
            )}
            <Button
              variant="outline"
              onClick={handleClearDegreeStaging}
              disabled={loading}
              className="border-red-200 dark:border-red-950/40 hover:bg-red-50 dark:hover:bg-red-950/10 text-red-650 dark:text-red-400 rounded-xl text-xs font-bold h-9 px-4 flex items-center gap-1.5"
            >
              <Trash2 className="h-4 w-4" />
              Clear Staging
            </Button>
            <Button
              onClick={handleCommitDegreeImport}
              disabled={loading || !isDegreeBatchValid}
              className={`font-bold h-9 text-xs rounded-xl px-4 flex items-center gap-1.5 transition ${
                isDegreeBatchValid
                  ? "bg-blue-600 hover:bg-blue-700 text-white shadow"
                  : "bg-slate-100 dark:bg-slate-900 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-800"
              }`}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Commit Validated Registry
            </Button>
          </div>
        </div>

        <div className="border border-slate-200 dark:border-slate-900 rounded-xl overflow-x-auto overflow-y-auto max-h-[400px]">
          <Table className="text-[11px] whitespace-nowrap min-w-[900px]">
            <TableHeader className="bg-slate-100 dark:bg-slate-950/70 sticky top-0 z-10">
              <TableRow className="border-b border-slate-200 dark:border-slate-900">
                <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-3 py-2 w-12">
                  Row
                </TableHead>
                <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-3 py-2">
                  Faculty
                </TableHead>
                <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-3 py-2">
                  F.No
                </TableHead>
                <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-3 py-2">
                  English Title
                </TableHead>
                <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-3 py-2">
                  Sinhala Title
                </TableHead>
                <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-3 py-2">
                  Tamil Title
                </TableHead>
                <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-3 py-2">
                  Type
                </TableHead>
                <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-3 py-2">
                  Errors
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-200 dark:divide-slate-900">
              {degreeStagingResults.map((r, i) => (
                <TableRow
                  key={i}
                  className={`border-b border-slate-200 dark:border-slate-900 hover:bg-slate-100/30 dark:hover:bg-slate-900/10 transition-colors ${
                    !r.isValid ? "bg-red-500/5 dark:bg-red-950/15" : ""
                  }`}
                >
                  <TableCell className="px-3 py-2 text-slate-400 dark:text-slate-500 font-bold">
                    {r.rowNumber}
                  </TableCell>
                  <TableCell
                    className={`px-3 py-2 font-bold ${r.errors.faculty ? "text-red-650 dark:text-red-400 bg-red-500/5 dark:bg-red-950/20" : "text-slate-800 dark:text-slate-200"}`}
                  >
                    {r.data.faculty}
                  </TableCell>
                  <TableCell
                    className={`px-3 py-2 ${r.errors.degree_no ? "text-red-650 dark:text-red-400 bg-red-500/5 dark:bg-red-950/20" : "text-slate-700 dark:text-slate-300"}`}
                  >
                    {r.data.degree_no}
                  </TableCell>
                  <TableCell
                    className={`px-3 py-2 ${r.errors.name_en ? "text-red-650 dark:text-red-400 bg-red-500/5 dark:bg-red-950/20 font-semibold" : "text-slate-700 dark:text-slate-300 font-semibold"}`}
                  >
                    {r.data.name_en}
                  </TableCell>
                  <TableCell
                    className={`px-3 py-2 ${r.errors.name_si ? "text-red-650 dark:text-red-400 bg-red-500/5 dark:bg-red-950/20 font-semibold" : "text-slate-800 dark:text-slate-300 font-semibold"}`}
                  >
                    {r.data.name_si}
                  </TableCell>
                  <TableCell
                    className={`px-3 py-2 ${r.errors.name_ta ? "text-red-650 dark:text-red-400 bg-red-500/5 dark:bg-red-950/20 font-semibold" : "text-slate-800 dark:text-slate-300 font-semibold"}`}
                  >
                    {r.data.name_ta}
                  </TableCell>
                  <TableCell
                    className={`px-3 py-2 ${r.errors.type ? "text-red-650 dark:text-red-400 bg-red-500/5 dark:bg-red-950/20" : "text-slate-750 dark:text-slate-300"}`}
                  >
                    {r.data.type}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-red-650 dark:text-red-400 font-medium whitespace-normal break-words min-w-[200px]">
                    {Object.values(r.errors).join("; ")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: loginUsername,
          password: loginPassword,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setStaffUser(json.user);
        setLoginUsername("");
        setLoginPassword("");
      } else {
        setLoginError(json.error || "Invalid username or password.");
      }
    } catch {
      setLoginError("A network error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth/logout", { method: "POST" });
      if (res.ok) {
        setStaffUser(null);
        setActiveTab("degrees");
        triggerAlert(true, "Logged out successfully.");
      } else {
        triggerAlert(false, "Logout failed.");
      }
    } catch {
      triggerAlert(false, "Network error during logout.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: newStaffUsername,
          password: newStaffPassword,
          name: newStaffName,
          role: newStaffRole,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        triggerAlert(true, `Successfully created account for ${newStaffName}!`);
        setNewStaffUsername("");
        setNewStaffPassword("");
        setNewStaffName("");
        setNewStaffRole("Staff");
        loadStaff();
      } else {
        triggerAlert(false, json.error || "Failed to create staff account.");
      }
    } catch {
      triggerAlert(false, "Network error.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStaffStatus = async (
    id: number,
    username: string,
    currentStatus: string,
  ) => {
    if (username === staffUser?.username) return;
    const newStatus = currentStatus === "Disabled" ? "Active" : "Disabled";
    setLoading(true);
    try {
      const res = await fetch("/api/admin/staff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        triggerAlert(true, `Staff account status updated to ${newStatus}.`);
        loadStaff();
      } else {
        triggerAlert(false, json.error || "Failed to update staff status.");
      }
    } catch (err: any) {
      triggerAlert(false, err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStaff = async (id: number, username: string) => {
    if (username === staffUser?.username) return;
    if (
      !confirm(
        `Are you sure you want to permanently delete administrative account: ${username}?`,
      )
    )
      return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/staff?id=${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (res.ok && json.success) {
        triggerAlert(true, `Staff account '${username}' successfully deleted.`);
        loadStaff();
      } else {
        triggerAlert(false, json.error || "Failed to delete staff account.");
      }
    } catch (err: any) {
      triggerAlert(false, err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFacultyName.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/faculties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newFacultyName }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        triggerAlert(true, `Faculty '${newFacultyName}' added successfully.`);
        setNewFacultyName("");
        loadFaculties();
      } else {
        triggerAlert(false, json.error || "Failed to add faculty.");
      }
    } catch (err: any) {
      triggerAlert(false, err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFaculty = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete Faculty: ${name}?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/faculties?id=${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (res.ok && json.success) {
        triggerAlert(true, `Faculty '${name}' deleted successfully.`);
        loadFaculties();
      } else {
        triggerAlert(false, json.error || "Failed to delete faculty.");
      }
    } catch (err: any) {
      triggerAlert(false, err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionNumber) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/convocation-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionNumber: parseInt(newSessionNumber),
          sessionName: newSessionName,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        triggerAlert(true, `Session ${newSessionNumber} added successfully.`);
        setNewSessionNumber("");
        setNewSessionName("");
        loadConvocationSessions();
      } else {
        triggerAlert(false, json.error || "Failed to add session.");
      }
    } catch (err: any) {
      triggerAlert(false, err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSession = async (id: number, sessionNum: number) => {
    if (!confirm(`Are you sure you want to delete Session ${sessionNum}?`))
      return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/convocation-sessions?id=${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (res.ok && json.success) {
        triggerAlert(true, `Session ${sessionNum} deleted successfully.`);
        loadConvocationSessions();
      } else {
        triggerAlert(false, json.error || "Failed to delete session.");
      }
    } catch (err: any) {
      triggerAlert(false, err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTransitionActiveSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transitionYear.trim()) {
      triggerAlert(
        false,
        "Convocation year is required to transition active session.",
      );
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/active-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          convocation_year: transitionYear,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        triggerAlert(
          true,
          `Successfully transitioned active convocation session to ${transitionYear}`,
        );
        setTransitionYear("");
        loadTimeline();
        loadStudents();
      } else {
        triggerAlert(false, json.error || "Failed to transition session.");
      }
    } catch (err: any) {
      triggerAlert(false, err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const cleanBody = unwrapPlaceholdersInHtml(templateBody);
      const res = await fetch("/api/admin/email-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateKey: selectedTemplateKey,
          subject: templateSubject,
          body: cleanBody,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        triggerAlert(true, "Email template updated successfully.");
        loadEmailTemplates();
      } else {
        triggerAlert(false, json.error || "Failed to update email template.");
      }
    } catch (err: any) {
      triggerAlert(false, err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDispatchEmails = async () => {
    if (selectedDispatcherStudents.length === 0) {
      triggerAlert(false, "No students selected for email dispatch.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/dispatch-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentIds: selectedDispatcherStudents,
          type: dispatchType,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        const msg =
          dispatchType === "confirmation"
            ? `Successfully sent seat confirmation emails to ${json.sentCount} candidates.`
            : dispatchType === "in_absentia"
            ? `Successfully sent in absentia confirmation emails to ${json.sentCount} candidates.`
            : `Successfully sent magic link emails to ${json.sentCount} candidates.`;
        triggerAlert(true, msg);
        setSelectedDispatcherStudents([]);
        loadDispatcherStudents();
      } else {
        triggerAlert(false, json.error || "Failed to dispatch emails.");
      }
    } catch (err: any) {
      triggerAlert(false, err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDegree = async (id: string) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this degree? This action cannot be undone.",
      )
    ) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/degrees?id=${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (res.ok && json.success) {
        triggerAlert(true, "Degree deleted successfully!");
        loadDegrees();
      } else {
        triggerAlert(false, json.error || "Failed to delete degree.");
      }
    } catch {
      triggerAlert(false, "Network error.");
    } finally {
      setLoading(false);
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
      const res = await fetch("/api/degrees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: degCode,
          faculty: degFaculty,
          degree_no: degNo,
          name_en: degEn,
          name_si: degSi,
          name_ta: degTa,
          type: degType,
        }),
      });

      const json = await res.json();
      if (res.ok) {
        triggerAlert(true, "Degree course added successfully!");
        setDegCode("");
        setDegNo("");
        setDegEn("");
        setDegSi("");
        setDegTa("");
        loadDegrees();
      } else {
        triggerAlert(false, json.error || "Validation failed. Check entries.");
      }
    } catch (err) {
      triggerAlert(false, "Network error.");
    } finally {
      setLoading(false);
    }
  };

    // 2. PARSE AND UPLOAD BULK STAGING DATA
  const parseExcelDate = (val: any) => {
    if (val === undefined || val === null) return "";
    if (val instanceof Date) {
      const year = val.getFullYear();
      const month = String(val.getMonth() + 1).padStart(2, '0');
      const day = String(val.getDate()).padStart(2, '0');
      return year + "-" + month + "-" + day;
    }
    if (typeof val === "number") {
      const date = new Date(Math.round((val - 25569) * 86400 * 1000));
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      return year + "-" + month + "-" + day;
    }
    return String(val).trim();
  };

  const handleIngestFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setIngestFile(file);
    if (!file) return;

    if (!ingestDegreeId) {
      triggerAlert(false, "Please select a Target Degree program first.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      setIngestFile(null);
      return;
    }

    const selectedDegree = degrees.find((d) => d.id === ingestDegreeId);
    const selectedDegreeName = selectedDegree ? selectedDegree.name_en : "";

    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];

        // Parse rows by index based on specified order:
        // No, Name with Initials, Full Name, Registration No, Index No, Effective Date, Class, Final GPA, NIC No, Email Address, Postal Address, Contact No
        const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (data.length === 0) {
          triggerAlert(false, "Uploaded Excel sheet is empty.");
          return;
        }

        // Detect if first row is a header row
        const firstRow = data[0];
        const isHeader =
          firstRow &&
          firstRow.some((cell: any) => {
            if (typeof cell === "string") {
              const lower = cell.toLowerCase().trim();
              return [
                "no",
                "reg no",
                "index no",
                "index",
                "nic",
                "nic no",
                "full name",
                "name with initials",
                "name with initails",
                "gpa",
                "class",
                "degree",
                "email",
                "address",
                "contact no",
                "contactno.",
                "contactno",
              ].includes(lower);
            }
            return false;
          });

        const startIdx = isHeader ? 1 : 0;
        const mappedRows = [];

        for (let idx = startIdx; idx < data.length; idx++) {
          const r = data[idx];
          if (!r || r.length === 0) continue;

          // Skip completely empty rows
          if (
            r.every(
              (cell: any) => cell === undefined || cell === null || cell === "",
            )
          )
            continue;

          mappedRows.push({
            name_with_initials:
              r[1] !== undefined && r[1] !== null ? String(r[1]).trim() : "",
            full_name:
              r[2] !== undefined && r[2] !== null ? String(r[2]).trim() : "",
            registration_no:
              r[3] !== undefined && r[3] !== null ? String(r[3]).trim() : "",
            index_no:
              r[4] !== undefined && r[4] !== null ? String(r[4]).trim() : "",
            effective_date: parseExcelDate(r[5]),
            class:
              r[6] !== undefined && r[6] !== null ? String(r[6]).trim() : "",
            gpa:
              r[7] !== undefined && r[7] !== null && r[7] !== "" ? r[7] : null,
            nic_no:
              r[8] !== undefined && r[8] !== null ? String(r[8]).trim() : "",
            email:
              r[9] !== undefined && r[9] !== null ? String(r[9]).trim() : "",
            address:
              r[10] !== undefined && r[10] !== null ? String(r[10]).trim() : "",
            contact_no:
              r[11] !== undefined && r[11] !== null ? String(r[11]).trim() : "",
            degree_name: selectedDegreeName,
            faculty: ingestFaculty,
          });
        }

        // Send to staging validation endpoint
        const res = await fetch("/api/ingestion", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: mappedRows }),
        });

        const json = await res.json();
        if (res.ok) {
          setStagingResults(json.results);
          setIsValidBatch(json.isValidBatch);
          setShowStagingModal(true); // Open the preview modal automatically
          triggerAlert(
            true,
            `Excel parsed. ${json.results.length} rows loaded into validation staging grid.`,
          );
        } else {
          triggerAlert(false, json.error || "Failed parsing bulk upload.");
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
      const rowsToInsert = stagingResults.map((r) => ({
        ...r.data,
        degreeId: r.degreeId,
      }));

      const res = await fetch("/api/ingestion/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: rowsToInsert }),
      });

      const json = await res.json();
      if (res.ok) {
        triggerAlert(
          true,
          `Successfully committed ${json.count} student records to production database in ${json.durationMs}ms.`,
        );
        setStagingResults([]);
        setIngestFile(null);
        setIsValidBatch(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
        loadStudents();
        loadIngestStudents();
      } else {
        triggerAlert(false, json.error || "Failed to commit staging records.");
      }
    } catch (err) {
      triggerAlert(false, "Network error.");
    } finally {
      setLoading(false);
    }
  };

  const handleClearStaging = () => {
    setStagingResults([]);
    setIngestFile(null);
    setIsValidBatch(false);
    setShowStagingModal(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    triggerAlert(true, "Staging data validation grid cleared.");
  };

  // 3. SET TIMELINE WINDOW
  const handleSaveTimeline = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/timeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          open_date: new Date(openDate).toISOString(),
          close_date: new Date(closeDate).toISOString(),
          is_manually_closed: isManuallyClosed,
        }),
      });

      const json = await res.json();
      if (res.ok) {
        triggerAlert(true, "Timeline dates updated successfully.");
        setTimelineConfig(json.data);
      } else {
        triggerAlert(
          false,
          json.errors?.close_date?.[0] ||
            json.error ||
            "Invalid date window bounds.",
        );
      }
    } catch (err) {
      triggerAlert(false, "Network error.");
    } finally {
      setLoading(false);
    }
  };

  // 4. AUDIT REVIEWS: APPROVE / REJECT / REVOKE
  const handleApproveStudent = async () => {
    if (!selectedStudent) return;
    if (!selectedStudent.attendance_confirmed) {
      triggerAlert(false, "Cannot approve student who has not filled and submitted their registration details.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: selectedStudent.id,
          action: "approve",
          adminId: "ADMIN_EXAM_COORDINATOR",
        }),
      });

      const json = await res.json();
      if (res.ok) {
        triggerAlert(
          true,
          "Student profile approved and name corrections updated.",
        );
        loadStudents();
        loadAuditLogs();
        setSelectedStudent(null);
      } else {
        triggerAlert(false, json.error || "Approve action failed.");
      }
    } catch (err) {
      triggerAlert(false, "Network error.");
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeStudent = async () => {
    if (!selectedStudent) return;
    if (!window.confirm("Are you sure you want to revoke this student's approval? Their seating and certificate numbers will be cleared.")) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: selectedStudent.id,
          action: "revoke",
        }),
      });

      const json = await res.json();
      if (res.ok) {
        triggerAlert(
          true,
          "Student approval revoked successfully. Seating and certificate numbers cleared.",
        );
        loadStudents();
        loadAuditLogs();
        setSelectedStudent(null);
      } else {
        triggerAlert(false, json.error || "Revoke action failed.");
      }
    } catch (err) {
      triggerAlert(false, "Network error.");
    } finally {
      setLoading(false);
    }
  };

  const handleRejectStudent = async () => {
    if (!selectedStudent || !rejectReason) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: selectedStudent.id,
          action: "reject",
          rejectReason,
          adminId: "ADMIN_EXAM_COORDINATOR",
        }),
      });

      const json = await res.json();
      if (res.ok) {
        triggerAlert(
          true,
          "Registration profile rejected and successfully unlocked for student correction.",
        );
        setShowRejectDialog(false);
        setRejectReason("");
        loadStudents();
        loadAuditLogs();
        setSelectedStudent(null);
      } else {
        triggerAlert(false, json.error || "Reject action failed.");
      }
    } catch (err) {
      triggerAlert(false, "Network error.");
    } finally {
      setLoading(false);
    }
  };

  // 5. SESSION & SEATING ALLOCATION HANDLERS
  const handleSaveSessionAllocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessAllocGroup || !sessAllocSession) {
      triggerAlert(false, "Please select both a group and a session.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/convocation-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "allocate",
          groupName: sessAllocGroup,
          sessionNumber: sessAllocSession,
          sessionDate: sessAllocDate,
          sessionTime: sessAllocTime,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        triggerAlert(true, `Successfully allocated ${sessAllocGroup} to Session ${sessAllocSession}.`);
        loadConvocationSessions();
        loadSessionAllocations();
        loadStudents();
      } else {
        triggerAlert(false, json.error || "Failed to allocate session.");
      }
    } catch (err) {
      triggerAlert(false, "Network error.");
    } finally {
      setLoading(false);
    }
  };

  const handleClearSessionAllocation = async (groupName: string) => {
    if (!window.confirm(`Are you sure you want to clear session allocation for ${groupName}?`)) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/convocation-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "clear_allocation",
          groupName,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        triggerAlert(true, `Successfully cleared session allocation for ${groupName}.`);
        loadConvocationSessions();
        loadSessionAllocations();
        loadStudents();
      } else {
        triggerAlert(false, json.error || "Failed to clear session allocation.");
      }
    } catch (err) {
      triggerAlert(false, "Network error.");
    } finally {
      setLoading(false);
    }
  };

  const handleClearAllAllocations = async () => {
    if (!window.confirm("Are you sure you want to clear ALL session allocations? This will remove all group-to-session mappings.")) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/convocation-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear_all_allocations" }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        triggerAlert(true, "All session allocations have been cleared.");
        loadConvocationSessions();
        loadSessionAllocations();
        loadStudents();
      } else {
        triggerAlert(false, json.error || "Failed to clear all allocations.");
      }
    } catch (err) {
      triggerAlert(false, "Network error.");
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerSeatingAllocation = async (groupName: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          group: groupName,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        triggerAlert(
          true,
          `Successfully allocated seats for ${groupName}. Session: ${json.data.sessionNumber}. Allocated: ${json.data.allocatedCount} candidates.`,
        );
        loadSessionAllocations();
        loadStudents();
      } else {
        triggerAlert(false, json.error || "Failed to allocate seats.");
      }
    } catch (err) {
      triggerAlert(false, "Network error.");
    } finally {
      setLoading(false);
    }
  };

  const handleClearSeatingAllocation = async (groupName: string) => {
    if (!window.confirm(`Are you sure you want to clear seating allocation for ${groupName}?`)) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/sessions?group=${encodeURIComponent(groupName)}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (res.ok && json.success) {
        triggerAlert(true, json.message || `Cleared allocation for ${groupName}.`);
        loadSessionAllocations();
        loadStudents();
      } else {
        triggerAlert(false, json.error || "Failed to clear allocation.");
      }
    } catch (err) {
      triggerAlert(false, "Network error.");
    } finally {
      setLoading(false);
    }
  };

  // 6. CERTIFICATE PRINT PIPELINE
  const handleTriggerPrint = async () => {
    if (!printFaculty || !printDegreeId) {
      triggerAlert(
        false,
        "Please select both Faculty and Degree before generating certificates.",
      );
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          faculty: printFaculty,
          degreeId: printDegreeId,
        }),
      });
      const json = await res.json();
      if (res.status === 202) {
        triggerAlert(
          true,
          "Duplex certificate compilation queue initiated in isolated background worker.",
        );
        loadPrintStatus();
      } else {
        triggerAlert(false, json.error || "Generation trigger failed.");
      }
    } catch (err) {
      triggerAlert(false, "Network error.");
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
              variant="outline"
              onClick={handleClearStaging}
              disabled={loading}
              className="border-red-200 dark:border-red-950/40 hover:bg-red-50 dark:hover:bg-red-950/10 text-red-650 dark:text-red-400 rounded-xl text-xs font-bold h-9 px-4 flex items-center gap-1.5"
            >
              <Trash2 className="h-4 w-4" />
              Clear Staging
            </Button>
            <Button
              onClick={handleCommitIngest}
              disabled={loading || !isValidBatch}
              className={`font-bold h-9 text-xs rounded-xl px-4 flex items-center gap-1.5 transition ${
                isValidBatch
                  ? "bg-blue-600 hover:bg-blue-700 text-white shadow"
                  : "bg-slate-100 dark:bg-slate-900 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-800"
              }`}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Commit Validated Registry
            </Button>
          </div>
        </div>

        <div className="border border-slate-200 dark:border-slate-900 rounded-xl overflow-x-auto overflow-y-auto max-h-[400px]">
          <Table className="text-[11px] whitespace-nowrap min-w-[1300px]">
            <TableHeader className="bg-slate-100 dark:bg-slate-950/70 sticky top-0 z-10">
              <TableRow className="border-b border-slate-200 dark:border-slate-900">
                <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-3 py-2 w-12">
                  Row
                </TableHead>
                <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-3 py-2">
                  Index No
                </TableHead>
                <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-3 py-2">
                  Reg No
                </TableHead>
                <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-3 py-2">
                  NIC No
                </TableHead>
                <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-3 py-2">
                  Full Name
                </TableHead>
                <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-3 py-2">
                  Name with Initials
                </TableHead>
                <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-3 py-2">
                  Email Address
                </TableHead>
                <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-3 py-2">
                  Degree
                </TableHead>
                                <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-3 py-2">
                  GPA
                </TableHead>
                <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-3 py-2">
                  Class
                </TableHead>
                <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-3 py-2">
                  Effective Date
                </TableHead>
                <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-3 py-2">
                  Errors
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-200 dark:divide-slate-900">
              {stagingResults.map((r, i) => (
                <TableRow
                  key={i}
                  className={`border-b border-slate-200 dark:border-slate-900 hover:bg-slate-100/30 dark:hover:bg-slate-900/10 transition-colors ${
                    !r.isValid ? "bg-red-500/5 dark:bg-red-950/15" : ""
                  }`}
                >
                  <TableCell className="px-3 py-2 text-slate-400 dark:text-slate-500 font-bold">
                    {r.rowNumber}
                  </TableCell>
                  <TableCell
                    className={`px-3 py-2 font-bold ${r.errors.index_no ? "text-red-600 dark:text-red-400 bg-red-500/5 dark:bg-red-950/20" : "text-slate-800 dark:text-slate-200"}`}
                  >
                    {r.data.index_no}
                  </TableCell>
                  <TableCell
                    className={`px-3 py-2 ${r.errors.registration_no ? "text-red-600 dark:text-red-400 bg-red-500/5 dark:bg-red-950/20" : "text-slate-700 dark:text-slate-300"}`}
                  >
                    {r.data.registration_no}
                  </TableCell>
                  <TableCell
                    className={`px-3 py-2 ${r.errors.nic_no ? "text-red-600 dark:text-red-400 bg-red-500/5 dark:bg-red-950/20" : "text-slate-700 dark:text-slate-300"}`}
                  >
                    {r.data.nic_no}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-slate-800 dark:text-slate-300 font-semibold">
                    {r.data.full_name}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-slate-800 dark:text-slate-300 font-semibold">
                    {r.data.name_with_initials}
                  </TableCell>
                  <TableCell
                    className={`px-3 py-2 ${r.errors.email ? "text-red-600 dark:text-red-400 bg-red-500/5 dark:bg-red-950/20" : "text-slate-600 dark:text-slate-400"}`}
                  >
                    {r.data.email}
                  </TableCell>
                  <TableCell
                    className={`px-3 py-2 ${r.errors.degree_name ? "text-red-600 dark:text-red-400 bg-red-500/5 dark:bg-red-950/20" : "text-slate-800 dark:text-slate-300"}`}
                  >
                    {r.data.degree_name}
                  </TableCell>
                  <TableCell
                    className={`px-3 py-2 ${r.errors.gpa ? "text-red-600 dark:text-red-400 bg-red-500/5 dark:bg-red-950/20" : "text-slate-700 dark:text-slate-300"}`}
                  >
                    {r.data.gpa}
                  </TableCell>
                                    <TableCell className="px-3 py-2 text-slate-700 dark:text-slate-300">
                    {r.data.class}
                  </TableCell>
                  <TableCell
                    className={r.errors.effective_date ? "text-red-600 dark:text-red-400 bg-red-500/5 dark:bg-red-950/20" : "text-slate-700 dark:text-slate-300"}
                  >
                    {r.data.effective_date}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-red-650 dark:text-red-400 font-medium whitespace-normal break-words min-w-[250px]">
                    {Object.values(r.errors).join("; ")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  if (!sessionChecked) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center font-sans">
        <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
        <span className="text-xs font-bold text-slate-555 mt-2">
          Authenticating Session...
        </span>
      </div>
    );
  }

  if (!staffUser) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 flex flex-col relative overflow-hidden transition-colors duration-200 font-sans">
        {/* Floating Toast Container for Login */}
        <div className="fixed top-6 right-6 z-[100] flex flex-col gap-3 w-full max-w-sm pointer-events-none">
          {loginError && (
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-red-500/20 dark:border-red-500/35 shadow-2xl rounded-2xl p-4 flex items-start gap-3 w-full max-w-sm pointer-events-auto animate-in slide-in-from-top-4 duration-300">
              <div className="p-1.5 bg-red-500/10 text-red-655 dark:text-red-400 rounded-lg border border-red-500/20">
                <AlertCircle className="h-4 w-4" />
              </div>
              <div className="flex-1 space-y-0.5">
                <h4 className="text-xs font-black tracking-wide text-slate-855 dark:text-white uppercase">Error</h4>
                <p className="text-xs font-semibold text-slate-655 dark:text-red-450 leading-snug">{loginError}</p>
              </div>
              <button
                type="button"
                onClick={() => setLoginError(null)}
                className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

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
              <span className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white block">
                Graduation Portal
              </span>
              <span className="text-[10px] font-bold tracking-wider text-slate-500 dark:text-slate-400 block uppercase mt-0.5">
                Rajarata University of Sri Lanka
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
          </div>
        </header>

        {/* Login Form Container */}
        <main className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-12 max-w-7xl mx-auto w-full px-6 py-12">
          {/* Left column: Info section */}
          <div className="flex-1 space-y-6 lg:max-w-md">
            <div className="flex items-center">
              <img
                src="/templates/RUSL.png"
                alt="Rajarata University of Sri Lanka Logo"
                className="w-30 h-25 object-contain"
              />
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-semibold border border-blue-500/20 dark:border-blue-500/25">
              Administrative Gateway
            </div>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-none text-slate-900 dark:text-white">
              Administrative <br />
              <span className="bg-gradient-to-r from-blue-600 to-blue-500 dark:from-blue-400 dark:to-blue-600 bg-clip-text text-transparent">
                Graduation Console
              </span>
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
              Secure access portal for Exam Division staff and system
              administrators. Enter credentials to manage degree registries,
              process student registries, control portals, audit submissions,
              and trigger certificate compilation queues.
            </p>
          </div>

          {/* Right column: Login Card */}
          <div className="w-full max-w-md">
            <Card className="border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/30 backdrop-blur-md rounded-3xl shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-blue-500 via-sky-500 to-blue-600" />
              <CardHeader className="space-y-1 pb-6">
                <CardTitle className="text-xl font-extrabold text-slate-900 dark:text-white">
                  Staff Authenticator
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                  Enter credentials to access administrative systems.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label
                      htmlFor="loginUsername"
                      className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider"
                    >
                      Username
                    </Label>
                    <Input
                      id="loginUsername"
                      type="text"
                      placeholder="admin"
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      required
                      className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl text-sm h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="loginPassword"
                      className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider"
                    >
                      Password
                    </Label>
                    <Input
                      id="loginPassword"
                      type="password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                      className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl text-sm h-11"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 rounded-xl mt-2 relative transition-colors shadow-lg shadow-blue-500/20"
                  >
                    {loading ? (
                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-white" />
                    ) : (
                      "Sign In"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-200 dark:border-slate-900 py-6 text-center text-xs text-slate-500 dark:text-slate-600 transition-colors duration-200">
          © {new Date().getFullYear()} Exam Division. Rajarata University of Sri
          Lanka. All Rights Reserved.
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 flex flex-col font-sans transition-colors duration-200">
      {/* Floating Document Live Preview Overlay */}
      {previewUrl && (
        <div 
          className="fixed top-24 right-24 z-[100] w-[400px] h-[400px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-4 flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-200 pointer-events-none"
        >
          <div className="text-[10px] uppercase font-black tracking-wider text-slate-400 dark:text-slate-500 px-1">
            Document Live Preview
          </div>
          <div className="flex-1 w-full h-full rounded-2xl overflow-hidden bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-900/50 flex items-center justify-center">
            {previewUrl.toLowerCase().endsWith('.pdf') ? (
              <iframe src={`${previewUrl}#toolbar=0&navpanes=0`} className="w-full h-full border-0" />
            ) : (
              <img src={previewUrl} alt="Preview" className="w-full h-full object-contain" />
            )}
          </div>
        </div>
      )}

      {/* Floating Toast Container */}
      <div className="fixed top-6 right-6 z-[100] flex flex-col gap-3 w-full max-w-sm pointer-events-none">
        {successMsg && (
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-emerald-500/20 dark:border-emerald-500/35 shadow-2xl rounded-2xl p-4 flex items-start gap-3 w-full max-w-sm pointer-events-auto animate-in slide-in-from-top-4 duration-300">
            <div className="p-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg border border-emerald-500/20">
              <Check className="h-4 w-4" />
            </div>
            <div className="flex-1 space-y-0.5">
              <h4 className="text-xs font-black tracking-wide text-slate-855 dark:text-white uppercase">Success</h4>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 leading-snug">{successMsg}</p>
            </div>
            <button
              type="button"
              onClick={() => setSuccessMsg(null)}
              className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-red-500/20 dark:border-red-500/35 shadow-2xl rounded-2xl p-4 flex items-start gap-3 w-full max-w-sm pointer-events-auto animate-in slide-in-from-top-4 duration-300">
            <div className="p-1.5 bg-red-500/10 text-red-655 dark:text-red-400 rounded-lg border border-red-500/20">
              <AlertCircle className="h-4 w-4" />
            </div>
            <div className="flex-1 space-y-0.5">
              <h4 className="text-xs font-black tracking-wide text-slate-855 dark:text-white uppercase">Error</h4>
              <p className="text-xs font-semibold text-slate-655 dark:text-red-450 leading-snug whitespace-pre-wrap">{errorMsg}</p>
            </div>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
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
            <span className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white block">
              Graduation Portal
            </span>
            <span className="text-[10px] font-bold tracking-wider text-slate-500 dark:text-slate-400 block uppercase leading-none mt-0.5">
              Rajarata University of Sri Lanka
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
        </div>
      </header>

      {/* Main Admin Tabbed Interface */}
      <div className="flex-1 w-full flex flex-col md:flex-row">
        {/* Left Side Sidebar Navigation */}
        <aside className="w-full md:w-72 flex flex-col justify-between border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-6 md:fixed md:top-[73px] md:left-0 md:h-[calc(100vh-73px)] gap-6 shrink-0 z-40 transition-colors">
          <div className="flex flex-col gap-4">
            {staffUser?.role === "Administrator" ? (
              <>
                {/* Admin Controls Accordion */}
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedSection(
                        expandedSection === "admin" ? "general" : "admin",
                      )
                    }
                    className="w-full flex items-center justify-between px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-350 transition-colors cursor-pointer"
                  >
                    <span>Admin Controls</span>
                    <svg
                      className={`h-4 w-4 transform transition-transform duration-200 ${expandedSection === "admin" ? "rotate-180" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>

                  <div
                    className={`transition-all duration-300 ease-in-out overflow-hidden ${
                      expandedSection === "admin"
                        ? "max-h-[500px] opacity-100"
                        : "max-h-0 opacity-0 pointer-events-none"
                    }`}
                  >
                    <div className="flex flex-col gap-1.5 pt-1 pl-1">
                      {[
                        { id: "accounts", label: "Account Management" },
                        { id: "db_maintenance", label: "Database Management" },
                        {
                          id: "faculties_sessions",
                          label: "Faculty & Session Management",
                        },
                        { id: "audit_logs", label: "System Audit Logs" },
                        {
                          id: "email_templates",
                          label: "Email Configurations",
                        },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id as any)}
                          className={`w-full text-left px-4 py-2 text-xs font-bold transition rounded-xl ${
                            activeTab === tab.id
                              ? "bg-blue-600 text-white shadow-lg shadow-blue-500/10"
                              : "bg-white dark:bg-slate-900/40 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-900"
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* General Controls Accordion */}
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedSection(
                        expandedSection === "general" ? "admin" : "general",
                      )
                    }
                    className="w-full flex items-center justify-between px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-350 transition-colors cursor-pointer"
                  >
                    <span>General Controls</span>
                    <svg
                      className={`h-4 w-4 transform transition-transform duration-200 ${expandedSection === "general" ? "rotate-180" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>

                  <div
                    className={`transition-all duration-300 ease-in-out overflow-hidden ${
                      expandedSection === "general"
                        ? "max-h-[500px] opacity-100"
                        : "max-h-0 opacity-0 pointer-events-none"
                    }`}
                  >
                    <div className="flex flex-col gap-1.5 pt-1 pl-1">
                      {[
                        { id: "degrees", label: "Course Manager" },
                        { id: "timeline", label: "Timeline Control" },
                        { id: "session_allocation", label: "Session Allocation" },
                        { id: "ingest", label: "Student Onboarding" },
                        { id: "dispatch", label: "Email Dispatcher" },
                        { id: "audit", label: "Split Audit Center" },
                        { id: "seating", label: "Seating Allocation" },
                        { id: "print", label: "Certificate Generation" },
                        { id: "cert_layout", label: "Certificate Layout" },
                        { id: "registry", label: "Student Registry" },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id as any)}
                          className={`w-full text-left px-4 py-2 text-xs font-bold transition rounded-xl ${
                            activeTab === tab.id
                              ? "bg-blue-600 text-white shadow-lg shadow-blue-500/10"
                              : "bg-white dark:bg-slate-900/40 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-900"
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              /* Regular Staff - display only General Controls without accordion headers */
              <div className="flex flex-col gap-1.5">
                <div className="px-3 py-1.5 text-[10px] uppercase font-black tracking-wider text-slate-400 dark:text-slate-500">
                  General Controls
                </div>
                {[
                  { id: "degrees", label: "Course Manager" },
                  { id: "timeline", label: "Timeline Control" },
                  { id: "session_allocation", label: "Session Allocation" },
                  { id: "ingest", label: "Sudent Onboarding" },
                  { id: "dispatch", label: "Email Dispatcher" },
                  { id: "audit", label: "Split Audit Center" },
                  { id: "seating", label: "Seating Allocation" },
                  { id: "print", label: "Certificate Generation" },
                  { id: "registry", label: "Student Registry" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`w-full text-left px-4 py-2 text-xs font-bold transition rounded-xl ${
                      activeTab === tab.id
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-500/10"
                        : "bg-white dark:bg-slate-900/40 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-900"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800 pt-4 mt-auto space-y-3">
            <div className="flex items-center gap-3 px-2">
              <div className="h-8 w-8 rounded-full bg-blue-600/10 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs border border-blue-500/20">
                {staffUser?.name
                  ? staffUser.name
                      .split(" ")
                      .map((n: string) => n[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()
                  : "EC"}
              </div>
              <div>
                <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200 leading-none">
                  {staffUser?.name || "Exam Coordinator"}
                </div>
                <div className="text-[9px] text-slate-555 dark:text-slate-500 font-medium mt-1">
                  {staffUser?.role || "Exam Division Staff"}
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={handleLogout}
              className="w-full border-red-200 dark:border-red-950/40 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-655 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 rounded-xl text-xs font-bold gap-2 h-9"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </aside>

        {/* Right Side Main Workspaces */}
        <main className="flex-1 min-w-0 md:ml-72 p-8 space-y-6 bg-slate-50/50 dark:bg-slate-950/20">

          {/* 1. COURSE MANAGER WORKSPACE */}
          {activeTab === "degrees" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-6">
                {/* Table displaying Degrees */}
                <Card className="border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/30 backdrop-blur-md rounded-2xl shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between pb-4">
                    <div>
                      <CardTitle className="text-base font-bold text-slate-950 dark:text-white">
                        Degree Registry
                      </CardTitle>
                      <CardDescription className="text-[11px] text-slate-500">
                        Currently configured academic programs.
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {degreeStagingResults.length > 0 && (
                        <div className="flex items-center gap-1.5 mr-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg py-1 px-2.5">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${isDegreeBatchValid ? "bg-emerald-500" : "bg-red-500"}`}
                          />
                          <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 font-sans">
                            Staging ({degreeStagingResults.length} rows)
                          </span>
                          <Button
                            variant="link"
                            onClick={() => setShowDegreeStagingModal(true)}
                            className="p-0 text-[10px] h-auto font-bold text-blue-600 dark:text-blue-400 hover:underline ml-1"
                          >
                            Open Preview
                          </Button>
                        </div>
                      )}
                      <input
                        type="file"
                        id="degreeExcelUpload"
                        accept=".xlsx, .xls"
                        className="hidden"
                        onChange={handleImportDegreesExcel}
                      />
                      <Button
                        onClick={() =>
                          document.getElementById("degreeExcelUpload")?.click()
                        }
                        variant="outline"
                        className="border-slate-200 dark:border-slate-850 text-blue-650 hover:text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/20 text-xs font-bold h-8 rounded-lg px-3 flex items-center gap-1.5"
                      >
                        <Upload className="h-4 w-4" />
                        Import from Excel
                      </Button>
                      <Button
                        onClick={() => setShowAddDegreeModal(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-8 text-xs rounded-lg px-3 flex items-center gap-1.5 shadow"
                      >
                        <Plus className="h-4 w-4" />
                        Add Degree
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 overflow-hidden border-t border-slate-100 dark:border-slate-900">
                    <div className="flex flex-wrap items-center gap-3 p-4 bg-slate-50/50 dark:bg-slate-900/10 border-b border-slate-100 dark:border-slate-900">
                      <select
                        value={filterRegFaculty}
                        onChange={(e) => setFilterRegFaculty(e.target.value)}
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 text-xs text-slate-800 dark:text-slate-300 px-2.5 py-1.5 rounded-lg focus:outline-none h-8 font-bold"
                      >
                        <option value="">All Faculties</option>
                        {FACULTIES.map((fac) => (
                          <option key={fac} value={fac}>
                            {fac}
                          </option>
                        ))}
                      </select>
                      <select
                        value={filterRegType}
                        onChange={(e) => setFilterRegType(e.target.value)}
                        className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 text-xs text-slate-800 dark:text-slate-300 px-2.5 py-1.5 rounded-lg focus:outline-none h-8 font-bold"
                      >
                        <option value="">All Types</option>
                        <option value="Internal">Internal</option>
                        <option value="External">External</option>
                      </select>
                    </div>
                    <div className="border border-slate-200 dark:border-slate-900 rounded-xl overflow-hidden overflow-x-auto mx-4 my-4 ">
                    <Table className="text-xs">
                      <TableHeader className="bg-slate-100/50 dark:bg-slate-800">
                        <TableRow className="border-b border-slate-200 dark:border-slate-900">
                          <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-4 py-3">
                            Faculty
                          </TableHead>
                          <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-4 py-3">
                            No
                          </TableHead>
                          <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-4 py-3">
                            Name (English / Sinhala / Tamil)
                          </TableHead>
                          <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-4 py-3">
                            Type
                          </TableHead>
                          <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-4 py-3 text-right">
                            Action
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="divide-y divide-slate-100 dark:divide-slate-900 font-medium">
                        {filteredDegrees.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={5}
                              className="text-center py-8 text-slate-500"
                            >
                              No degrees registered or matching selected
                              filters.
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredDegrees.map((d) => (
                            <TableRow
                              key={d.id}
                              className="border-b border-slate-200 dark:border-slate-900 hover:bg-slate-100/30 dark:hover:bg-slate-900/10 transition-colors"
                            >
                              <TableCell className="px-4 py-2.5 text-slate-800 dark:text-white">
                                {d.faculty}
                              </TableCell>
                              <TableCell className="px-4 py-2.5 font-bold text-slate-900 dark:text-white">
                                {d.degree_no}
                              </TableCell>
                              <TableCell className="px-4 py-2.5 text-slate-800 dark:text-slate-300">
                                <div className="font-bold text-slate-900 dark:text-white">
                                  {d.name_en}
                                </div>
                                <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                                  {d.name_si} | {d.name_ta}
                                </div>
                              </TableCell>
                              <TableCell className="px-4 py-2.5">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    d.type === "Internal"
                                      ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20"
                                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20"
                                  }`}
                                >
                                  {d.type}
                                </span>
                              </TableCell>
                              <TableCell className="px-4 py-2.5 text-right flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEditClick(d)}
                                  className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/20 rounded-xl"
                                  title="Edit Degree details"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteDegree(d.id)}
                                  className="h-8 w-8 text-red-650 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl"
                                  title="Delete Degree"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* 2. BULK DATA INGESTION WORKSPACE */}
          {activeTab === "ingest" && (
            <div className="space-y-6">
              <Card className="border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/30 backdrop-blur-md rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base font-bold text-slate-950 dark:text-white">
                    Bulk Faculty Student Onboarding
                  </CardTitle>
                  <CardDescription className="text-[11px] text-slate-500">
                    Upload official Excel student registry list.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div className="space-y-1.5 col-span-1">
                      <Label
                        htmlFor="ingestFaculty"
                        className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400"
                      >
                        Target Faculty
                      </Label>
                      <select
                        id="ingestFaculty"
                        value={ingestFaculty}
                        onChange={(e) => setIngestFaculty(e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 text-xs text-slate-800 dark:text-white px-3 py-2.5 rounded-lg focus:outline-none h-10"
                      >
                        <option value="">Select Faculty</option>
                        {FACULTIES.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5 col-span-1">
                      <Label
                        htmlFor="ingestDegree"
                        className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400"
                      >
                        Target Degree
                      </Label>
                      <select
                        id="ingestDegree"
                        value={ingestDegreeId}
                        onChange={(e) => setIngestDegreeId(e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 text-xs text-slate-800 dark:text-white px-3 py-2.5 rounded-lg focus:outline-none h-10"
                      >
                        <option value="">Select Degree</option>
                        {ingestFaculty &&
                          degrees
                            .filter((d) => d.faculty === ingestFaculty)
                            .map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.name_en} ({d.type})
                              </option>
                            ))}
                      </select>
                    </div>

                    <div className="space-y-1.5 col-span-1">
                      <Label
                        htmlFor="excelFile"
                        className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400"
                      >
                        Select Excel / CSV Registry Sheet
                      </Label>
                      <Input
                        ref={fileInputRef}
                        id="excelFile"
                        type="file"
                        accept=".xlsx, .xls, .csv"
                        onChange={handleIngestFileChange}
                        disabled={loading || !ingestDegreeId}
                        className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 text-xs file:bg-blue-600/10 file:border-0 file:text-blue-600 dark:file:text-blue-500 file:text-xs file:font-semibold file:px-3 file:py-1.5 file:mr-3 rounded-lg cursor-pointer h-10 disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>

                  {/* Validation Staging Grid - Inline Normal View */}
                  {stagingResults.length > 0 && (
                    <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-900">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-550 dark:text-slate-400">
                          Staging Data details are loaded.
                        </span>
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

              {/* Imported Students Management Section */}
              <Card className="border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/30 backdrop-blur-md rounded-2xl shadow-sm mt-6">
                <CardHeader className="flex flex-row items-center justify-between pb-4">
                  <div>
                    <CardTitle className="text-base font-bold text-slate-950 dark:text-white">
                      Imported Registry Candidates
                    </CardTitle>
                    <CardDescription className="text-[11px] text-slate-500">
                      Manage and clean imported student records. Use bulk delete to undo wrong Excel ingestion sheets.
                    </CardDescription>
                  </div>
                  {selectedIngestStudents.length > 0 && (
                    <Button
                      onClick={handleBulkDeleteStudents}
                      className="bg-red-600 hover:bg-red-700 text-white font-bold h-9 text-xs rounded-lg px-4 shadow flex items-center gap-1.5"
                    >
                      <Trash2 className="h-4 w-4" />
                      Bulk Delete Selected ({selectedIngestStudents.length})
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="p-0 overflow-hidden border-t border-slate-100 dark:border-slate-900">
                  {/* Filters Row */}
                  <div className="flex flex-wrap items-center gap-3 p-4 bg-slate-50/50 dark:bg-slate-900/10 border-b border-slate-100 dark:border-slate-900">
                    <div className="w-full sm:w-56">
                      <select
                        value={ingestFacultyFilter}
                        onChange={(e) => {
                          setIngestFacultyFilter(e.target.value);
                          setIngestDegreeFilter("");
                        }}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 text-xs text-slate-800 dark:text-slate-100 px-3 py-1.5 rounded-lg focus:outline-none h-8 font-bold"
                      >
                        <option value="">All Faculties</option>
                        {FACULTIES.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="w-full sm:w-56">
                      <select
                        value={ingestDegreeFilter}
                        onChange={(e) => setIngestDegreeFilter(e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 text-xs text-slate-800 dark:text-slate-100 px-3 py-1.5 rounded-lg focus:outline-none h-8 font-bold"
                      >
                        <option value="">All Degrees</option>
                        {degrees
                          .filter((d) => !ingestFacultyFilter || d.faculty === ingestFacultyFilter)
                          .map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name_en} ({d.type})
                            </option>
                          ))}
                      </select>
                    </div>

                    <div className="w-full sm:w-64 relative">
                      <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-450" />
                      <Input
                        value={ingestSearchIndex}
                        onChange={(e) => setIngestSearchIndex(e.target.value)}
                        placeholder="Search by reg, index, name..."
                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 text-slate-850 dark:text-slate-100 text-xs rounded-lg pl-9 h-8 placeholder-slate-400 dark:placeholder-slate-600"
                      />
                    </div>

                    {(ingestFacultyFilter || ingestDegreeFilter || ingestSearchIndex) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setIngestFacultyFilter("");
                          setIngestDegreeFilter("");
                          setIngestSearchIndex("");
                        }}
                        className="text-slate-500 hover:text-slate-700 text-xs h-8 px-2 font-semibold"
                      >
                        Clear Filters
                      </Button>
                    )}
                  </div>

                  {/* Students Table */}
                  <div className="border border-slate-200 dark:border-slate-900 rounded-xl overflow-hidden overflow-x-auto mx-4 my-4 ">
                  <div className="overflow-x-auto">
                    <Table className="w-full min-w-[800px] border-collapse text-left">
                      <TableHeader className="bg-slate-100/50 dark:bg-slate-800">
                        <TableRow className="border-b border-slate-100 dark:border-slate-900">
                          <TableHead className="w-10 px-4 py-3">
                            <input
                              type="checkbox"
                              checked={
                                filteredIngestStudents.length > 0 &&
                                filteredIngestStudents.every((s) => selectedIngestStudents.includes(s.id))
                              }
                              onChange={(e) => {
                                if (e.target.checked) {
                                  const allIds = filteredIngestStudents.map((s) => s.id);
                                  setSelectedIngestStudents(Array.from(new Set([...selectedIngestStudents, ...allIds])));
                                } else {
                                  const allIds = filteredIngestStudents.map((s) => s.id);
                                  setSelectedIngestStudents(selectedIngestStudents.filter((id) => !allIds.includes(id)));
                                }
                              }}
                              className="rounded border-slate-300 dark:border-slate-800 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer"
                            />
                          </TableHead>
                                                    <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-4 py-3 text-xs w-48">
                            Registration & Index No
                          </TableHead>
                          <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-4 py-3 text-xs">
                            Full Name & NIC
                          </TableHead>
                          <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-4 py-3 text-xs">
                            Email & Contact
                          </TableHead>
                          <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-4 py-3 text-xs w-48">
                            Faculty & Degree
                          </TableHead>
                          <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-4 py-3 text-xs text-center">
                            GPA & Class
                          </TableHead>
                          <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-4 py-3 text-xs">
                            Address
                          </TableHead>
                          <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-4 py-3 text-xs">
                            Dates
                          </TableHead>
                          <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-4 py-3 text-xs w-20 text-center">
                            Action
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredIngestStudents.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={9} className="text-center py-8 text-slate-400 dark:text-slate-500 italic text-xs">
                              No imported student records found matching the filters.
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredIngestStudents.map((st) => (
                            <TableRow key={st.id} className="border-b border-slate-100 dark:border-slate-900/60 hover:bg-slate-50/50 dark:hover:bg-slate-900/10">
                              <TableCell className="px-4 py-3">
                                <input
                                  type="checkbox"
                                  checked={selectedIngestStudents.includes(st.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedIngestStudents([...selectedIngestStudents, st.id]);
                                    } else {
                                      setSelectedIngestStudents(selectedIngestStudents.filter((id) => id !== st.id));
                                    }
                                  }}
                                  className="rounded border-slate-300 dark:border-slate-800 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer"
                                />
                              </TableCell>
                              <TableCell className="px-4 py-3 font-mono text-xs">
                                <div className="font-bold text-slate-850 dark:text-white">
                                  {st.registration_no}
                                </div>
                                <div className="text-[10px] text-slate-500 dark:text-slate-500 mt-0.5">
                                  {st.index_no || '-'}
                                </div>
                              </TableCell>
                              <TableCell className="px-4 py-3 text-xs">
                                <div className="font-bold text-slate-850 dark:text-white">
                                  {st.name_with_initials}
                                </div>
                                <div className="text-[10px] text-slate-500 dark:text-slate-500 font-mono mt-0.5">
                                  NIC: {st.nic_no}
                                </div>
                              </TableCell>
                              <TableCell className="px-4 py-3 text-xs">
                                <div className="text-slate-800 dark:text-slate-350 font-medium">{st.email}</div>
                                <div className="text-[10px] text-slate-500 mt-0.5">{st.contact_no}</div>
                              </TableCell>
                              <TableCell className="px-4 py-3 text-xs">
                                <div className="font-semibold text-slate-800 dark:text-slate-300">{st.faculty}</div>
                                <div className="text-[10px] text-slate-500 mt-0.5">{st.degree_name_en}</div>
                              </TableCell>
                              <TableCell className="px-4 py-3 text-xs text-center">
                                <div className="font-bold text-slate-800 dark:text-slate-200">GPA: {st.gpa !== null && st.gpa !== undefined ? st.gpa : '-'}</div>
                                <div className="text-[10px] text-slate-500 mt-0.5">{st.class || '-'}</div>
                              </TableCell>
                              <TableCell className="px-4 py-3 text-xs max-w-[200px] truncate" title={st.address}>
                                {st.address}
                              </TableCell>
                              <TableCell className="px-4 py-3 text-xs whitespace-nowrap">
                                <div className="text-[10px] text-slate-600 dark:text-slate-400">
                                  <span className="font-semibold">Eff:</span> {st.effective_date ? st.effective_date.split('T')[0] : '-'}
                                </div>
                                <div className="text-[10px] text-slate-500 mt-0.5">
                                  <span className="font-semibold">Grad:</span> {st.graduation_date ? st.graduation_date.split('T')[0] : '-'}
                                </div>
                              </TableCell>
                              <TableCell className="px-4 py-3 text-center">
                                <Button
                                  variant="ghost"
                                  size="xs"
                                  onClick={() => handleDeleteStudent(st.id)}
                                  className="text-red-500 hover:text-red-750 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50/50 dark:hover:bg-red-950/20 font-bold"
                                >
                                  Delete
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* EMAIL DISPATCHER WORKSPACE */}
          {activeTab === "dispatch" && (
            <div className="space-y-6">
              <Card className="border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/30 backdrop-blur-md rounded-2xl shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-4">
                  <div>
                    <CardTitle className="text-base font-bold text-slate-950 dark:text-white">
                      Email Dispatcher
                    </CardTitle>
                    <CardDescription className="text-[11px] text-slate-500">
                      {dispatchType === "confirmation"
                        ? "Manually send graduation seat and session confirmation details to approved candidates."
                        : "Manually send onboarding magic link access emails to candidates (Daily limit: 300)."}
                    </CardDescription>
                  </div>
                  <Button
                    onClick={handleDispatchEmails}
                    disabled={
                      loading || selectedDispatcherStudents.length === 0
                    }
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-9 text-xs rounded-lg px-4 shadow flex items-center gap-1.5"
                  >
                    <Mail className="h-4 w-4" />
                    Dispatch Emails ({selectedDispatcherStudents.length}{" "}
                    selected)
                  </Button>
                </CardHeader>
                <CardContent className="p-0 overflow-hidden border-t border-slate-100 dark:border-slate-900">
                  <div className="p-4 pb-0">
                    <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl w-fit">
                      <button
                        onClick={() => setDispatchType("onboarding")}
                        type="button"
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          dispatchType === "onboarding"
                            ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                            : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                        }`}
                      >
                        Portal Access Details 
                      </button>
                      <button
                        onClick={() => setDispatchType("confirmation")}
                        type="button"
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          dispatchType === "confirmation"
                            ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                            : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                        }`}
                      >
                        Seat Confirmation Details
                      </button>
                      <button
                        onClick={() => setDispatchType("in_absentia")}
                        type="button"
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          dispatchType === "in_absentia"
                            ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                            : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                        }`}
                      >
                        In Absentia Emails
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 p-4 bg-slate-50/50 dark:bg-slate-900/10 border-b border-slate-100 dark:border-slate-900 mt-4">
                    <select
                      value={dispatchFacultyFilter}
                      onChange={(e) => {
                        setDispatchFacultyFilter(e.target.value);
                        setDispatchDegreeFilter("");
                      }}
                      className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 text-xs text-slate-800 dark:text-slate-300 px-2.5 py-1.5 rounded-lg focus:outline-none h-8 font-bold"
                    >
                      <option value="">All Faculties</option>
                      {FACULTIES.map((fac) => (
                        <option key={fac} value={fac}>
                          {fac}
                        </option>
                      ))}
                    </select>

                    <select
                      value={dispatchDegreeFilter}
                      onChange={(e) => setDispatchDegreeFilter(e.target.value)}
                      className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 text-xs text-slate-800 dark:text-slate-300 px-2.5 py-1.5 rounded-lg focus:outline-none h-8 font-bold"
                    >
                      <option value="">All Degrees</option>
                      {degrees
                        .filter((d) => !dispatchFacultyFilter || d.faculty === dispatchFacultyFilter)
                        .map((deg) => (
                          <option key={deg.id} value={deg.id}>
                            {deg.name_en || deg.code}
                          </option>
                        ))}
                    </select>

                    <div className="w-full sm:w-60 relative">
                      <Search className="absolute left-2.5 top-2.5 h-3 w-3 text-slate-450" />
                      <Input
                        value={dispatchSearchRegNo}
                        onChange={(e) => setDispatchSearchRegNo(e.target.value)}
                        placeholder="Search by name or reg no..."
                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 text-slate-850 dark:text-slate-100 text-xs rounded-lg pl-8 h-8 placeholder-slate-400 dark:placeholder-slate-600"
                      />
                    </div>

                    <select
                      value={dispatchStatusFilter}
                      onChange={(e) => setDispatchStatusFilter(e.target.value as any)}
                      className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 text-xs text-slate-800 dark:text-slate-300 px-2.5 py-1.5 rounded-lg focus:outline-none h-8 font-bold"
                    >
                      <option value="">All Statuses</option>
                      <option value="Sent">Sent</option>
                      <option value="Pending">Pending</option>
                    </select>

                    <Button
                      variant="outline"
                      onClick={() => {
                        const filtered = visibleDispatcherStudents.map((s) => s.id);
                        setSelectedDispatcherStudents(filtered);
                      }}
                      className="border-slate-200 dark:border-slate-850 text-slate-700 hover:text-slate-900 dark:text-slate-300 text-[10px] font-bold h-8 rounded-lg px-2.5"
                    >
                      Select All Filtered
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => setSelectedDispatcherStudents([])}
                      className="border-slate-200 dark:border-slate-850 text-slate-700 hover:text-slate-900 dark:text-slate-300 text-[10px] font-bold h-8 rounded-lg px-2.5"
                    >
                      Deselect All
                    </Button>
                  </div>
                  
                  <div className="border border-slate-200 dark:border-slate-900 rounded-xl overflow-hidden overflow-x-auto mx-4 my-4 ">
                  <div className="overflow-x-auto">
                    <Table className="text-xs">
                      <TableHeader className="bg-slate-100/50 dark:bg-slate-800">
                        <TableRow className="border-b border-slate-200 dark:border-slate-900">
                          <TableHead className="w-12 text-center px-4 py-3 font-bold">
                            Select
                          </TableHead>
                          <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-4 py-3">
                            Student Name
                          </TableHead>
                          <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-4 py-3">
                            Registration No
                          </TableHead>
                          <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-4 py-3">
                            Faculty
                          </TableHead>
                          <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-4 py-3">
                            {dispatchType === "confirmation"
                              ? "Seating Info"
                              : dispatchType === "in_absentia"
                              ? "Session Details"
                              : "Email Address"}
                          </TableHead>
                          <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-4 py-3">
                            Status
                          </TableHead>
                          {dispatchType === "onboarding" && (
                            <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-4 py-3 text-center w-40">
                              Timeline Bypass
                            </TableHead>
                          )}
                          {dispatchType !== "onboarding" && (
                            <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-4 py-3 text-right">
                              Certificate No
                            </TableHead>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody className="divide-y divide-slate-100 dark:divide-slate-900 font-medium">
                        {visibleDispatcherStudents.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={7}
                              className="text-center py-8 text-slate-500 italic"
                            >
                              No students found matching current filters.
                            </TableCell>
                          </TableRow>
                        ) : (
                          visibleDispatcherStudents.map((student) => {
                            const isChecked =
                              selectedDispatcherStudents.includes(student.id);
                            const magicLink = student.magic_token
                              ? `${window.location.origin}/api/student/auth/magic-login?email=${encodeURIComponent(student.email.toLowerCase().trim())}&token=${encodeURIComponent(student.magic_token)}`
                              : "";

                            return (
                              <TableRow
                                key={student.id}
                                className="border-b border-slate-200 dark:border-slate-900 hover:bg-slate-100/30 dark:hover:bg-slate-900/10 transition-colors"
                              >
                                <TableCell className="px-4 py-2.5 text-center">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedDispatcherStudents(
                                          (prev) => [...prev, student.id],
                                        );
                                      } else {
                                        setSelectedDispatcherStudents(
                                          (prev) =>
                                            prev.filter(
                                              (id) => id !== student.id,
                                            ),
                                        );
                                      }
                                    }}
                                    className="rounded border-slate-300 dark:border-slate-800 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer"
                                  />
                                </TableCell>
                                <TableCell className="px-4 py-2.5 text-slate-800 dark:text-white font-bold">
                                  {student.name_with_initials}
                                </TableCell>
                                <TableCell className="px-4 py-2.5 text-slate-900 dark:text-white font-mono">
                                  {student.registration_no}
                                </TableCell>
                                <TableCell className="px-4 py-2.5 text-slate-550 dark:text-slate-400">
                                  {student.faculty}
                                </TableCell>
                                <TableCell className="px-4 py-2.5 text-slate-550 dark:text-slate-400 font-mono">
                                  {dispatchType === "confirmation"
                                    ? `Session ${student.session_number} | Seat ${student.seat_number}`
                                    : dispatchType === "in_absentia"
                                    ? `Session ${student.session_number} | In Absentia`
                                    : student.email}
                                </TableCell>
                                <TableCell className="px-4 py-2.5">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                      (dispatchType === "onboarding" ? student.email_sent : student.confirmation_email_sent)
                                        ? "bg-emerald-500/10 text-emerald-650 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20"
                                        : "bg-amber-500/10 text-amber-650 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20"
                                    }`}
                                  >
                                    {(dispatchType === "onboarding" ? student.email_sent : student.confirmation_email_sent)
                                      ? "Sent"
                                      : "Pending"}
                                  </span>
                                </TableCell>
                                {dispatchType === "onboarding" && (
                                  <TableCell className="px-4 py-2.5 text-center">
                                    <div className="flex items-center justify-center gap-1.5">
                                      <span
                                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                          student.timeline_bypass
                                            ? "bg-purple-500/10 text-purple-650 dark:text-purple-400 border border-purple-250/20"
                                            : "bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800"
                                        }`}
                                      >
                                        {student.timeline_bypass ? "Bypass Active" : "No Bypass"}
                                      </span>
                                      <Button
                                        variant="ghost"
                                        size="xs"
                                        onClick={async () => {
                                          const nextBypass = !student.timeline_bypass;
                                          try {
                                            const res = await fetch("/api/admin/review", {
                                              method: "POST",
                                              headers: { "Content-Type": "application/json" },
                                              body: JSON.stringify({
                                                studentId: student.id,
                                                action: "toggle_bypass",
                                                bypassState: nextBypass,
                                              }),
                                            });
                                            if (res.ok) {
                                              triggerAlert(
                                                true,
                                                nextBypass
                                                  ? "Bypass granted. Candidate can register even when portal is closed."
                                                  : "Bypass revoked."
                                              );
                                              loadDispatcherStudents();
                                            } else {
                                              const json = await res.json();
                                              triggerAlert(false, json.error || "Failed to update bypass.");
                                            }
                                          } catch {
                                            triggerAlert(false, "Connection error.");
                                          }
                                        }}
                                        className="h-6 text-[10px] px-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded"
                                      >
                                        {student.timeline_bypass ? "Revoke" : "Grant"}
                                      </Button>
                                    </div>
                                  </TableCell>
                                )}
                                {dispatchType !== "onboarding" && (
                                  <TableCell className="px-4 py-2.5 text-right font-mono">
                                    <span className="font-bold text-blue-600 dark:text-blue-400 text-xs">
                                      {student.certificate_number}
                                    </span>
                                  </TableCell>
                                )}
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* EMAIL CONFIGURATIONS WORKSPACE */}
          {activeTab === "email_templates" &&
            staffUser?.role === "Administrator" && (
              <div className="space-y-6">
                <Card className="border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/30 backdrop-blur-md rounded-2xl shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base font-bold text-slate-950 dark:text-white">
                      Email Configuration Editor
                    </CardTitle>
                    <CardDescription className="text-[11px] text-slate-500">
                      Customize subject lines and responsive HTML templates for
                      all system notifications with dynamic live preview.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                      {/* Left Column: Selector & Settings */}
                      <div className="lg:col-span-4 space-y-5 border-r border-slate-100 dark:border-slate-900 pr-6 flex flex-col justify-between">
                        <div className="space-y-5">
                          <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">
                              Select Template Key
                            </Label>
                            <div className="flex flex-col gap-2">
                              {[
                                {
                                  key: "magic_link",
                                  label: "Registration Open (Onboarding)",
                                  desc: "Sent manually via Onboarding Dispatcher.",
                                },
                                {
                                  key: "rejection",
                                  label: "Correction Required (Rejection)",
                                  desc: "Sent when coordinators reject name/slips.",
                                },
                                {
                                  key: "confirmation",
                                  label: "Seat Confirmation Details",
                                  desc: "Sent after seating and session allocations.",
                                },
                                {
                                  key: "in_absentia",
                                  label: "In Absentia Notification",
                                  desc: "Sent manually to in-absentia candidates.",
                                },
                              ].map((t) => (
                                <button
                                  key={t.key}
                                  type="button"
                                  onClick={() =>
                                    setSelectedTemplateKey(t.key as any)
                                  }
                                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                                    selectedTemplateKey === t.key
                                      ? "bg-blue-600 text-white border-blue-600 shadow-md"
                                      : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-900 hover:bg-slate-50 dark:hover:bg-slate-900"
                                  }`}
                                >
                                  <div className="text-xs font-bold">
                                    {t.label}
                                  </div>
                                  <div
                                    className={`text-[9px] mt-1 ${
                                      selectedTemplateKey === t.key
                                        ? "text-blue-100"
                                        : "text-slate-500"
                                    }`}
                                  >
                                    {t.desc}
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>

                          <form onSubmit={handleUpdateTemplate} className="space-y-4">
                            <div className="space-y-1.5">
                              <Label
                                htmlFor="templateSubject"
                                className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400"
                              >
                                Email Subject Line
                              </Label>
                              <Input
                                id="templateSubject"
                                required
                                value={templateSubject}
                                onChange={(e) =>
                                  setTemplateSubject(e.target.value)
                                }
                                placeholder="e.g. Action Required: Verification Code"
                                className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-900 text-slate-900 dark:text-slate-100 text-xs rounded-lg h-9"
                              />
                            </div>

                            <Button
                              type="submit"
                              disabled={loading}
                              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-9 text-xs rounded-lg shadow flex items-center justify-center gap-1.5"
                            >
                              {loading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                "Save Template"
                              )}
                            </Button>
                          </form>
                        </div>

                        <div className="bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-400 p-4 rounded-xl text-[11px] space-y-1.5 mt-4">
                          <div className="font-bold uppercase tracking-wider">
                            Interactive Visual Editing
                          </div>
                          <div>
                            Click directly on any text inside the live preview on the right to edit the content. 
                            Your changes will be saved to the email body template.
                          </div>
                        </div>
                      </div>

                      {/* Right Column: Simulated Live Preview Frame */}
                      <div className="lg:col-span-8 space-y-1.5">
                        <Label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">
                          Email Preview Editor
                        </Label>
                                                <div className="w-full border border-slate-200 dark:border-slate-900 rounded-xl overflow-hidden bg-white h-[550px] flex flex-col shadow-inner">
                          <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-red-450" />
                              <span className="w-2.5 h-2.5 rounded-full bg-yellow-450" />
                              <span className="w-2.5 h-2.5 rounded-full bg-green-450" />
                            </div>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 py-1.5 flex flex-wrap items-center gap-1">
                            {/* Text Formatting */}
                            <button
                              type="button"
                              onClick={() => execEditorCommand("bold")}
                              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-700 dark:text-slate-300 font-bold text-xs min-w-6 h-6 flex items-center justify-center border border-slate-300 dark:border-slate-700"
                              title="Bold"
                            >
                              B
                            </button>
                            <button
                              type="button"
                              onClick={() => execEditorCommand("italic")}
                              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-700 dark:text-slate-300 italic text-xs min-w-6 h-6 flex items-center justify-center border border-slate-300 dark:border-slate-700"
                              title="Italic"
                            >
                              I
                            </button>
                            <button
                              type="button"
                              onClick={() => execEditorCommand("underline")}
                              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-700 dark:text-slate-300 underline text-xs min-w-6 h-6 flex items-center justify-center border border-slate-300 dark:border-slate-700"
                              title="Underline"
                            >
                              U
                            </button>
                            <span className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1" />
                            
                            {/* Color Picker */}
                            <div className="flex items-center gap-1">
                              <input
                                type="color"
                                onChange={(e) => execEditorCommand("foreColor", e.target.value)}
                                className="w-6 h-6 p-0 border border-slate-300 dark:border-slate-700 rounded cursor-pointer"
                                title="Text Color"
                              />
                            </div>
                            <span className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1" />

                            {/* Sub/Super */}
                            <button
                              type="button"
                              onClick={() => execEditorCommand("superscript")}
                              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-700 dark:text-slate-300 text-[10px] min-w-6 h-6 flex items-center justify-center border border-slate-300 dark:border-slate-700"
                              title="Superscript"
                            >
                              X<sup>2</sup>
                            </button>
                            <button
                              type="button"
                              onClick={() => execEditorCommand("subscript")}
                              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-700 dark:text-slate-300 text-[10px] min-w-6 h-6 flex items-center justify-center border border-slate-300 dark:border-slate-700"
                              title="Subscript"
                            >
                              X<sub>2</sub>
                            </button>
                            <span className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1" />

                            {/* Font Size Dropdown */}
                            <select
                              onChange={(e) => execEditorCommand("fontSize", e.target.value)}
                              className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-xs px-1.5 py-0.5 h-6 text-slate-700 dark:text-slate-300 focus:outline-none"
                              title="Font Size"
                              defaultValue="3"
                            >
                              <option value="1">Extra Small</option>
                              <option value="2">Small</option>
                              <option value="3">Normal</option>
                              <option value="4">Medium</option>
                              <option value="5">Large</option>
                              <option value="6">Extra Large</option>
                              <option value="7">Huge</option>
                            </select>
                            <span className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1" />

                            {/* Alignments */}
                            <button
                              type="button"
                              onClick={() => execEditorCommand("justifyLeft")}
                              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-700 dark:text-slate-300 text-xs min-w-6 h-6 flex items-center justify-center border border-slate-300 dark:border-slate-700"
                              title="Align Left"
                            >
                              ⎹═
                            </button>
                            <button
                              type="button"
                              onClick={() => execEditorCommand("justifyCenter")}
                              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-700 dark:text-slate-300 text-xs min-w-6 h-6 flex items-center justify-center border border-slate-300 dark:border-slate-700"
                              title="Align Center"
                            >
                              ═
                            </button>
                            <button
                              type="button"
                              onClick={() => execEditorCommand("justifyRight")}
                              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-700 dark:text-slate-300 text-xs min-w-6 h-6 flex items-center justify-center border border-slate-300 dark:border-slate-700"
                              title="Align Right"
                            >
                              ═⎹
                            </button>
                            <button
                              type="button"
                              onClick={() => execEditorCommand("justifyFull")}
                              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-700 dark:text-slate-300 text-xs min-w-6 h-6 flex items-center justify-center border border-slate-300 dark:border-slate-700"
                              title="Justify"
                            >
                              𝌆
                            </button>
                            <span className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1" />

                            {/* Lists */}
                            <button
                              type="button"
                              onClick={() => execEditorCommand("insertUnorderedList")}
                              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-700 dark:text-slate-300 text-xs min-w-6 h-6 flex items-center justify-center border border-slate-300 dark:border-slate-700"
                              title="Bullet List"
                            >
                              •=
                            </button>
                            <button
                              type="button"
                              onClick={() => execEditorCommand("insertOrderedList")}
                              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-700 dark:text-slate-300 text-xs min-w-6 h-6 flex items-center justify-center border border-slate-300 dark:border-slate-700"
                              title="Numbered List"
                            >
                              1=
                            </button>
                          </div>
                          <iframe
                            ref={iframeRef}
                            title="Email Live Preview"
                            srcDoc={initialTemplateBody}
                            onLoad={handleIframeLoad}
                            className="w-full flex-1 border-0 bg-white"
                            sandbox="allow-same-origin"
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

          {/* 3. TIMELINE & WINDOW CONTROL WORKSPACE */}
          {activeTab === "timeline" && (
            <div className="space-y-6">
              {/* Active Session Transition */}
              <Card className="border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/30 backdrop-blur-md rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base font-bold text-slate-950 dark:text-white flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-500" />
                    Active Convocation Year:{" "}
                    <span className="bg-blue-600/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded text-sm font-black">
                      {activeConvocationYear}
                    </span>
                  </CardTitle>
                  <CardDescription className="text-[11px] text-slate-555">
                    Staff can transition the active convocation to a new
                    academic year to start a new graduation process, archiving
                    the previous cohort.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form
                    onSubmit={handleTransitionActiveSession}
                    className="space-y-4"
                  >
                    <div className="max-w-xs space-y-1.5">
                      <Label
                        htmlFor="transitionYear"
                        className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400"
                      >
                        New Convocation Year
                      </Label>
                      <div className="flex gap-2">
                        <select
                          id="transitionYear"
                          required
                          value={transitionYear}
                          onChange={(e) => setTransitionYear(e.target.value)}
                          className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 text-xs text-slate-800 dark:text-white px-3 py-2 rounded-lg focus:outline-none h-9 flex-1 font-bold"
                        >
                          <option value="">Select Year</option>
                          {yearOptions.map((y) => (
                            <option key={y} value={y}>
                              {y}
                            </option>
                          ))}
                        </select>
                        <Button
                          type="submit"
                          disabled={loading || !transitionYear}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-9 text-xs rounded-lg px-4 shadow shrink-0"
                        >
                          {loading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Set Active Year"
                          )}
                        </Button>
                      </div>
                    </div>
                  </form>
                </CardContent>
              </Card>

              <Card className="border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/30 backdrop-blur-md rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base font-bold text-slate-950 dark:text-white">
                    System Access Timeline
                  </CardTitle>
                  <CardDescription className="text-[11px] text-slate-500">
                    Configure global calendar and clock datetime bounds for
                    student access.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <form onSubmit={handleSaveTimeline} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label
                          htmlFor="openDate"
                          className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block"
                        >
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
                        <Label
                          htmlFor="closeDate"
                          className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block"
                        >
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
                        Date Window Check:{" "}
                        {timelineConfig &&
                        new Date() >= new Date(timelineConfig.open_date) &&
                        new Date() <= new Date(timelineConfig.close_date) &&
                        !isManuallyClosed ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                            Active / Open
                          </span>
                        ) : (
                          <span className="text-red-600 dark:text-red-400 font-bold">
                            Inactive / Closed
                          </span>
                        )}
                      </div>
                      <Button
                        type="submit"
                        disabled={loading}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-10 rounded-xl px-6 text-xs transition"
                      >
                        {loading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Save Date Settings"
                        )}
                      </Button>
                    </div>
                  </form>

                  {/* Emergency Manual Override Portal Open/Close Toggle Button */}
                  <div className="p-4 bg-slate-100 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-slate-950 dark:text-white block">
                        Manual Emergency Toggle
                      </span>
                      <span className="text-[10px] text-slate-500 block leading-tight">
                        Instantly open or lock the portal, bypassing the date
                        schedule settings.
                      </span>
                    </div>
                    <Button
                      type="button"
                      disabled={loading}
                      onClick={async () => {
                        const nextState = !isManuallyClosed;
                        setIsManuallyClosed(nextState);
                        setLoading(true);
                        try {
                          const res = await fetch("/api/timeline", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              toggle_only: true,
                              is_manually_closed: nextState,
                            }),
                          });
                          if (res.ok) {
                            const json = await res.json();
                            setTimelineConfig(json.data);
                            triggerAlert(
                              true,
                              nextState
                                ? "Emergency override active: Portal manual close triggered."
                                : "Override disabled: Resumed standard date timeline schedule.",
                            );
                          }
                        } catch {
                          triggerAlert(
                            false,
                            "Override toggling connection error.",
                          );
                        } finally {
                          setLoading(false);
                        }
                      }}
                      className={`font-bold text-xs h-10 px-5 rounded-xl transition ${
                        isManuallyClosed
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow shadow-emerald-500/20"
                          : "bg-red-600 hover:bg-red-700 text-white shadow shadow-red-500/20"
                      }`}
                    >
                      {isManuallyClosed
                        ? "Emergency Open (Resume Dates)"
                        : "Emergency Close Instantly"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* 4. SPLIT AUDIT CENTER WORKSPACE */}
          {activeTab === "audit" && (
            <div className="space-y-6">
              {/* Audit grid filters */}
              <div className="flex flex-col sm:flex-row gap-4 items-center flex-wrap">
                <select
                  value={filterFaculty}
                  onChange={(e) => setFilterFaculty(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-900 text-xs text-slate-800 dark:text-slate-300 px-3 py-2 rounded-xl focus:outline-none h-9"
                >
                  <option value="">All Faculties</option>
                  {FACULTIES.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-900 text-xs text-slate-800 dark:text-slate-300 px-3 py-2 rounded-xl focus:outline-none h-9"
                >
                  <option value="">All Verification Statuses</option>
                  <option value="Pending Verification">
                    Pending Verification
                  </option>
                  <option value="Approved">Approved</option>
                  <option value="Name Correction Requested">
                    Name Correction Requested
                  </option>
                </select>

                <select
                  value={filterAttending}
                  onChange={(e) => setFilterAttending(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-900 text-xs text-slate-800 dark:text-slate-300 px-3 py-2 rounded-xl focus:outline-none h-9"
                >
                  <option value="">All Attendance</option>
                  <option value="true">Attending Convocation</option>
                  <option value="false">Not Attending (In Absentia)</option>
                </select>

                <select
                  value={filterResponseStatus}
                  onChange={(e) => setFilterResponseStatus(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-900 text-xs text-slate-800 dark:text-slate-300 px-3 py-2 rounded-xl focus:outline-none h-9"
                >
                  <option value="all">All Candidates</option>
                  <option value="pending">Pending Responses</option>
                  <option value="submitted">Responses Submitted</option>
                </select>

                {/* Clear All Filters Button */}
                {(filterFaculty !== "" ||
                  filterStatus !== "" ||
                  filterAttending !== "" ||
                  filterResponseStatus !== "all") && (
                  <Button
                    onClick={() => {
                      setFilterFaculty("");
                      setFilterStatus("");
                      setFilterAttending("");
                      setFilterResponseStatus("all");
                    }}
                    variant="outline"
                    className="border-slate-200 dark:border-slate-850 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-xl text-xs font-semibold h-9 px-3 flex items-center gap-1.5"
                  >
                    Clear Filters
                  </Button>
                )}
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
                      <CardTitle className="text-sm font-bold text-slate-950 dark:text-white tracking-wider">
                        Candidate Registry
                      </CardTitle>
                      <CardDescription className="text-[10px] text-slate-500 mt-0.5">
                            List of all students who recieved registration emails.
                          </CardDescription>
                    </CardHeader>
                    <CardContent className="p-2 space-y-1">
                      {students.map((st) => (
                        <div
                          key={st.id}
                          onClick={() => setSelectedStudent(st)}
                          className={`p-3 rounded-xl cursor-pointer transition text-left flex flex-col gap-1 border ${
                            selectedStudent?.id === st.id
                              ? "bg-blue-600/10 border-blue-500 text-slate-900 dark:text-white"
                              : "bg-slate-50/50 dark:bg-slate-950/20 border-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-slate-900/40 hover:text-slate-900 dark:hover:text-slate-200"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold">
                              {st.name_with_initials}
                            </span>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${
                                  st.attendance_confirmed
                                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                    : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                }`}
                              >
                                {st.attendance_confirmed
                                  ? "Submitted"
                                  : "Pending"}
                              </span>
                              <span
                                className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${
                                  st.verification_status === "Approved"
                                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                    : st.verification_status ===
                                        "Name Correction Requested"
                                      ? "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400"
                                      : "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                                }`}
                              >
                                {st.verification_status ===
                                "Pending Verification"
                                  ? "Pending"
                                  : st.verification_status === "Approved"
                                    ? "Approved"
                                    : "Correction"}
                              </span>
                            </div>
                          </div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                            {st.registration_no}
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
                          <CardTitle className="text-sm font-bold text-slate-950 dark:text-white tracking-wider">
                            Split-Screen Audit Console
                          </CardTitle>
                          <CardDescription className="text-[10px] text-slate-500 mt-0.5">
                            Compare faculty data against student submitted
                            corrections.
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          {selectedStudent.verification_status === "Approved" ? (
                            <Button
                              onClick={handleRevokeStudent}
                              disabled={loading || !selectedStudent.attendance_confirmed}
                              className="bg-red-600 hover:bg-red-900 text-white font-bold h-8 text-[10px] px-3.5 rounded-lg flex items-center gap-1 shadow disabled:opacity-50"
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                              Revoke Approval
                            </Button>
                          ) : (
                            <>
                              <Button
                                onClick={handleApproveStudent}
                                disabled={
                                  loading ||
                                  !selectedStudent.attendance_confirmed
                                }
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-8 text-[10px] px-3.5 rounded-lg flex items-center gap-1 disabled:opacity-50"
                                title={!selectedStudent.attendance_confirmed ? "Cannot approve student who has not filled and submitted their profile details." : ""}
                              >
                                <Check className="h-3.5 w-3.5" />
                                Approve
                              </Button>
                              <Button
                                onClick={() => setShowRejectDialog(true)}
                                disabled={loading || !selectedStudent.attendance_confirmed}
                                className="bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-red-600 dark:text-red-400 border border-slate-200 dark:border-slate-855 font-bold h-8 text-[10px] px-3.5 rounded-lg flex items-center gap-1 disabled:opacity-50"
                              >
                                <X className="h-3.5 w-3.5" />
                                Reject & Unlock
                              </Button>
                            </>
                          )}
                        </div>
                      </CardHeader>

                      <CardContent className="p-4">
                        {!selectedStudent.attendance_confirmed && (
                          <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 text-amber-750 dark:text-amber-400 rounded-xl text-[11px] font-bold flex items-center gap-2">
                            <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-450" />
                            This candidate has not filled or submitted their registration details yet. Approval is disabled.
                          </div>
                        )}
                        <div className="grid grid-cols-2 divide-x divide-slate-200 dark:divide-slate-900">
                          {/* LEFT: Faculty Registry */}
                          <div className="pr-4 space-y-4">
                            <h4 className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                              Original Faculty Import
                            </h4>

                            <div className="space-y-1">
                              <span className="text-[9px] text-slate-400 dark:text-slate-600 font-bold block">
                                FULL NAME
                              </span>
                              <span className="text-xs font-semibold text-slate-800 dark:text-slate-300 block">
                                {selectedStudent.full_name}
                              </span>
                            </div>

                            <div className="space-y-1">
                              <span className="text-[9px] text-slate-400 dark:text-slate-600 font-bold block">
                                DEGREE
                              </span>
                              <span className="text-xs font-semibold text-slate-800 dark:text-slate-300 block">
                                {selectedStudent.degree_name_en || "N/A"}
                              </span>
                            </div>

                            <div className="space-y-1">
                              <span className="text-[9px] text-slate-400 dark:text-slate-600 font-bold block">
                                GPA
                              </span>
                              <span className="text-xs font-semibold text-slate-800 dark:text-slate-300 block">
                                {selectedStudent.gpa !== null && selectedStudent.gpa !== undefined ? selectedStudent.gpa : "-"}
                              </span>
                            </div>

                            <div className="space-y-1">
                              <span className="text-[9px] text-slate-400 dark:text-slate-600 font-bold block">
                                DEGREE CLASSIFICATION
                              </span>
                              <span className="text-xs font-semibold text-slate-800 dark:text-slate-300 block">
                                {selectedStudent.class}
                              </span>
                            </div>
                          </div>

                          {/* RIGHT: Student Submission */}
                          <div className="pl-4 space-y-4">
                            <h4 className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                              Student Submission
                            </h4>

                            <div className="space-y-1">
                              <span className="text-[9px] text-slate-400 dark:text-slate-600 font-bold block">
                                CONVOCATION ATTENDANCE
                              </span>
                              <span
                                className={`text-xs font-bold px-2 py-0.5 rounded inline-block ${
                                  selectedStudent.attending_convocation === true
                                    ? "bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-600 dark:text-blue-400"
                                    : selectedStudent.attending_convocation ===
                                        false
                                      ? "bg-slate-500/10 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400"
                                      : "bg-yellow-500/10 border border-yellow-250/20 text-yellow-600 dark:text-yellow-400"
                                }`}
                              >
                                {selectedStudent.attending_convocation === true
                                  ? "Attending Convocation Day"
                                  : selectedStudent.attending_convocation ===
                                      false
                                    ? "Not Attending (In Absentia)"
                                    : "Undecided / No Response yet"}
                              </span>
                            </div>

                            <div className="space-y-1">
                              <span className="text-[9px] text-slate-400 dark:text-slate-600 font-bold block">
                                SPELLING CORRECTION REQUEST
                              </span>
                              {selectedStudent.name_correction_request ? (
                                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 border border-blue-200 dark:border-blue-500/25 px-2 py-0.5 rounded block">
                                  {selectedStudent.name_correction_request}
                                </span>
                              ) : (
                                <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 block italic">
                                  No correction requested
                                </span>
                              )}
                            </div>

                            <div className="space-y-2">
                              <span className="text-[9px] text-slate-400 dark:text-slate-600 font-bold block">
                                PROFILE PHOTO
                              </span>
                              {selectedStudent.profile_photo_path ? (
                                <a
                                  href={selectedStudent.profile_photo_path}
                                  target="_blank"
                                  rel="noreferrer"
                                  onMouseEnter={() => setPreviewUrl(selectedStudent.profile_photo_path)}
                                  onMouseLeave={() => setPreviewUrl(null)}
                                  className="relative aspect-square w-20 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 flex items-center justify-center cursor-pointer hover:border-blue-500 transition block"
                                  title="Click to view full size photo in new tab"
                                >
                                  <img
                                    src={selectedStudent.profile_photo_path}
                                    alt="Submission"
                                    className="object-cover w-full h-full"
                                  />
                                </a>
                              ) : (
                                <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 block italic">
                                  Photo missing
                                </span>
                              )}
                            </div>

                            <div className="space-y-1.5">
                              <span className="text-[9px] text-slate-400 dark:text-slate-600 font-bold block">
                                PAYMENT SLIP
                              </span>
                              {selectedStudent.payment_slip_path ? (
                                <a
                                  href={selectedStudent.payment_slip_path}
                                  target="_blank"
                                  rel="noreferrer"
                                  onMouseEnter={() => setPreviewUrl(selectedStudent.payment_slip_path)}
                                  onMouseLeave={() => setPreviewUrl(null)}
                                  className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-500 hover:underline font-bold animate-in fade-in"
                                >
                                  <FileText className="h-4 w-4" />
                                  View Uploaded Slip
                                </a>
                              ) : (
                                <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 block italic">
                                  Receipt missing
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              

              {/* Rejection popup prompt */}
              {showRejectDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                  <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 w-full max-w-md mx-6 rounded-2xl relative shadow-2xl">
                    <CardHeader>
                      <CardTitle className="text-sm font-bold text-slate-950 dark:text-white uppercase tracking-wider">
                        Provide Rejection Feedback
                      </CardTitle>
                      <CardDescription className="text-[10px] text-slate-500 dark:text-slate-400">
                        Explain the reason for rejecting spelling corrections or
                        documents.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="rejReason" className="sr-only">
                          Rejection Reason
                        </Label>
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
                          onClick={() => {
                            setShowRejectDialog(false);
                            setRejectReason("");
                          }}
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

                    {/* SESSION ALLOCATION WORKSPACE */}
          {activeTab === "session_allocation" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-955 dark:text-white">Session Mapping Control</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Define dates, times, and map student seating groups (faculties/externals) to graduation sessions.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Allocator Form */}
                <Card className="border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/30 backdrop-blur-md rounded-2xl lg:col-span-1 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base font-bold text-slate-950 dark:text-white">
                      Map Group to Session
                    </CardTitle>
                    <CardDescription className="text-[11px] text-slate-500">
                      Select group, session, and configure date & time parameters.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form
                      onSubmit={handleSaveSessionAllocation}
                      className="space-y-4"
                    >
                      <div className="space-y-1.5">
                        <Label
                          htmlFor="sessAllocGroupSelect"
                          className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400"
                        >
                          Graduation Seating Group
                        </Label>
                        <select
                          id="sessAllocGroupSelect"
                          value={sessAllocGroup}
                          onChange={(e) => setSessAllocGroup(e.target.value)}
                          className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 text-xs text-slate-800 dark:text-slate-300 px-3 py-2 rounded-lg focus:outline-none"
                        >
                                                    <option value="">Select Seating Group</option>
                          {FACULTIES.map((fac) => {
                            const val = `${fac} (Internal)`;
                            const isAllocated = convocationSessions.some(
                              (s) => s.faculty_1 === val || s.faculty_2 === val
                            );
                            return (
                              <option key={fac} value={val} disabled={isAllocated}>
                                {isAllocated ? "✔ " : ""}{fac} (Internal)
                              </option>
                            );
                          })}
                          {(() => {
                            const val = "All External Degrees";
                            const isAllocated = convocationSessions.some(
                              (s) => s.faculty_1 === val || s.faculty_2 === val
                            );
                            return (
                              <option value={val} disabled={isAllocated}>
                                {isAllocated ? "✔ " : ""}All External Degrees
                              </option>
                            );
                          })()}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <Label
                          htmlFor="sessAllocSessionSelect"
                          className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400"
                        >
                          Target Session
                        </Label>
                        <select
                          id="sessAllocSessionSelect"
                          value={sessAllocSession}
                          onChange={(e) => setSessAllocSession(e.target.value)}
                          className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 text-xs text-slate-800 dark:text-slate-300 px-3 py-2 rounded-lg focus:outline-none"
                        >
                          <option value="">Select Session</option>
                          {SESSIONS.map((sessNum) => (
                            <option key={sessNum} value={String(sessNum)}>
                              Session {sessNum}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <Label
                          htmlFor="sessAllocDateInput"
                          className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400"
                        >
                          Session Date
                          {sessAllocDate && (
                            <span className="ml-2 text-blue-600 dark:text-blue-400 normal-case font-semibold">
                              — {formatSessionDate(sessAllocDate)}
                            </span>
                          )}
                        </Label>
                        <input
                          id="sessAllocDateInput"
                          type="date"
                          value={sessAllocDate}
                          onChange={(e) => setSessAllocDate(e.target.value)}
                          className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-xs rounded-lg h-9 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label
                          htmlFor="sessAllocTimeInput"
                          className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400"
                        >
                          Session Time
                          {sessAllocTime && (
                            <span className="ml-2 text-blue-600 dark:text-blue-400 normal-case font-semibold">
                              — {formatSessionTime(sessAllocTime)}
                            </span>
                          )}
                        </Label>
                        <input
                          id="sessAllocTimeInput"
                          type="time"
                          value={sessAllocTime}
                          onChange={(e) => setSessAllocTime(e.target.value)}
                          className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-xs rounded-lg h-9 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <Button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-9 text-xs rounded-lg mt-2 flex items-center justify-center gap-1.5 shadow"
                      >
                        {loading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                        Save Mapping
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                {/* Session Slots Overview */}
                <Card className="border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/30 backdrop-blur-md rounded-2xl lg:col-span-2 shadow-sm">
                  <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-base font-bold text-slate-955 dark:text-white">
                        Graduation Session Slots
                      </CardTitle>
                      <CardDescription className="text-[11px] text-slate-500">
                        Overview of graduation sessions and mapped faculties.
                      </CardDescription>
                    </div>
                    {convocationSessions.some((s: any) => s.faculty_1 || s.faculty_2) && (
                      <button
                        type="button"
                        onClick={handleClearAllAllocations}
                        disabled={loading}
                        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold rounded-lg bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40 hover:bg-red-100 dark:hover:bg-red-950/40 transition disabled:opacity-50"
                        title="Clear all session allocations"
                      >
                        <X className="h-3 w-3" />
                        Clear All Allocations
                      </button>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {convocationSessions.length === 0 ? (
                      <div className="text-center py-8 text-xs text-slate-400 dark:text-slate-600 font-semibold italic">
                        No sessions configured in Faculty & Session Management.
                      </div>
                    ) : (
                      convocationSessions.map((session) => {
                        const hasFaculty1 = !!session.faculty_1;
                        const hasFaculty2 = !!session.faculty_2;
                        
                        return (
                          <div
                            key={session.id}
                            className="p-4 bg-white dark:bg-slate-950/40 rounded-xl border border-slate-200 dark:border-slate-900 flex flex-col md:flex-row md:items-center justify-between gap-4"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-900 dark:text-white">
                                  {session.session_name || `Session ${session.session_number}`}
                                </span>
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50">
                                  Session {session.session_number}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-500 space-y-0.5">
                                <div>
                                  <span className="font-semibold">Date:</span>{" "}
                                  {session.session_date ? formatSessionDate(session.session_date) : "Not configured"}
                                </div>
                                <div>
                                  <span className="font-semibold">Time:</span>{" "}
                                  {session.session_time ? formatSessionTime(session.session_time) : "Not configured"}
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-1 md:justify-end gap-3 flex-wrap">
                              {!hasFaculty1 && !hasFaculty2 ? (
                                <span className="text-xs text-slate-400 dark:text-slate-600 font-semibold italic flex items-center">
                                  No groups allocated
                                </span>
                              ) : (
                                <>
                                  {hasFaculty1 && (
                                    <div className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center gap-3 text-xs">
                                      <div>
                                        <span className="font-bold text-blue-600 dark:text-blue-400 block leading-none">
                                          {session.faculty_1}
                                        </span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleClearSessionAllocation(session.faculty_1)}
                                        className="p-0.5 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-600 dark:text-red-400 rounded transition"
                                        title={`Clear allocation for ${session.faculty_1}`}
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    </div>
                                  )}
                                  {hasFaculty2 && (
                                    <div className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center gap-3 text-xs">
                                      <div>
                                        <span className="font-bold text-blue-600 dark:text-blue-400 block leading-none">
                                          {session.faculty_2}
                                        </span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleClearSessionAllocation(session.faculty_2)}
                                        className="p-0.5 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-600 dark:text-red-400 rounded transition"
                                        title={`Clear allocation for ${session.faculty_2}`}
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* SEATING ALLOCATION WORKSPACE */}
          {activeTab === "seating" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-950 dark:text-white">Seating Allocation Control</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Run sequential seating and certificate numbering algorithms for student groups after session assignments.
                </p>
              </div>

              <div className="space-y-4">
                {sessionAllocations.length === 0 ? (
                  <Card className="border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/30 backdrop-blur-md rounded-2xl shadow-sm p-6 text-center">
                    <span className="text-xs text-slate-400 dark:text-slate-600 font-semibold italic">
                      No groups found. Please configure faculties and ingest students first.
                    </span>
                  </Card>
                ) : (
                  sessionAllocations.map((group) => {
                    const hasSession = group.sessionNumber !== null;
                    const canAllocate = hasSession && group.totalAttendingCount > 0;
                    
                    return (
                      <Card
                        key={group.groupName}
                        className="border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/30 backdrop-blur-md rounded-2xl shadow-sm overflow-hidden"
                      >
                        <div className="p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                          {/* Group Info & Stats */}
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-3 flex-wrap">
                              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                {group.groupName}
                              </h3>
                              
                              {/* Session Badge */}
                              {hasSession ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50">
                                  Session {group.sessionNumber}{group.sessionDate ? ` · ${formatSessionDate(group.sessionDate)}` : ""}{group.sessionTime ? ` at ${formatSessionTime(group.sessionTime)}` : ""}
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-950/30">
                                  No Session Allocated
                                </span>
                              )}

                              {/* Seating Allocation Status Badge */}
                              {group.totalAttendingCount === 0 ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                  No Candidates Attending
                                </span>
                              ) : group.isSeatingAllocated ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50 flex items-center gap-1">
                                  <Check className="h-3 w-3" /> Allocated
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/50 flex items-center gap-1 animate-pulse">
                                  <AlertCircle className="h-3 w-3" /> Pending Seating
                                </span>
                              )}
                            </div>

                            {/* Attending count summary */}
                            <div className="text-xs text-slate-500">
                              <span className="font-semibold text-slate-700 dark:text-slate-350">
                                {group.totalAttendingCount} Approved Candidates Attending
                              </span>{" "}
                              across {group.degreeCount} academic programs.
                            </div>

                                                        {/* Degrees list */}
                            {group.degrees.length > 0 && (
                              <div className="flex flex-col gap-1.5 pt-2 max-w-md">
                                {group.degrees.map((deg: any) => (
                                  <div
                                    key={deg.id}
                                    className="flex items-center justify-between text-xs py-1 border-b border-slate-100 dark:border-slate-800/50"
                                  >
                                    <span className="text-slate-600 dark:text-slate-400 font-medium truncate mr-4">
                                      {deg.name}
                                    </span>
                                    <span className="font-bold text-slate-800 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800 shrink-0 text-right min-w-[90px]">
                                      {deg.attendingCount} Attending
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Seating Actions */}
                          <div className="flex items-center gap-2 lg:self-center shrink-0">
                            {/* Allocate Seating Button */}
                            <Button
                              onClick={() => handleTriggerSeatingAllocation(group.groupName)}
                              disabled={loading || !canAllocate || group.isSeatingAllocated}
                              className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-9 text-xs rounded-lg px-4 flex items-center gap-1.5 shadow disabled:opacity-50"
                            >
                              {loading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <UserCheck className="h-4 w-4" />
                              )}
                              Allocate Seating
                            </Button>

                            {/* Clear Seating Button */}
                            <Button
                              variant="outline"
                              onClick={() => handleClearSeatingAllocation(group.groupName)}
                              disabled={loading || (!group.isSeatingAllocated && group.totalAttendingCount > 0 && !group.degrees.some((d: any) => d.attendingCount > 0))}
                              className="border-slate-200 dark:border-slate-800 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 text-xs font-bold h-9 rounded-lg px-3 flex items-center gap-1.5"
                            >
                              <Trash2 className="h-4 w-4" />
                              Clear Seating
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })
                )}
              </div>
            </div>
          )}
          
{/* 6. CERTIFICATE PRINT WORKSPACE */}
          {activeTab === "print" && (
            <div className="space-y-6">
              <Card className="border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/30 backdrop-blur-md rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base font-bold text-slate-950 dark:text-white">
                    Document Compiler Pipeline
                  </CardTitle>
                  <CardDescription className="text-[11px] text-slate-500">
                    Programmatic coordinate-based duplex layout compiling
                    engine.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 text-center py-12">
                  <div className="max-w-md mx-auto space-y-4">
                    <GraduationCap className="h-16 w-16 text-blue-600 dark:text-blue-500 mx-auto animate-bounce" />
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      Duplex Master PDF Compilation
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      This triggers a background worker compiler that loads
                      pre-uploaded cached layouts (Internal Front/Back, External
                      Front/Back), loops through all verified candidates
                      alphabetically, injects names and certificate serial
                      numbers at pixel locations, and exports a single
                      printing-ready PDF with alternating front and back pages.
                    </p>

                    {printStatus.status === "idle" ? (
                      <div className="space-y-4">
                        <div className="space-y-3 text-left bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                          <div className="space-y-1.5">
                            <Label
                              htmlFor="printFacultySelect"
                              className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400"
                            >
                              Select Faculty
                            </Label>
                            <select
                              id="printFacultySelect"
                              value={printFaculty}
                              onChange={(e) => setPrintFaculty(e.target.value)}
                              className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 text-xs text-slate-800 dark:text-white px-3 py-2 rounded-lg focus:outline-none h-10 font-bold"
                            >
                              <option value="">Select Faculty</option>
                              {FACULTIES.map((f) => (
                                <option key={f} value={f}>
                                  {f}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1.5">
                            <Label
                              htmlFor="printDegreeSelect"
                              className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400"
                            >
                              Select Degree
                            </Label>
                            <select
                              id="printDegreeSelect"
                              value={printDegreeId}
                              onChange={(e) => setPrintDegreeId(e.target.value)}
                              disabled={!printFaculty}
                              className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 text-xs text-slate-800 dark:text-white px-3 py-2 rounded-lg focus:outline-none h-10 disabled:opacity-50 font-bold"
                            >
                              <option value="">Select Degree</option>
                              {printFaculty &&
                                degrees
                                  .filter((d) => d.faculty === printFaculty)
                                  .map((d) => (
                                    <option key={d.id} value={d.id}>
                                      {d.name_en} ({d.type})
                                    </option>
                                  ))}
                            </select>
                          </div>
                        </div>

                        <Button
                          onClick={handleTriggerPrint}
                          disabled={loading || !printFaculty || !printDegreeId}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 disabled:opacity-50"
                        >
                          {loading ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                          Trigger Compilation Queue
                        </Button>
                      </div>
                    ) : printStatus.status === "processing" ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                          <span>
                            Compiling page maps ({printStatus.current} /{" "}
                            {printStatus.total})
                          </span>
                          <span className="font-bold text-blue-600 dark:text-blue-500">
                            {Math.round(
                              (printStatus.current / printStatus.total) * 100,
                            )}
                            %
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-200 dark:border-slate-900">
                          <div
                            className="bg-blue-600 h-full transition-all duration-300"
                            style={{
                              width: `${(printStatus.current / printStatus.total) * 100}%`,
                            }}
                          />
                        </div>
                        <div className="text-[10px] text-slate-500 italic">
                          Isolated background worker thread active. Server
                          responsive.
                        </div>
                      </div>
                    ) : printStatus.status === "completed" ? (
                      <div className="space-y-4">
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-2">
                          <Check className="h-4 w-4 text-emerald-650" />
                          Compilation completed! {printStatus.total}{" "}
                          certificates merged successfully.
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
                          onClick={() =>
                            setPrintStatus({
                              status: "idle",
                              current: 0,
                              total: 0,
                              error: null,
                              outputPath: null,
                            })
                          }
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

          {/* 6.1. CERTIFICATE LAYOUT MANAGER WORKSPACE */}
          {activeTab === "cert_layout" && (
            <div className="space-y-6">
              <Card className="border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/30 backdrop-blur-md rounded-2xl shadow-sm">
                <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 gap-4">
                  <div>
                    <CardTitle className="text-base font-bold text-slate-950 dark:text-white">
                      Certificate Layout Manager
                    </CardTitle>
                    <CardDescription className="text-[11px] text-slate-500">
                      Configure text alignments, titles, preambles, and coordinate placements for printed certificates.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-400">
                      Cohort: {activeConvocationYear}
                    </span>
                    <Button
                      onClick={handleResetLayoutConfig}
                      variant="outline"
                      className="border-slate-200 dark:border-slate-800 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 h-9 rounded-xl font-bold"
                    >
                      Reset to Defaults
                    </Button>
                    <Button
                      onClick={handleSaveLayoutConfig}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-9 rounded-xl font-bold shadow-lg shadow-blue-500/10"
                    >
                      Save Layout Config
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {layoutLoading || !layoutConfig ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                      <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
                      <span className="text-xs font-bold text-slate-500">Loading layout configuration...</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                      {/* Left Column: Form Controls */}
                      <div className="lg:col-span-5 space-y-6 max-h-[700px] overflow-y-auto pr-2">
                        {/* Side Switcher */}
                        <div className="bg-slate-100/50 dark:bg-slate-950/40 p-1 rounded-xl border border-slate-200 dark:border-slate-900 flex gap-2">
                          <button
                            type="button"
                            onClick={() => setLayoutSide("front")}
                            className={`flex-1 py-2 text-xs font-extrabold rounded-lg transition-all ${
                              layoutSide === "front"
                                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                                : "text-slate-500 dark:text-slate-400 hover:text-slate-850 dark:hover:text-slate-200"
                            }`}
                          >
                            Side 1 (Front - English)
                          </button>
                          <button
                            type="button"
                            onClick={() => setLayoutSide("back")}
                            className={`flex-1 py-2 text-xs font-extrabold rounded-lg transition-all ${
                              layoutSide === "back"
                                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                                : "text-slate-500 dark:text-slate-400 hover:text-slate-850 dark:hover:text-slate-200"
                            }`}
                          >
                            Side 2 (Back - Sinhala & Tamil)
                          </button>
                        </div>

                        {/* Front Controls */}
                        {layoutSide === "front" && (
                          <div className="space-y-5">
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Front Placement & Scale</h3>
                            
                            {/* Student Name position */}
                            <div className="space-y-2">
                              <div className="flex justify-between text-xs font-bold">
                                <Label className="text-slate-700 dark:text-slate-350">Student Name Y-Coordinate</Label>
                                <span className="text-blue-500">{layoutConfig.studentNameY} pt</span>
                              </div>
                              <input
                                type="range"
                                min="300"
                                max="600"
                                step="1"
                                value={layoutConfig.studentNameY || 490}
                                onChange={(e) => updateLayoutField("studentNameY", Number(e.target.value))}
                                className="w-full h-1.5 bg-slate-200 dark:bg-slate-850 rounded-lg appearance-none cursor-pointer accent-blue-600"
                              />
                            </div>

                            <div className="space-y-2">
                              <div className="flex justify-between text-xs font-bold">
                                <Label className="text-slate-700 dark:text-slate-350">Student Name Font Size</Label>
                                <span className="text-blue-500">{layoutConfig.studentNameFontSize} pt</span>
                              </div>
                              <input
                                type="range"
                                min="16"
                                max="36"
                                step="0.5"
                                value={layoutConfig.studentNameFontSize || 26}
                                onChange={(e) => updateLayoutField("studentNameFontSize", Number(e.target.value))}
                                className="w-full h-1.5 bg-slate-200 dark:bg-slate-850 rounded-lg appearance-none cursor-pointer accent-blue-600"
                              />
                            </div>

                            {/* Degree Name position */}
                            <div className="space-y-2">
                              <div className="flex justify-between text-xs font-bold">
                                <Label className="text-slate-700 dark:text-slate-350">Degree Name Y-Coordinate</Label>
                                <span className="text-blue-500">{layoutConfig.degreeNameY} pt</span>
                              </div>
                              <input
                                type="range"
                                min="300"
                                max="500"
                                step="1"
                                value={layoutConfig.degreeNameY || 405}
                                onChange={(e) => updateLayoutField("degreeNameY", Number(e.target.value))}
                                className="w-full h-1.5 bg-slate-200 dark:bg-slate-850 rounded-lg appearance-none cursor-pointer accent-blue-600"
                              />
                            </div>

                            <div className="space-y-2">
                              <div className="flex justify-between text-xs font-bold">
                                <Label className="text-slate-700 dark:text-slate-350">Degree Name Font Size</Label>
                                <span className="text-blue-500">{layoutConfig.degreeNameFontSize} pt</span>
                              </div>
                              <input
                                type="range"
                                min="12"
                                max="28"
                                step="1"
                                value={layoutConfig.degreeNameFontSize || 20}
                                onChange={(e) => updateLayoutField("degreeNameFontSize", Number(e.target.value))}
                                className="w-full h-1.5 bg-slate-200 dark:bg-slate-850 rounded-lg appearance-none cursor-pointer accent-blue-600"
                              />
                            </div>

                            {/* Digital Date */}
                            <div className="space-y-2">
                              <Label className="text-xs font-bold text-slate-750">Conferment Date (Digital Format)</Label>
                              <Input
                                type="text"
                                value={layoutConfig.dateDigitalText || ""}
                                onChange={(e) => updateLayoutField("dateDigitalText", e.target.value)}
                                className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-900 text-xs rounded-xl"
                              />
                            </div>

                            <div className="space-y-2">
                              <div className="flex justify-between text-xs font-bold">
                                <Label className="text-slate-700 dark:text-slate-350">Digital Date Y-Coordinate</Label>
                                <span className="text-blue-500">{layoutConfig.dateDigitalY} pt</span>
                              </div>
                              <input
                                type="range"
                                min="280"
                                max="400"
                                step="1"
                                value={layoutConfig.dateDigitalY || 350}
                                onChange={(e) => updateLayoutField("dateDigitalY", Number(e.target.value))}
                                className="w-full h-1.5 bg-slate-200 dark:bg-slate-850 rounded-lg appearance-none cursor-pointer accent-blue-600"
                              />
                            </div>

                            {/* Verbal Date */}
                            <div className="space-y-2">
                              <Label className="text-xs font-bold text-slate-750">Conferment Date (Verbal / Words)</Label>
                              <Input
                                type="text"
                                value={layoutConfig.dateVerbalText || ""}
                                onChange={(e) => updateLayoutField("dateVerbalText", e.target.value)}
                                className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-900 text-xs rounded-xl"
                              />
                            </div>

                            <div className="space-y-2">
                              <div className="flex justify-between text-xs font-bold">
                                <Label className="text-slate-700 dark:text-slate-350">Verbal Date Y-Coordinate</Label>
                                <span className="text-blue-500">{layoutConfig.dateVerbalY} pt</span>
                              </div>
                              <input
                                type="range"
                                min="180"
                                max="300"
                                step="1"
                                value={layoutConfig.dateVerbalY || 245}
                                onChange={(e) => updateLayoutField("dateVerbalY", Number(e.target.value))}
                                className="w-full h-1.5 bg-slate-200 dark:bg-slate-850 rounded-lg appearance-none cursor-pointer accent-blue-600"
                              />
                            </div>
                          </div>
                        )}

                        {/* Back Controls */}
                        {layoutSide === "back" && (
                          <div className="space-y-5">
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Back Placements & Translations</h3>
                            
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <div className="flex justify-between text-xs font-bold">
                                  <Label className="text-slate-700">Title Y-Pos</Label>
                                  <span className="text-blue-500">{layoutConfig.titleY} pt</span>
                                </div>
                                <input
                                  type="range"
                                  min="450"
                                  max="550"
                                  step="1"
                                  value={layoutConfig.titleY || 500}
                                  onChange={(e) => updateLayoutField("titleY", Number(e.target.value))}
                                  className="w-full h-1.5 bg-slate-200 dark:bg-slate-850 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                />
                              </div>

                              <div className="space-y-2">
                                <div className="flex justify-between text-xs font-bold">
                                  <Label className="text-slate-700">Preamble Y-Pos</Label>
                                  <span className="text-blue-500">{layoutConfig.preambleY} pt</span>
                                </div>
                                <input
                                  type="range"
                                  min="400"
                                  max="500"
                                  step="1"
                                  value={layoutConfig.preambleY || 482}
                                  onChange={(e) => updateLayoutField("preambleY", Number(e.target.value))}
                                  className="w-full h-1.5 bg-slate-200 dark:bg-slate-850 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                />
                              </div>
                            </div>

                            {/* Preambles */}
                            <div className="space-y-3 p-3 bg-slate-50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-900 rounded-2xl">
                              <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400">Sinhala Statutory Preamble</h4>
                              <div className="space-y-2">
                                <Label className="text-[10px] font-bold text-slate-500">Internal Candidate Preamble</Label>
                                <textarea
                                  rows={3}
                                  value={layoutConfig.preambleSiInternal || ""}
                                  onChange={(e) => updateLayoutField("preambleSiInternal", e.target.value)}
                                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 text-xs rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-[10px] font-bold text-slate-500">External Candidate Preamble</Label>
                                <textarea
                                  rows={3}
                                  value={layoutConfig.preambleSiExternal || ""}
                                  onChange={(e) => updateLayoutField("preambleSiExternal", e.target.value)}
                                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 text-xs rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-[10px] font-bold text-slate-500">Sinhala Suffix</Label>
                                <Input
                                  type="text"
                                  value={layoutConfig.suffixSi || ""}
                                  onChange={(e) => updateLayoutField("suffixSi", e.target.value)}
                                  className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-900 text-xs rounded-xl"
                                />
                              </div>
                            </div>

                            <div className="space-y-3 p-3 bg-slate-50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-900 rounded-2xl">
                              <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400">Tamil Statutory Preamble</h4>
                              <div className="space-y-2">
                                <Label className="text-[10px] font-bold text-slate-500">Internal Candidate Preamble</Label>
                                <textarea
                                  rows={3}
                                  value={layoutConfig.preambleTaInternal || ""}
                                  onChange={(e) => updateLayoutField("preambleTaInternal", e.target.value)}
                                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 text-xs rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-[10px] font-bold text-slate-500">External Candidate Preamble</Label>
                                <textarea
                                  rows={3}
                                  value={layoutConfig.preambleTaExternal || ""}
                                  onChange={(e) => updateLayoutField("preambleTaExternal", e.target.value)}
                                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 text-xs rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-[10px] font-bold text-slate-500">Tamil Suffix</Label>
                                <textarea
                                  rows={2}
                                  value={layoutConfig.suffixTa || ""}
                                  onChange={(e) => updateLayoutField("suffixTa", e.target.value)}
                                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 text-xs rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                              </div>
                            </div>

                            {/* Back Page Dates */}
                            <div className="space-y-3 p-3 bg-slate-50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-900 rounded-2xl">
                              <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400">Bilateral Dates</h4>
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <Label className="text-[9px] font-bold">Sinhala Date Line 1</Label>
                                  <Input
                                    type="text"
                                    value={layoutConfig.dateSiLine1 || ""}
                                    onChange={(e) => updateLayoutField("dateSiLine1", e.target.value)}
                                    className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 text-[11px] h-8 rounded-lg"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[9px] font-bold">Sinhala Date Line 2</Label>
                                  <Input
                                    type="text"
                                    value={layoutConfig.dateSiLine2 || ""}
                                    onChange={(e) => updateLayoutField("dateSiLine2", e.target.value)}
                                    className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 text-[11px] h-8 rounded-lg"
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-3 mt-2">
                                <div className="space-y-1">
                                  <Label className="text-[9px] font-bold">Tamil Date Line 1</Label>
                                  <Input
                                    type="text"
                                    value={layoutConfig.dateTaLine1 || ""}
                                    onChange={(e) => updateLayoutField("dateTaLine1", e.target.value)}
                                    className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 text-[11px] h-8 rounded-lg"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[9px] font-bold">Tamil Date Line 2</Label>
                                  <Input
                                    type="text"
                                    value={layoutConfig.dateTaLine2 || ""}
                                    onChange={(e) => updateLayoutField("dateTaLine2", e.target.value)}
                                    className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 text-[11px] h-8 rounded-lg"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Signatures */}
                            <div className="space-y-3 p-3 bg-slate-50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-900 rounded-2xl">
                              <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400">Signatory Details</h4>
                              
                              <div className="space-y-2">
                                <Label className="text-[10px] font-bold">Registrar Name</Label>
                                <Input
                                  type="text"
                                  value={layoutConfig.registrarName || ""}
                                  onChange={(e) => updateLayoutField("registrarName", e.target.value)}
                                  className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-900 text-xs rounded-xl"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-[10px] font-bold">Registrar Title</Label>
                                <Input
                                  type="text"
                                  value={layoutConfig.registrarTitle || ""}
                                  onChange={(e) => updateLayoutField("registrarTitle", e.target.value)}
                                  className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-900 text-xs rounded-xl"
                                />
                              </div>

                              <div className="space-y-2">
                                <Label className="text-[10px] font-bold">Vice Chancellor Name</Label>
                                <Input
                                  type="text"
                                  value={layoutConfig.vcName || ""}
                                  onChange={(e) => updateLayoutField("vcName", e.target.value)}
                                  className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-900 text-xs rounded-xl"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-[10px] font-bold">Vice Chancellor Title</Label>
                                <Input
                                  type="text"
                                  value={layoutConfig.vcTitle || ""}
                                  onChange={(e) => updateLayoutField("vcTitle", e.target.value)}
                                  className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-900 text-xs rounded-xl"
                                />
                              </div>

                              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 dark:border-slate-900">
                                <div className="space-y-1">
                                  <Label className="text-[9px] font-bold">Registrar X</Label>
                                  <Input
                                    type="number"
                                    value={layoutConfig.registrarX || 99}
                                    onChange={(e) => updateLayoutField("registrarX", Number(e.target.value))}
                                    className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-900 text-xs h-8 rounded-lg"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[9px] font-bold">VC X</Label>
                                  <Input
                                    type="number"
                                    value={layoutConfig.vcX || 496}
                                    onChange={(e) => updateLayoutField("vcX", Number(e.target.value))}
                                    className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-900 text-xs h-8 rounded-lg"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[9px] font-bold">Sign Y</Label>
                                  <Input
                                    type="number"
                                    value={layoutConfig.signatureY || 118}
                                    onChange={(e) => updateLayoutField("signatureY", Number(e.target.value))}
                                    className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-900 text-xs h-8 rounded-lg"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Right Column: Visual Preview Canvas */}
                      <div className="lg:col-span-7 flex flex-col items-center justify-start bg-slate-100/30 dark:bg-slate-950/20 border border-slate-250 dark:border-slate-900 rounded-3xl p-6 relative min-h-[660px]">
                        <span className="absolute top-4 left-4 bg-slate-900/60 text-white dark:bg-white/10 dark:text-slate-350 text-[10px] font-black uppercase px-2.5 py-1 rounded-md tracking-wider">
                          Interactive Live Canvas
                        </span>

                        {layoutSide === "front" ? (
                          /* Front side live layout representation */
                          <div 
                            className="w-[420px] h-[594px] bg-[#fefdfa] dark:bg-[#FAF9F5] border-8 border-double border-[#8b7355] rounded-xl shadow-2xl relative select-none font-serif text-[#1e293b] overflow-hidden"
                            style={{ backgroundImage: "radial-gradient(rgba(139,115,85,0.03) 1px, transparent 0)", backgroundSize: "8px 8px" }}
                          >
                            {/* Inner border line */}
                            <div className="absolute inset-1 border border-[#8b7355]/20 pointer-events-none" />

                            {/* Crest logo representation */}
                            <div className="absolute top-[8%] left-1/2 -translate-x-1/2 w-14 h-14 bg-slate-100 dark:bg-slate-200/80 rounded-full border border-dashed border-[#8b7355]/40 flex items-center justify-center text-[10px] text-slate-400 font-bold">
                              CREST
                            </div>

                            {/* University Title */}
                            <div className="absolute top-[21%] left-0 w-full text-center text-[14px] font-bold uppercase tracking-widest text-[#8b7355]">
                              Rajarata University of Sri Lanka
                            </div>

                            {/* Preamble description */}
                            <div className="absolute top-[28%] left-10 right-10 text-center text-[8px] italic leading-normal text-slate-500 max-h-12 overflow-hidden">
                              Having successfully completed the prescribed courses of study and the examinations of this university as an internal candidate...
                            </div>

                            {/* Bridge text */}
                            <div className="absolute top-[37%] left-0 w-full text-center text-[8px] text-slate-400">
                              was admitted to the degree of
                            </div>

                            {/* Student Name dynamic position */}
                            <div 
                              className="absolute left-10 right-10 text-center font-bold text-[#1e3a8a] truncate"
                              style={{ 
                                top: `${((841.89 - (layoutConfig.studentNameY || 490)) / 841.89) * 100}%`,
                                fontSize: `${(layoutConfig.studentNameFontSize || 26) * 0.55}px`,
                                lineHeight: "1.1"
                              }}
                            >
                              KUMARA A.B.C.D.E.F.
                            </div>

                            {/* Degree Name dynamic position */}
                            <div 
                              className="absolute left-10 right-10 text-center font-bold text-[#8b7355]"
                              style={{ 
                                top: `${((841.89 - (layoutConfig.degreeNameY || 405)) / 841.89) * 100}%`,
                                fontSize: `${(layoutConfig.degreeNameFontSize || 20) * 0.55}px`,
                                lineHeight: "1.1"
                              }}
                            >
                              BACHELOR OF SCIENCE IN INFORMATION TECHNOLOGY
                            </div>

                            {/* Static and details bridge */}
                            <div 
                              className="absolute left-0 w-full text-center text-[7px] text-slate-400 uppercase tracking-widest"
                              style={{ top: `${((841.89 - 380) / 841.89) * 100}%` }}
                            >
                              and was conferred this degree at the convocation
                            </div>

                            {/* Dynamic Digital Date */}
                            <div 
                              className="absolute left-0 w-full text-center text-[9px] italic text-slate-600"
                              style={{ top: `${((841.89 - (layoutConfig.dateDigitalY || 350)) / 841.89) * 100}%` }}
                            >
                              on {layoutConfig.dateDigitalText || "15th January 2023"}
                            </div>

                            {/* Dynamic Verbal Date */}
                            <div 
                              className="absolute left-10 right-10 text-center text-[8px] italic text-slate-500 leading-tight"
                              style={{ top: `${((841.89 - (layoutConfig.dateVerbalY || 245)) / 841.89) * 100}%` }}
                            >
                              held on {layoutConfig.dateVerbalText || "Twenty Seventh Day of July in the Year Two Thousand Twenty Three"}
                            </div>

                            {/* Signatures representations */}
                            <div 
                              className="absolute w-full px-8 flex justify-between"
                              style={{ top: `${((841.89 - 140) / 841.89) * 100}%` }}
                            >
                              <div className="text-center w-28 border-t border-slate-300 pt-1">
                                <span className="text-[8px] block font-sans text-slate-400">Registrar Signature</span>
                                <span className="text-[9px] font-sans font-bold text-slate-600 block mt-0.5">Registrar</span>
                              </div>
                              <div className="text-center w-28 border-t border-slate-300 pt-1">
                                <span className="text-[8px] block font-sans text-slate-400">VC Signature</span>
                                <span className="text-[9px] font-sans font-bold text-slate-600 block mt-0.5">Vice Chancellor</span>
                              </div>
                            </div>

                            {/* Seal */}
                            <div 
                              className="absolute left-1/2 -translate-x-1/2 w-14 h-14 rounded-full border-2 border-red-500/25 flex items-center justify-center text-[8px] font-black tracking-widest text-red-500/30"
                              style={{ top: `${((841.89 - 170) / 841.89) * 100}%` }}
                            >
                              SEAL
                            </div>
                          </div>
                        ) : (
                          /* Back side live layout representation (bilateral translations) */
                          <div 
                            className="w-[420px] h-[594px] bg-[#fefdfa] dark:bg-[#FAF9F5] border-8 border-double border-[#8b7355] rounded-xl shadow-2xl relative select-none font-serif text-[#1e293b] overflow-hidden"
                            style={{ backgroundImage: "radial-gradient(rgba(139,115,85,0.03) 1px, transparent 0)", backgroundSize: "8px 8px" }}
                          >
                            {/* Inner border */}
                            <div className="absolute inset-1 border border-[#8b7355]/20 pointer-events-none" />

                            {/* Certificate metadata */}
                            <div className="absolute top-[4%] right-[8%] text-[7px] text-slate-400 text-right font-sans">
                              Certificate # 001542
                            </div>

                            {/* Logo */}
                            <div className="absolute top-[5%] left-1/2 -translate-x-1/2 w-9 h-9 bg-slate-100 rounded-full border border-slate-200 flex items-center justify-center text-[7px] text-slate-400 font-bold">
                              Logo
                            </div>
                            <div className="absolute top-[12%] left-0 w-full text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              Rajarata University of Sri Lanka
                            </div>

                            {/* Mock Grading Scheme Table */}
                            <div className="absolute top-[16%] left-6 right-6 border border-slate-200 bg-slate-50 text-[6px] font-sans p-1.5 rounded-lg">
                              <div className="grid grid-cols-4 font-bold border-b border-slate-350 pb-1 mb-1 text-slate-500">
                                <span>Grading</span>
                                <span>Regulation</span>
                                <span>Relevance</span>
                                <span>Status</span>
                              </div>
                              <div className="grid grid-cols-4 text-slate-400 space-y-0.5">
                                <span>First Class</span>
                                <span>GPA &gt;= 3.70</span>
                                <span>Excellent</span>
                                <span>Awarded</span>
                              </div>
                            </div>

                            {/* Bilateral columns titles */}
                            <div 
                              className="absolute w-full px-6 grid grid-cols-2 gap-4"
                              style={{ top: `${((841.89 - (layoutConfig.titleY || 500)) / 841.89) * 100}%` }}
                            >
                              <div className="text-center font-bold text-[9px] text-[#1e293b] truncate">
                                {layoutConfig.titleSi || "\u0dc1\u0dca\u200d\u0dbb\u0dd3 \u0dbd\u0d82\u0d9a\u0dcf \u0dbb\u0da2\u0dbb\u0dcf\u0da2 \u0dc0\u0dd2\u0dc1\u0dca\u0dc0\u0dc0\u0dd2\u0daf\u0dca\u200d\u0dba\u0dcf\u0dbd\u0dba"}
                              </div>
                              <div className="text-center font-bold text-[9.5px] text-[#1e293b] truncate">
                                {layoutConfig.titleTa || "\u0b87\u0bb2\u0b99\u0bcd\u0b95\u0bc8 \u0bb0\u0b9c\u0bb0\u0bbe\u0b9c \u0baa\u0bb2\u0bcd\u0b95\u0bb2\u0bc8\u0b95\u0bcd\u0b95\u0bb4\u0b95\u0bae\u0bcd"}
                              </div>
                            </div>

                            {/* Bilateral statutory preambles */}
                            <div 
                              className="absolute w-full px-6 grid grid-cols-2 gap-4 text-slate-600 leading-normal"
                              style={{ top: `${((841.89 - (layoutConfig.preambleY || 482)) / 841.89) * 100}%` }}
                            >
                              {/* Sinhala side */}
                              <div className="text-[6.5px] whitespace-pre-line tracking-tight">
                                {layoutConfig.preambleSiInternal || ""}
                                <div className="font-bold text-[#8b7355] text-[7.5px] py-1">
                                  තොරතුරු තාක්ෂණවේදීවේදී උපාධිය
                                </div>
                                <div className="mb-2">
                                  {layoutConfig.suffixSi || ""}
                                </div>
                                <div className="text-[6px] text-slate-400 leading-tight">
                                  {layoutConfig.dateSiLine1} <br />
                                  {layoutConfig.dateSiLine2}
                                </div>
                              </div>

                              {/* Tamil side */}
                              <div className="text-[6.5px] whitespace-pre-line tracking-tight">
                                {layoutConfig.preambleTaInternal || ""}
                                <div className="font-bold text-[#8b7355] text-[7px] py-1">
                                  தகவல் தொழில்நுட்பமானி பட்டத்தை
                                </div>
                                <div className="mb-2">
                                  {layoutConfig.suffixTa || ""}
                                </div>
                                <div className="text-[6px] text-slate-400 leading-tight">
                                  {layoutConfig.dateTaLine1} <br />
                                  {layoutConfig.dateTaLine2}
                                </div>
                              </div>
                            </div>

                            {/* Registrar Signature representation */}
                            <div 
                              className="absolute text-center"
                              style={{ 
                                left: `${((layoutConfig.registrarX || 99) / 595.275) * 100}%`,
                                top: `${((841.89 - (layoutConfig.signatureY || 118)) / 841.89) * 100}%`,
                                width: "120px",
                                transform: "translateX(-50%)"
                              }}
                            >
                              <div className="w-16 h-4 border-b border-dashed border-slate-300 mx-auto" />
                              <span className="text-[6.5px] block font-sans text-slate-650 mt-1 leading-tight">{layoutConfig.registrarName}</span>
                              <span className="text-[6.5px] block font-sans text-slate-450 leading-none">{layoutConfig.registrarTitle}</span>
                            </div>

                            {/* Vice Chancellor Signature representation */}
                            <div 
                              className="absolute text-center"
                              style={{ 
                                left: `${((layoutConfig.vcX || 496) / 595.275) * 100}%`,
                                top: `${((841.89 - (layoutConfig.signatureY || 118)) / 841.89) * 100}%`,
                                width: "120px",
                                transform: "translateX(-50%)"
                              }}
                            >
                              <div className="w-16 h-4 border-b border-dashed border-slate-300 mx-auto" />
                              <span className="text-[6px] block font-sans text-slate-650 mt-1 leading-tight">{layoutConfig.vcName}</span>
                              <span className="text-[6.5px] block font-sans text-slate-450 leading-none">{layoutConfig.vcTitle}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* 7. ADMINISTRATOR CONTROL CENTER WORKSPACE */}
          {activeTab === "accounts" && staffUser?.role === "Administrator" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Column 1: Add Account & Database backup */}
                <div className="lg:col-span-1 space-y-6">
                  {/* Form to Add Account */}
                  <Card className="border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/30 backdrop-blur-md rounded-2xl shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-base font-bold text-slate-950 dark:text-white">
                        Create User Account
                      </CardTitle>
                      <CardDescription className="text-[11px] text-slate-500">
                        Register new staff members or administrators.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={handleCreateStaff} className="space-y-4">
                        <div className="space-y-1.5">
                          <Label
                            htmlFor="newStaffName"
                            className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400"
                          >
                            Full Name
                          </Label>
                          <Input
                            id="newStaffName"
                            required
                            value={newStaffName}
                            onChange={(e) => setNewStaffName(e.target.value)}
                            placeholder="e.g. John Doe"
                            className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 text-xs rounded-lg h-9"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label
                            htmlFor="newStaffUsername"
                            className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400"
                          >
                            Username
                          </Label>
                          <Input
                            id="newStaffUsername"
                            required
                            value={newStaffUsername}
                            onChange={(e) =>
                              setNewStaffUsername(e.target.value)
                            }
                            placeholder="e.g. johnd"
                            className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 text-xs rounded-lg h-9"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label
                            htmlFor="newStaffPassword"
                            className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400"
                          >
                            Password
                          </Label>
                          <Input
                            id="newStaffPassword"
                            required
                            type="password"
                            value={newStaffPassword}
                            onChange={(e) =>
                              setNewStaffPassword(e.target.value)
                            }
                            placeholder="••••••••"
                            className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 text-xs rounded-lg h-9"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label
                            htmlFor="newStaffRole"
                            className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400"
                          >
                            Role
                          </Label>
                          <select
                            id="newStaffRole"
                            value={newStaffRole}
                            onChange={(e) =>
                              setNewStaffRole(e.target.value as any)
                            }
                            className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 text-xs text-slate-800 dark:text-slate-300 px-3 py-2 rounded-lg focus:outline-none h-9"
                          >
                            <option value="Staff">Staff</option>
                            <option value="Administrator">Administrator</option>
                          </select>
                        </div>

                        <Button
                          type="submit"
                          disabled={loading}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-9 text-xs rounded-lg mt-2 shadow"
                        >
                          {loading ? (
                            <Loader2 className="h-4 w-4 animate-spin mx-auto text-white" />
                          ) : (
                            "Create Account"
                          )}
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                </div>

                {/* Column 2 & 3: Table displaying staff list */}
                <Card className="border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/30 backdrop-blur-md rounded-2xl lg:col-span-2 shadow-sm self-start">
                  <CardHeader>
                    <CardTitle className="text-base font-bold text-slate-950 dark:text-white">
                      Administrative Staff Registry
                    </CardTitle>
                    <CardDescription className="text-[11px] text-slate-500">
                      Currently configured system accounts.
                    </CardDescription>
                  </CardHeader>
                  <div className="border border-slate-200 dark:border-slate-900 rounded-xl overflow-hidden overflow-x-auto mx-4 my-4 ">
                  <CardContent className="p-0 overflow-hidden border-t border-slate-100 dark:border-slate-900">
                    <Table className="text-xs">
                      <TableHeader className="bg-slate-100/50 dark:bg-slate-800">
                        <TableRow className="border-b border-slate-200 dark:border-slate-900">
                          <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-4 py-3">
                            Full Name
                          </TableHead>
                          <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-4 py-3">
                            Username
                          </TableHead>
                          <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-4 py-3">
                            Role
                          </TableHead>
                          <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-4 py-3">
                            Status
                          </TableHead>
                          <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-4 py-3 text-right">
                            Created Date
                          </TableHead>
                          <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-4 py-3 text-right">
                            Actions
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="divide-y divide-slate-100 dark:divide-slate-900 font-medium">
                        {staffList.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={6}
                              className="text-center py-8 text-slate-500"
                            >
                              No staff members found.
                            </TableCell>
                          </TableRow>
                        ) : (
                          staffList.map((staff) => (
                            <TableRow
                              key={staff.id}
                              className="border-b border-slate-200 dark:border-slate-900 hover:bg-slate-100/30 dark:hover:bg-slate-900/10 transition-colors"
                            >
                              <TableCell className="px-4 py-2.5 text-slate-800 dark:text-white font-bold">
                                {staff.name}
                              </TableCell>
                              <TableCell className="px-4 py-2.5 text-slate-900 dark:text-white font-mono">
                                {staff.username}
                              </TableCell>
                              <TableCell className="px-4 py-2.5">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    staff.role === "Administrator"
                                      ? "bg-purple-500/10 text-purple-650 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20"
                                      : "bg-slate-500/10 text-slate-650 dark:text-slate-400 border border-slate-200 dark:border-slate-800"
                                  }`}
                                >
                                  {staff.role}
                                </span>
                              </TableCell>
                              <TableCell className="px-4 py-2.5">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    staff.status === "Active"
                                      ? "bg-emerald-500/10 text-emerald-650 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20"
                                      : "bg-red-500/10 text-red-650 dark:text-red-400 border border-red-200 dark:border-red-500/20"
                                  }`}
                                >
                                  {staff.status || "Active"}
                                </span>
                              </TableCell>
                              <TableCell className="px-4 py-2.5 text-right text-slate-500">
                                {new Date(
                                  staff.created_at,
                                ).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="px-4 py-2.5 text-right space-x-2">
                                <Button
                                  variant="outline"
                                  size="xs"
                                  onClick={() =>
                                    handleToggleStaffStatus(
                                      staff.id,
                                      staff.username,
                                      staff.status,
                                    )
                                  }
                                  disabled={
                                    staff.username === staffUser?.username
                                  }
                                  className="h-7 text-[10px] rounded-lg px-2"
                                >
                                  {staff.status === "Disabled"
                                    ? "Resume"
                                    : "Pause"}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="xs"
                                  onClick={() =>
                                    handleDeleteStaff(staff.id, staff.username)
                                  }
                                  disabled={
                                    staff.username === staffUser?.username
                                  }
                                  className="h-7 text-[10px] text-red-600 hover:text-red-700 dark:text-red-400 border-red-200 dark:border-red-950/40 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg px-2"
                                >
                                  Delete
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* DATABASE MANAGEMENT WORKSPACE */}
          {activeTab === "db_maintenance" &&
            staffUser?.role === "Administrator" && (
              <div className="max-w-xl">
                <Card className="border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/30 backdrop-blur-md rounded-2xl shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base font-bold text-slate-950 dark:text-white flex items-center gap-1.5">
                      <Download className="h-5 w-5 text-blue-600 dark:text-blue-500" />
                      Database Maintenance
                    </CardTitle>
                    <CardDescription className="text-[11px] text-slate-555">
                      Export a full system state JSON snapshot.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Download a complete backup of the degrees registry,
                      student entries, staff accounts, timeline settings, and
                      the immutable audit trail log history.
                    </p>
                    <a
                      href="/api/admin/backup"
                      download
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-9 rounded-lg text-xs flex items-center justify-center gap-2 transition shadow shadow-blue-500/20"
                    >
                      <Download className="h-4 w-4" />
                      Export Database Backup
                    </a>
                  </CardContent>
                </Card>
              </div>
            )}

          {/* FACULTY & SESSION COORDINATOR WORKSPACE */}
          {activeTab === "faculties_sessions" &&
            staffUser?.role === "Administrator" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Faculty Manager Panel */}
                <Card className="border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/30 backdrop-blur-md rounded-2xl shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base font-bold text-slate-955 dark:text-white">
                      Faculty Manager
                    </CardTitle>
                    <CardDescription className="text-[11px] text-slate-555">
                      Configure university faculties parameter list.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <form onSubmit={handleAddFaculty} className="flex gap-2">
                      <Input
                        required
                        value={newFacultyName}
                        onChange={(e) => setNewFacultyName(e.target.value)}
                        placeholder="Faculty Name (e.g. Faculty of Technology)"
                        className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-900 text-slate-900 dark:text-slate-100 text-xs rounded-lg h-9 flex-1"
                      />
                      <Button
                        type="submit"
                        disabled={loading}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-9 text-xs rounded-lg px-3 shadow shrink-0"
                      >
                        Add Faculty
                      </Button>
                    </form>

                    <div className="max-h-64 overflow-y-auto border border-slate-100 dark:border-slate-900 rounded-xl divide-y divide-slate-100 dark:divide-slate-900">
                      {facultiesList.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-500 italic">
                          No faculties registered in system parameters.
                        </div>
                      ) : (
                        facultiesList.map((fac) => (
                          <div
                            key={fac.id}
                            className="flex items-center justify-between p-3 bg-white dark:bg-slate-950/20 text-xs"
                          >
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {fac.name}
                            </span>
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() =>
                                handleDeleteFaculty(fac.id, fac.name)
                              }
                              className="text-red-550 hover:text-red-655 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg p-1 h-7 text-[10px]"
                            >
                              Remove
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Session Coordinator Panel */}
                <Card className="border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/30 backdrop-blur-md rounded-2xl shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base font-bold text-slate-955 dark:text-white">
                      Session Coordinator
                    </CardTitle>
                    <CardDescription className="text-[11px] text-slate-555">
                      Configure graduation seating slots sessions.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <form onSubmit={handleAddSession} className="flex gap-2">
                      <Input
                        required
                        type="number"
                        min="1"
                        value={newSessionNumber}
                        onChange={(e) => setNewSessionNumber(e.target.value)}
                        placeholder="No. (e.g. 5)"
                        className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-900 text-slate-900 dark:text-slate-100 text-xs rounded-lg h-9 w-35"
                      />
                      <Input
                        value={newSessionName}
                        onChange={(e) => setNewSessionName(e.target.value)}
                        placeholder="Name (e.g. Session 5 - Afternoon)"
                        className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-900 text-slate-900 dark:text-slate-100 text-xs rounded-lg h-9 flex-1"
                      />
                      <Button
                        type="submit"
                        disabled={loading}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-9 text-xs rounded-lg px-3 shadow shrink-0"
                      >
                        Add Session
                      </Button>
                    </form>

                    <div className="max-h-64 overflow-y-auto border border-slate-100 dark:border-slate-900 rounded-xl divide-y divide-slate-100 dark:divide-slate-900">
                      {convocationSessions.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-500 italic">
                          No sessions registered in system parameters.
                        </div>
                      ) : (
                        convocationSessions.map((sess) => (
                          <div
                            key={sess.id}
                            className="flex items-center justify-between p-3 bg-white dark:bg-slate-950/20 text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span className="bg-blue-100 dark:bg-blue-955 text-blue-700 dark:text-blue-450 px-2 py-0.5 rounded text-[10px] font-black font-mono">
                                Num {sess.session_number}
                              </span>
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                {sess.session_name}
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() =>
                                handleDeleteSession(
                                  sess.id,
                                  sess.session_number,
                                )
                              }
                              className="text-red-500 hover:text-red-655 hover:bg-red-55 dark:hover:bg-red-950/20 rounded-lg p-1 h-7 text-[10px]"
                            >
                              Remove
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

          {/* SYSTEM AUDIT LOGS WORKSPACE */}
          {activeTab === "audit_logs" &&
            staffUser?.role === "Administrator" && (
              <Card className="border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/30 backdrop-blur-md rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base font-bold text-slate-955 dark:text-white">
                    System-wide Activity Audit Logs
                  </CardTitle>
                  <CardDescription className="text-[11px] text-slate-500">
                    Review logs of all student profiles, status overrides, and
                    administrative actions.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Logs filter inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 bg-slate-100/30 dark:bg-slate-950/20 p-4 rounded-xl border border-slate-200 dark:border-slate-900">
                    <div className="space-y-1">
                      <Label
                        htmlFor="logActor"
                        className="text-[9px] uppercase font-bold text-slate-500"
                      >
                        Actor (Admin)
                      </Label>
                      <Input
                        id="logActor"
                        type="text"
                        value={logSearchActor}
                        onChange={(e) => setLogSearchActor(e.target.value)}
                        placeholder="Search Actor..."
                        className="bg-white dark:bg-slate-950 text-xs h-8 rounded-lg"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label
                        htmlFor="logAction"
                        className="text-[9px] uppercase font-bold text-slate-500"
                      >
                        Action Type
                      </Label>
                      <Input
                        id="logAction"
                        type="text"
                        value={logSearchAction}
                        onChange={(e) => setLogSearchAction(e.target.value)}
                        placeholder="e.g. Approved, Rejected..."
                        className="bg-white dark:bg-slate-950 text-xs h-8 rounded-lg"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label
                        htmlFor="logStudent"
                        className="text-[9px] uppercase font-bold text-slate-500"
                      >
                        Student
                      </Label>
                      <Input
                        id="logStudent"
                        type="text"
                        value={logSearchQuery}
                        onChange={(e) => setLogSearchQuery(e.target.value)}
                        placeholder="Search Student..."
                        className="bg-white dark:bg-slate-950 text-xs h-8 rounded-lg"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label
                        htmlFor="logDateFrom"
                        className="text-[9px] uppercase font-bold text-slate-500"
                      >
                        From Date
                      </Label>
                      <Input
                        id="logDateFrom"
                        type="date"
                        value={logDateFrom}
                        onChange={(e) => setLogDateFrom(e.target.value)}
                        className="bg-white dark:bg-slate-950 text-xs h-8 rounded-lg"
                      />
                    </div>
                    <div className="space-y-1">
                      <div>
                        <Label
                          htmlFor="logDateTo"
                          className="text-[9px] uppercase font-bold text-slate-500 mt-1"
                        >
                          To Date
                        </Label>
                        <Input
                          id="logDateTo"
                          type="date"
                          value={logDateTo}
                          onChange={(e) => setLogDateTo(e.target.value)}
                          className="bg-white dark:bg-slate-950 text-xs h-8 rounded-lg"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Clear logs filter button */}
                  {(logSearchActor ||
                    logSearchQuery ||
                    logSearchAction ||
                    logDateFrom ||
                    logDateTo) && (
                    <div className="flex justify-end">
                      <Button
                        onClick={() => {
                          setLogSearchActor("");
                          setLogSearchQuery("");
                          setLogSearchAction("");
                          setLogDateFrom("");
                          setLogDateTo("");
                        }}
                        variant="outline"
                        size="sm"
                        className="text-[11px] h-7 px-3 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-955 font-semibold"
                      >
                        Reset Logs Filters
                      </Button>
                    </div>
                  )}

                  <div className="border border-slate-200 dark:border-slate-900 rounded-xl overflow-hidden overflow-x-auto">
                    <Table className="text-xs min-w-[800px]">
                      <TableHeader className="bg-slate-100 dark:bg-slate-800">
                        <TableRow className="border-b border-slate-200 dark:border-slate-900">
                          <TableHead className="text-slate-600 dark:text-white font-bold px-4 py-3 w-40">
                            Timestamp
                          </TableHead>
                          <TableHead className="text-slate-600 dark:text-white font-bold px-4 py-3 w-40">
                            Actor
                          </TableHead>
                          <TableHead className="text-slate-600 dark:text-white font-bold px-4 py-3">
                            Target Candidate
                          </TableHead>
                          <TableHead className="text-slate-600 dark:text-white font-bold px-4 py-3">
                            Action Recorded
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="divide-y divide-slate-200 dark:divide-slate-900 font-medium">
                        {filteredAuditLogs.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={4}
                              className="text-center py-8 text-slate-500"
                            >
                              No matching activity logs found.
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredAuditLogs.map((log) => (
                            <TableRow
                              key={log.id}
                              className="border-b border-slate-200 dark:border-slate-900 hover:bg-slate-100/30 dark:hover:bg-slate-900/10 transition-colors"
                            >
                              <TableCell className="px-4 py-2.5 text-slate-400 dark:text-slate-500 font-mono">
                                {new Date(log.timestamp).toLocaleString()}
                              </TableCell>
                              <TableCell className="px-4 py-2.5 font-bold text-slate-900 dark:text-white/50">
                                {log.admin_id}
                              </TableCell>
                              <TableCell className="px-4 py-2.5 text-slate-800 dark:text-slate-300">
                                {log.student_id ? (
                                  <>
                                    <div>{log.name_with_initials}</div>
                                    <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                                      {log.index_no} | {log.email}
                                    </div>
                                  </>
                                ) : (
                                  <span className="text-slate-400 dark:text-slate-500 italic">
                                    System Event
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="px-4 py-2.5 text-slate-600 dark:text-slate-400 font-semibold">
                                {log.action_taken}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

          {/* STUDENT REGISTRY WORKSPACE */}
          {activeTab === "registry" && (
            <div className="space-y-6">
              <Card className="border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/3 backdrop-blur-md rounded-2xl shadow-sm">
                <CardHeader className="flex flex-row items-start justify-between gap-4 pb-4">
                  <div>
                    <CardTitle className="text-base font-bold text-slate-950 dark:text-white">
                      Graduation Candidate Registry
                    </CardTitle>
                    <CardDescription className="text-[11px] text-slate-550 mt-1">
                      Comprehensive catalog of all student records for the
                      selected graduation cohort.
                    </CardDescription>
                  </div>
                  <Button
                    onClick={generateGraduationListDocx}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold h-9 px-4 rounded-xl flex items-center gap-2 shadow shadow-emerald-500/20 shrink-0"
                    disabled={filteredRegistryStudents.length === 0}
                  >
                    <Download className="h-4 w-4" />
                    Download Graduation List
                  </Button>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Registry Filters */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3 bg-slate-100/30 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-900">
                    <div className="space-y-1">
                      <Label
                        htmlFor="regYear"
                        className="text-[9px] uppercase font-bold text-slate-500"
                      >
                        Graduation Year
                      </Label>
                      <select
                        id="regYear"
                        value={registryYear}
                        onChange={(e) => setRegistryYear(e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 text-xs text-slate-800 dark:text-slate-100 px-3 py-1.5 rounded-lg focus:outline-none h-8 font-bold"
                      >
                        {yearOptions.map((y) => (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <Label
                        htmlFor="regFaculty"
                        className="text-[9px] uppercase font-bold text-slate-500"
                      >
                        Faculty
                      </Label>
                      <select
                        id="regFaculty"
                        value={registryFaculty}
                        onChange={(e) => {
                          setRegistryFaculty(e.target.value);
                          setRegistryDegree("");
                        }}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 text-xs text-slate-800 dark:text-slate-100 px-3 py-1.5 rounded-lg focus:outline-none h-8 font-bold"
                      >
                        <option value="">All Faculties</option>
                        {FACULTIES.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <Label
                        htmlFor="regDegree"
                        className="text-[9px] uppercase font-bold text-slate-500"
                      >
                        Degree
                      </Label>
                      <select
                        id="regDegree"
                        value={registryDegree}
                        onChange={(e) => setRegistryDegree(e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 text-xs text-slate-800 dark:text-slate-100 px-3 py-1.5 rounded-lg focus:outline-none h-8 font-bold"
                      >
                        <option value="">All Degrees</option>
                        {degrees
                          .filter(
                            (d) =>
                              !registryFaculty || d.faculty === registryFaculty,
                          )
                          .map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name_en}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <Label
                        htmlFor="regSession"
                        className="text-[9px] uppercase font-bold text-slate-500"
                      >
                        Session
                      </Label>
                      <select
                        id="regSession"
                        value={registrySession}
                        onChange={(e) => setRegistrySession(e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 text-xs text-slate-800 dark:text-slate-100 px-3 py-1.5 rounded-lg focus:outline-none h-8 font-bold"
                      >
                        <option value="">All Sessions</option>
                        {SESSIONS.map((s) => (
                          <option key={s} value={String(s)}>
                            Session {s}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <Label
                        htmlFor="regAtt"
                        className="text-[9px] uppercase font-bold text-slate-500"
                      >
                        Attendance
                      </Label>
                      <select
                        id="regAtt"
                        value={registryAttendance}
                        onChange={(e) => setRegistryAttendance(e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 text-xs text-slate-800 dark:text-slate-100  px-3 py-1.5 rounded-lg focus:outline-none h-8 font-bold"
                      >
                        <option value="">All Attendance</option>
                        <option value="true">Attending</option>
                        <option value="false">In Absentia</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <Label
                        htmlFor="regSearch"
                        className="text-[9px] uppercase font-bold text-slate-500"
                      >
                        Keyword Search
                      </Label>
                      <Input
                        id="regSearch"
                        type="text"
                        value={registrySearch}
                        onChange={(e) => setRegistrySearch(e.target.value)}
                        placeholder="Name, Index, Reg, NIC..."
                        className="bg-white dark:bg-slate-950 text-xs h-8 rounded-lg"
                      />
                    </div>
                  </div>

                  {/* Reset Filters button */}
                  {(registryFaculty ||
                    registryDegree ||
                    registrySession ||
                    registryAttendance ||
                    registrySearch ||
                    registryYear !== activeConvocationYear) && (
                    <div className="flex justify-end">
                      <Button
                        onClick={() => {
                          setRegistryFaculty("");
                          setRegistryDegree("");
                          setRegistrySession("");
                          setRegistryAttendance("");
                          setRegistrySearch("");
                          setRegistryYear(activeConvocationYear);
                        }}
                        variant="outline"
                        size="sm"
                        className="text-[11px] h-7 px-3 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-955 font-semibold"
                      >
                        Reset Registry Filters
                      </Button>
                    </div>
                  )}

                  {/* Registry Table */}
                  <div className="border border-slate-200 dark:border-slate-900 rounded-xl overflow-hidden overflow-x-auto">
                    <Table className="text-xs min-w-[1200px]">
                      <TableHeader className="bg-slate-100/50 dark:bg-slate-800">
                        <TableRow className="border-b border-slate-200 dark:border-slate-900">
                          <TableHead className="w-16 px-4 py-3 text-center font-bold">
                            Photo
                          </TableHead>
                          <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-4 py-3">
                            Candidate Details
                          </TableHead>
                          <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-4 py-3">
                            Degree & Faculty
                          </TableHead>
                          <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-4 py-3">
                            Certificate No
                          </TableHead>
                          <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-4 py-3">
                            Seating Info
                          </TableHead>
                          <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-4 py-3">
                            Verification & Attendance
                          </TableHead>
                          <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-4 py-3">
                            Corrections
                          </TableHead>
                          <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-4 py-3 text-center">
                            Receipt
                          </TableHead>
                          <TableHead className="text-slate-600 dark:text-slate-400 font-bold px-4 py-3 text-center">
                            Actions
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="divide-y divide-slate-200 dark:divide-slate-900 font-medium">
                        {filteredRegistryStudents.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={9}
                              className="text-center py-12 text-slate-500 italic"
                            >
                              No candidates matching filters found.
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredRegistryStudents.map((st) => (
                            <TableRow
                              key={st.id}
                              className="border-b border-slate-200 dark:border-slate-900 hover:bg-slate-100/30 dark:hover:bg-slate-900/10 transition-colors"
                            >
                              {/* Photo Thumbnail */}
                              <TableCell className="px-4 py-2.5 text-center">
                                {st.profile_photo_path ? (
                                  <div className="relative h-10 w-10 mx-auto rounded-full overflow-hidden border border-slate-250 dark:border-slate-800 bg-slate-100 dark:bg-slate-950">
                                    <img
                                      src={st.profile_photo_path}
                                      alt="Avatar"
                                      className="object-cover h-full w-full"
                                    />
                                  </div>
                                ) : (
                                  <div className="h-10 w-10 mx-auto rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[10px] text-slate-400 font-bold">
                                    N/A
                                  </div>
                                )}
                              </TableCell>
                              {/* Candidate Details */}
                              <TableCell className="px-4 py-2.5">
                                <div className="font-bold text-slate-800 dark:text-white">
                                  {st.name_with_initials}
                                </div>
                                <div className="text-[10px] text-slate-550 dark:text-slate-400 font-mono mt-0.5">
                                  Index: {st.index_no || "-"} | Reg:{" "}
                                  {st.registration_no} | NIC: {st.nic_no}
                                </div>
                              </TableCell>
                              {/* Degree & Faculty */}
                              <TableCell className="px-4 py-2.5">
                                <div className="text-slate-800 dark:text-slate-200">
                                  {st.degree_name_en || "N/A"}
                                </div>
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                  {st.faculty}
                                </div>
                              </TableCell>
                              {/* Certificate No */}
                              <TableCell className="px-4 py-2.5 font-mono font-black text-blue-600 dark:text-blue-400 text-xs">
                                {st.certificate_number}
                              </TableCell>
                              {/* Seating Info */}
                              <TableCell className="px-4 py-2.5 font-mono font-bold text-slate-700 dark:text-slate-350">
                                Session {st.session_number} | Seat {st.seat_number !== null && st.seat_number !== undefined ? st.seat_number : "-"}
                              </TableCell>
                              {/* Verification & Attendance */}
                              <TableCell className="px-4 py-2.5 space-y-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      st.verification_status === "Approved"
                                        ? "bg-emerald-500/10 text-emerald-650 dark:text-emerald-400 border border-emerald-250/20"
                                        : st.verification_status ===
                                            "Name Correction Requested"
                                          ? "bg-yellow-500/10 text-yellow-650 dark:text-yellow-400 border border-yellow-250/20"
                                          : "bg-blue-500/10 text-blue-650 dark:text-blue-400 border border-blue-250/20"
                                    }`}
                                  >
                                    {st.verification_status}
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      st.attending_convocation === true
                                        ? "bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 border border-indigo-250/20"
                                        : st.attending_convocation === false
                                          ? "bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800"
                                          : "bg-amber-500/10 text-amber-650 dark:text-amber-400 border border-amber-250/20"
                                    }`}
                                  >
                                    {st.attending_convocation === true
                                      ? "Attending"
                                      : st.attending_convocation === false
                                        ? "In Absentia"
                                        : "No Response"}
                                  </span>
                                </div>
                              </TableCell>
                              {/* Corrections */}
                              <TableCell className="px-4 py-2.5">
                                {st.name_correction_request ? (
                                  <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 px-2 py-1 rounded text-[10px] text-blue-755 dark:text-blue-400 font-bold max-w-[200px] break-words">
                                    {st.name_correction_request}
                                  </div>
                                ) : (
                                  <span className="text-slate-450 dark:text-slate-550 italic">
                                    None
                                  </span>
                                )}
                              </TableCell>
                              {/* Receipt / Slip */}
                              <TableCell className="px-4 py-2.5 text-center">
                                {st.payment_slip_path ? (
                                  <a
                                    href={st.payment_slip_path}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center justify-center p-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900 transition"
                                    title="View Payment Slip"
                                  >
                                    <FileText className="h-4 w-4" />
                                  </a>
                                ) : (
                                  <span className="text-slate-400 dark:text-slate-600 italic">
                                    None
                                  </span>
                                )}
                              </TableCell>
                               {/* Generate Letter Action */}
                               <TableCell className="px-4 py-2.5 text-center">
                                 <Button
                                   size="xs"
                                   onClick={() => {
                                     setVerLetterStudent(st);
                                     setVerLetterStep("form");
                                     setVerLetterPdfBlob(null);
                                     setVerLetterInputs({ yourNumber: "", ourRef: "", myNumber: "", fileNumber: "", refLetterDate: "", addressee: "", staffName: "" });
                                   }}
                                   className="h-7 text-[10px] px-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-bold flex items-center gap-1 shadow shadow-violet-500/20 mx-auto"
                                 >
                                   <FileText className="h-3.5 w-3.5" />
                                   Generate Letter
                                 </Button>
                               </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ── VERIFICATION LETTER MODAL ── */}
          {verLetterStudent && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setVerLetterStudent(null)}>
              <div
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">Verification Letter</h2>
                    <p className="text-[11px] text-slate-500 mt-0.5">{verLetterStudent.full_name || verLetterStudent.name_with_initials}</p>
                  </div>
                  <button
                    onClick={() => setVerLetterStudent(null)}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Step: Form */}
                {verLetterStep === "form" && (
                  <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-slate-500">Your Number</Label>
                        <Input
                          value={verLetterInputs.yourNumber}
                          onChange={(e) => setVerLetterInputs((p) => ({ ...p, yourNumber: e.target.value }))}
                          placeholder="e.g. AR/123/2024"
                          className="h-8 text-xs rounded-lg bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-900"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-slate-500">Our Ref</Label>
                        <Input
                          value={verLetterInputs.ourRef}
                          onChange={(e) => setVerLetterInputs((p) => ({ ...p, ourRef: e.target.value }))}
                          placeholder="e.g. REG/VER/2024"
                          className="h-8 text-xs rounded-lg bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-900"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-slate-500">My Number</Label>
                        <Input
                          value={verLetterInputs.myNumber}
                          onChange={(e) => setVerLetterInputs((p) => ({ ...p, myNumber: e.target.value }))}
                          placeholder="Your reference number"
                          className="h-8 text-xs rounded-lg bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-900"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-slate-500">File Number</Label>
                        <Input
                          value={verLetterInputs.fileNumber}
                          onChange={(e) => setVerLetterInputs((p) => ({ ...p, fileNumber: e.target.value }))}
                          placeholder="e.g. FILE/2024/001"
                          className="h-8 text-xs rounded-lg bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-900"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold text-slate-500">Date of Requestee's Letter</Label>
                      <Input
                        value={verLetterInputs.refLetterDate}
                        onChange={(e) => setVerLetterInputs((p) => ({ ...p, refLetterDate: e.target.value }))}
                        placeholder="e.g. 10th January 2024"
                        className="h-8 text-xs rounded-lg bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-900"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold text-slate-500">Address of requestee</Label>
                      <textarea
                        value={verLetterInputs.addressee}
                        onChange={(e) => setVerLetterInputs((p) => ({ ...p, addressee: e.target.value }))}
                        placeholder={"The Secretary\nMinistry of Education\nColombo 07"}
                        rows={4}
                        className="w-full text-xs rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold text-slate-500">Staff Member Name (Deputy Registrar)</Label>
                      <Input
                        value={verLetterInputs.staffName}
                        onChange={(e) => setVerLetterInputs((p) => ({ ...p, staffName: e.target.value }))}
                        placeholder="e.g. W.M.P. Wickramasinghe"
                        className="h-8 text-xs rounded-lg bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-900"
                      />
                    </div>

                    {/* Student Data Preview */}
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-4 space-y-2">
                      <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Student Data (auto-filled)</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        {[
                          ["Name in Full", verLetterStudent.name_with_initials],
                          ["Degree", verLetterStudent.degree_name_en],
                          ["Reg. No.", verLetterStudent.registration_no],
                          ["Index No.", verLetterStudent.index_no],
                          ["Certificate No.", verLetterStudent.certificate_number],
                          ["GPA & Class", `${verLetterStudent.gpa ? Number(verLetterStudent.gpa).toFixed(2) : "-"} — ${verLetterStudent.class || "-"}`],
                        ].map(([label, val]) => (
                          <div key={label as string} className="flex gap-1">
                            <span className="font-bold text-slate-600 dark:text-slate-400 shrink-0">{label}:</span>
                            <span className="text-slate-800 dark:text-slate-200 break-all">{(val as string) || "-"}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <Button
                        variant="outline"
                        onClick={() => setVerLetterStudent(null)}
                        className="text-xs h-9 px-4 rounded-xl border-slate-200 dark:border-slate-800"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={async () => {
                          setVerLetterGenerating(true);
                          try {
                            const blob = await generateVerificationLetterPDF(verLetterStudent, verLetterInputs);
                            setVerLetterPdfBlob(blob);
                            setVerLetterStep("preview");
                          } catch (err) {
                            console.error("Letter generation failed:", err);
                            setErrorMsg("Failed to generate verification letter.");
                          } finally {
                            setVerLetterGenerating(false);
                          }
                        }}
                        disabled={verLetterGenerating}
                        className="bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs h-9 px-5 rounded-xl flex items-center gap-2 shadow shadow-violet-500/20"
                      >
                        {verLetterGenerating ? (
                          <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating...</>
                        ) : (
                          <><FileText className="h-3.5 w-3.5" /> Generate Letter</>
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Step: Preview */}
                {verLetterStep === "preview" && verLetterPdfBlob && (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 min-h-[500px]">
                      <iframe
                        src={URL.createObjectURL(verLetterPdfBlob)}
                        className="w-full h-full min-h-[500px]"
                        title="Verification Letter Preview"
                      />
                    </div>
                    <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
                      <Button
                        variant="outline"
                        onClick={() => setVerLetterStep("form")}
                        className="text-xs h-9 px-4 rounded-xl border-slate-200 dark:border-slate-800"
                      >
                        ← Back to Edit
                      </Button>
                      <Button
                        onClick={() => {
                          if (!verLetterPdfBlob) return;
                          const url = URL.createObjectURL(verLetterPdfBlob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `Verification_Letter_${verLetterStudent.registration_no || verLetterStudent.index_no}.pdf`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 px-5 rounded-xl flex items-center gap-2 shadow shadow-emerald-500/20"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download PDF
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Bulk Degree Ingestion Staging Dialog Modal */}
      {showDegreeStagingModal && degreeStagingResults.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 w-full max-w-5xl max-h-[90vh] rounded-3xl relative shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-950 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <Upload className="h-5 w-5 text-blue-500 animate-pulse" />
                    Degree Ingestion Staging Preview
                  </CardTitle>
                  <CardDescription className="text-[10px] text-slate-500 mt-1">
                    Review parsed degree row validation before database
                    execution.
                  </CardDescription>
                </div>
                <button
                  onClick={() => setShowDegreeStagingModal(false)}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition"
                  title="Close Preview"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-6">
              {renderDegreeStagingGrid(true)}
            </CardContent>
          </Card>
        </div>
      )}

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

      {/* Edit Degree Modal */}
      {editingDegree && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl relative shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold text-slate-950 dark:text-white">
                  Edit Degree Details
                </CardTitle>
                <button
                  type="button"
                  onClick={() => setEditingDegree(null)}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleUpdateDegree} className="space-y-4">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    Faculty
                  </span>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {editingDegree.faculty}
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    Degree No
                  </span>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {editingDegree.degree_no}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="editEn"
                    className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400"
                  >
                    Degree Name (English)
                  </Label>
                  <Input
                    id="editEn"
                    required
                    value={editEn}
                    onChange={(e) => setEditEn(e.target.value)}
                    className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 text-xs rounded-lg h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="editSi"
                    className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400"
                  >
                    Degree Name (Sinhala)
                  </Label>
                  <Input
                    id="editSi"
                    required
                    value={editSi}
                    onChange={(e) => setEditSi(e.target.value)}
                    className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 text-xs rounded-lg h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="editTa"
                    className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400"
                  >
                    Degree Name (Tamil)
                  </Label>
                  <Input
                    id="editTa"
                    required
                    value={editTa}
                    onChange={(e) => setEditTa(e.target.value)}
                    className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 text-xs rounded-lg h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="editType"
                    className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400"
                  >
                    Degree Type
                  </Label>
                  <select
                    id="editType"
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as any)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 text-xs text-slate-800 dark:text-slate-100 px-3 py-2 rounded-lg focus:outline-none h-9"
                  >
                    <option value="Internal">Internal</option>
                    <option value="External">External</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditingDegree(null)}
                    className="border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-950 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold h-9"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-9 text-xs rounded-lg px-4"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Save Changes"
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
      {/* Add Degree Pop-up Modal */}
      {showAddDegreeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
            <button
              onClick={() => setShowAddDegreeModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
            <CardHeader className="p-0 pb-4">
              <CardTitle className="text-base font-bold text-slate-950 dark:text-white">
                Add University Degree
              </CardTitle>
              <CardDescription className="text-[11px] text-slate-500">
                Official multi-lingual metadata registry.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <form
                onSubmit={async (e) => {
                  await handleAddDegree(e);
                  setShowAddDegreeModal(false);
                }}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <Label
                    htmlFor="degFaculty"
                    className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-"
                  >
                    Faculty
                  </Label>
                  <select
                    id="degFaculty"
                    value={degFaculty}
                    onChange={(e) => setDegFaculty(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 text-xs text-slate-800 dark:text-slate-350 px-3 py-2 rounded-lg focus:outline-none h-9"
                  >
                    {FACULTIES.map((fac) => (
                      <option key={fac} value={fac}>
                        {fac}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">
                    Degree No
                  </Label>
                  <div className="p-3 bg-slate-100/50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-900 rounded-xl">
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      {degNo}
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="degEn"
                    className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400"
                  >
                    Degree Name (English)
                  </Label>
                  <Input
                    id="degEn"
                    required
                    value={degEn}
                    onChange={(e) => setDegEn(e.target.value)}
                    placeholder="BSc in Computer Science"
                    className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 text-xs rounded-lg h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="degSi"
                    className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400"
                  >
                    Degree Name (Sinhala)
                  </Label>
                  <Input
                    id="degSi"
                    required
                    value={degSi}
                    onChange={(e) => setDegSi(e.target.value)}
                    placeholder="පරිගණක විද්‍යා උපාධිය"
                    className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 text-xs rounded-lg h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="degTa"
                    className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400"
                  >
                    Degree Name (Tamil)
                  </Label>
                  <Input
                    id="degTa"
                    required
                    value={degTa}
                    onChange={(e) => setDegTa(e.target.value)}
                    placeholder="கணினி அறிவியல் பட்டம்"
                    className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 text-xs rounded-lg h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="degType"
                    className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400"
                  >
                    Degree Type
                  </Label>
                  <select
                    id="degType"
                    value={degType}
                    onChange={(e) => setDegType(e.target.value as any)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 text-xs text-slate-800 dark:text-slate-100 px-3 py-2 rounded-lg focus:outline-none h-9"
                  >
                    <option value="Internal">Internal</option>
                    <option value="External">External</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAddDegreeModal(false)}
                    className="border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-950 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold h-9"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-9 text-xs rounded-lg px-4"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Register Degree"
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-900 py-6 text-center text-xs text-slate-500 dark:text-slate-600 mt-12 transition-colors duration-200">
        © {new Date().getFullYear()} Exam Division. Rajarata University of Sri
        Lanka. All Rights Reserved.
      </footer>
    </div>
  );
}
