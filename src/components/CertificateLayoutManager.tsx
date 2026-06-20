"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { Loader2, Save, RotateCcw, GripVertical, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight } from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type CertView = "internal-front" | "internal-back" | "external-front" | "external-back";

export interface CertLineConfig {
  id: string;
  text: string;
  yOffsetPx: number; // vertical offset from default position in canvas px
  fontSize: number;  // in px (canvas scale)
  fontFamily: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  superscript: boolean;
  subscript: boolean;
  alignment: "left" | "center" | "right";
  color?: string;
  editable?: boolean; // false = static label (not editable by staff)
}

export interface CertLayoutLines {
  internalFront: CertLineConfig[];
  externalFront: CertLineConfig[];
  internalBack: CertLineConfig[];
  externalBack: CertLineConfig[];
}

// ─── Default fonts ──────────────────────────────────────────────────────────────

const AVAILABLE_FONTS = [
  { label: "Times New Roman", value: "Times New Roman, Times, serif" },
  { label: "Lucida Calligraphy", value: "Lucida Calligraphy, cursive" },
  { label: "Monotype Corsiva", value: "Monotype Corsiva, cursive" },
  { label: "Abhaya Libre (Sinhala)", value: "Abhaya Libre, serif" },
  { label: "Pavanam (Tamil)", value: "Pavanam, sans-serif" },
];

// ─── Default line configs ───────────────────────────────────────────────────────

const mkLine = (
  id: string,
  text: string,
  opts: Partial<CertLineConfig> = {}
): CertLineConfig => ({
  id,
  text,
  yOffsetPx: 0,
  fontSize: 9,
  fontFamily: "Times New Roman, Times, serif",
  bold: false,
  italic: false,
  underline: false,
  superscript: false,
  subscript: false,
  alignment: "center",
  color: "#1e293b",
  editable: true,
  ...opts,
});

const mkSiLine = (id: string, text: string, opts: Partial<CertLineConfig> = {}): CertLineConfig =>
  mkLine(id, text, { fontFamily: "Abhaya Libre, serif", fontSize: 8, ...opts });

const mkTaLine = (id: string, text: string, opts: Partial<CertLineConfig> = {}): CertLineConfig =>
  mkLine(id, text, { fontFamily: "Pavanam, sans-serif", fontSize: 7.5, ...opts });

// Front page lines (shared structure, "internal"/"external" affects preamble only)
const buildFrontLines = (isInternal: boolean): CertLineConfig[] => [
  mkLine("f-logo-space", "[University Logo — Pre-printed on paper]", {
    fontSize: 7, color: "#94a3b8", editable: false, italic: true
  }),
  mkLine("f-univ", "RAJARATA UNIVERSITY OF SRI LANKA", {
    bold: true, fontSize: 20, fontFamily: "Times New Roman, Times, serif",
    color: "#7c5c35", alignment: "center"
  }),
  mkLine("f-preamble", isInternal
    ? "Having successfully completed the prescribed\ncourses of study and the examinations\nof this university as an internal candidate"
    : "Having successfully completed the prescribed\ncourses of study and the examinations\nof this university as an external candidate",
    { fontSize: 12, fontFamily: "Lucida Calligraphy, cursive", italic: true, alignment: "center" }
  ),
  mkLine("f-student-name", "K.A.D. THARINDU SHYAMAN SENARATHNE", {
    bold: true, fontSize: 13, fontFamily: "Monotype Corsiva, cursive", alignment: "center"
  }),
  mkLine("f-admitted", "was admitted to the degree of", { fontSize: 12, fontFamily: "Lucida Calligraphy, cursive", alignment: "center" }),
  mkLine("f-degree", "BACHELOR OF SCIENCE IN INFORMATION TECHNOLOGY", {
    bold: true, fontSize: 11, fontFamily: "Times New Roman, Times, serif", color: "#7c5c35", alignment: "center"
  }),
  mkLine("f-on", "on", { fontSize: 12, fontFamily: "Lucida Calligraphy, cursive", alignment: "center" }),
  mkLine("f-date-digital", "15th January 2023", {
    bold: true, fontSize: 9, fontFamily: "Times New Roman, Times, serif", italic: true, alignment: "center"
  }),
  mkLine("f-and", "and", { fontSize: 12, fontFamily: "Lucida Calligraphy, cursive", italic: true, alignment: "center" }),
  mkLine("f-conv", "was conferred this degree at the", { fontSize: 12, fontFamily: "Lucida Calligraphy, cursive", italic: true, alignment: "center" }),
  mkLine("f-convocation", "CONVOCATION", { bold: true, fontSize: 12, fontFamily: "Times New Roman, Times, serif", italic: true, alignment: "center" }),
  mkLine("f-held-on", "held on", { fontSize: 12, fontFamily: "Lucida Calligraphy, cursive", italic: true, alignment: "center" }),
  mkLine("f-date-verbal", "Twenty Seventh Day of July in the Year Two Thousand Twenty Three", {
    bold: true, fontSize: 12, fontFamily: "Monotype Corsiva, cursive", italic: true, alignment: "center"
  }),
  mkLine("f-seal-space", "[University Seal — Pre-printed on paper]", {
    fontSize: 7, color: "#94a3b8", editable: false, italic: true
  }),
  mkLine("f-reg-name", "S.C. Herath", { fontSize: 8, fontFamily: "Times New Roman, Times, serif", alignment: "left" }),
  mkLine("f-reg-title", "Registrar", { fontSize: 7, fontFamily: "Times New Roman, Times, serif", alignment: "left" }),
  mkLine("f-vc-name", "Dr. P.H.J. Pushpakumara", { fontSize: 8, fontFamily: "Times New Roman, Times, serif", alignment: "right" }),
  mkLine("f-vc-title", "Acting Vice Chancellor", { fontSize: 7, fontFamily: "Times New Roman, Times, serif", alignment: "right" }),
];

// Back page lines
const buildBackLines = (isInternal: boolean): CertLineConfig[] => [
  // Barcode placeholder (top-right, non-editable)
  mkLine("b-barcode", "[Barcode — Certificate No.]", {
    fontSize: 7, color: "#94a3b8", editable: false, alignment: "right", italic: true
  }),

  // Sinhala section
  mkSiLine("b-si-univ", "ශ්‍රී ලංකා රජරට විශ්වවිද්‍යාලය", {
    bold: true, fontSize: 11, alignment: "center", color: "#1e293b"
  }),
  mkSiLine("b-si-preamble", isInternal
    ? "මෙම විශ්වවිද්‍යාලයේ අභ්‍යන්තර අපේක්ෂකයෙකු ලෙස\nනියමිත අධ්‍යයන පාඨමාලා සහ පරීක්ෂණ සාර්ථක ලෙස නිම කිරීමෙන් පසු\nමෙහි පසු පිටේ නම සඳහන් අය වෙත"
    : "මෙම විශ්වවිද්‍යාලයේ බාහිර අපේක්ෂකයෙකු ලෙස\nනියමිත අධ්‍යයන පාඨමාලා සහ පරීක්ෂණ සාර්ථක\nලෙස නිම කිරීමෙන් පසු මෙහි පසු පිටේ නම\nසඳහන් අය වෙත",
    { alignment: "center" }
  ),
  mkSiLine("b-si-date", "2023 ජූලි මස 27 වන දින", { alignment: "center", italic: true }),
  mkSiLine("b-si-conv", "උපාධි ප්‍රදානෝත්සවය", { alignment: "center" }),
  mkSiLine("b-si-date2", "2023 ජූලි 27", { alignment: "center", italic: true }),
  mkSiLine("b-si-degree", "තොරතුරු තාක්‍ෂණ විද්‍යාවේදී උපාධිය", {
    bold: true, fontSize: 9, alignment: "center", color: "#7c5c35"
  }),
  mkSiLine("b-si-suffix", "පිරිනමන ලද බව මෙයින් සහතික කරමු.", { alignment: "center" }),
  // Sinhala signatures (2 columns)
  mkSiLine("b-si-reg-name", "එස්.සී. හේරත්", { alignment: "left", fontSize: 8 }),
  mkSiLine("b-si-reg-title", "ලේඛකාධිකාරි", { alignment: "left", fontSize: 7 }),
  mkSiLine("b-si-vc-name", "වෛද්‍ය පී.එච්.ජේ. පුෂ්පකුමාර", { alignment: "right", fontSize: 8 }),
  mkSiLine("b-si-vc-title", "වැඩ බලන උපකුලපති", { alignment: "right", fontSize: 7 }),

  // Tamil section
  mkTaLine("b-ta-univ", "இலங்கை ரஜராஜ பல்கலைக்கழகம்", {
    bold: true, fontSize: 10, alignment: "center", color: "#1e293b"
  }),
  mkTaLine("b-ta-preamble", isInternal
    ? "இப்பல்கலைக்கழகத்தில் குறிப்பிட்ட உள்வாரி கற்கை நெறிகளையும்"
    : "இப்பல்கலைக்கழகத்தில் குறிப்பிட்ட உள்வாரி கற்கை நெறிகளையும்",
    { alignment: "center" }
  ),
  mkTaLine("b-ta-date1", "27 ஜூலை 2023", { alignment: "center", italic: true }),
  mkTaLine("b-ta-cont", "நிறைவு செய்ததன் பின்னர், இச்சான்றிதழின்", { alignment: "center" }),
  mkTaLine("b-ta-degree", "தகவல் தொழில்நுட்ப அறிவியல் இளங்கலை பட்டம்", {
    bold: true, fontSize: 8.5, alignment: "center", color: "#7c5c35"
  }),
  mkTaLine("b-ta-date2", "27 ஜூலை 2023", { alignment: "center", italic: true }),
  mkTaLine("b-ta-cont2", "பரீட்சைகளையும் வெற்றிகரமாக மறுபக்கத்தில் பெயர் குறிப்பிடப்பட்டுள்ளவருக்கு", {
    alignment: "center"
  }),
  mkTaLine("b-ta-suffix", "வழங்கப்பட்டதென இத்தால்\nஉறுதிப்படுத்துகின்றோம்.", { alignment: "center" }),
  // Tamil signatures
  mkTaLine("b-ta-reg-name", "எஸ்.சி.ஹேரத்", { alignment: "left", fontSize: 7.5 }),
  mkTaLine("b-ta-reg-title", "பதிவாளர்", { alignment: "left", fontSize: 7 }),
  mkTaLine("b-ta-vc-name", "வைத்தியர் பி.எச்.ஜி.ஜே. புஷ்பகுமார", { alignment: "right", fontSize: 7.5 }),
  mkTaLine("b-ta-vc-title", "பதில் உபவேந்தர்", { alignment: "right", fontSize: 7 }),
];

export const DEFAULT_CERT_LINES: CertLayoutLines = {
  internalFront: buildFrontLines(true),
  externalFront: buildFrontLines(false),
  internalBack: buildBackLines(true),
  externalBack: buildBackLines(false),
};



// ─── CertLine component (a single draggable, editable line) ────────────────────

interface CertLineProps {
  line: CertLineConfig;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updated: Partial<CertLineConfig>) => void;
  onDragStart: (e: React.MouseEvent, id: string) => void;
}

const CertLine: React.FC<CertLineProps> = ({ line, isSelected, onSelect, onUpdate, onDragStart }) => {
  const textAlign = line.alignment === "left" ? "text-left" : line.alignment === "right" ? "text-right" : "text-center";
  const lineStyle: React.CSSProperties = {
    fontFamily: line.fontFamily,
    fontSize: `${line.fontSize}px`,
    fontWeight: line.bold ? "bold" : "normal",
    fontStyle: line.italic ? "italic" : "normal",
    textDecoration: line.underline ? "underline" : "none",
    color: line.color || "#1e293b",
    transform: `translateY(${line.yOffsetPx}px)`,
    lineHeight: "1.3",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    textRendering: "optimizeLegibility" as any,
    userSelect: "none",
    WebkitFontSmoothing: "antialiased",
    letterSpacing: "normal",
  };

  const verticalSupSub: React.CSSProperties =
    line.superscript ? { verticalAlign: "super", fontSize: "0.7em" }
    : line.subscript ? { verticalAlign: "sub", fontSize: "0.7em" }
    : {};

  return (
    <div
      className={`relative group flex items-start gap-1 cursor-pointer transition-all ${isSelected ? "ring-1 ring-blue-500 rounded bg-blue-50/30 dark:bg-blue-950/20" : "hover:bg-slate-50/50 dark:hover:bg-slate-900/20 hover:rounded"}`}
      style={{ marginBottom: "1px" }}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
    >
      {/* Drag handle */}
      <div
        className={`shrink-0 flex items-center cursor-ns-resize px-0.5 py-1 transition-opacity ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-60"}`}
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onDragStart(e, line.id); }}
        title="Drag to move line up/down"
      >
        <GripVertical className="h-3 w-3 text-slate-400" />
      </div>

      {/* Text content */}
      <div className={`flex-1 w-full ${textAlign} py-0.5 pr-1`} style={lineStyle}>
        <span style={verticalSupSub}>{line.text}</span>
      </div>
    </div>
  );
};

// ─── Formatting toolbar ─────────────────────────────────────────────────────────

interface FormattingToolbarProps {
  line: CertLineConfig | null;
  onUpdate: (updated: Partial<CertLineConfig>) => void;
  onClose: () => void;
}

const FormattingToolbar: React.FC<FormattingToolbarProps> = ({ line, onUpdate, onClose }) => {
  if (!line) return null;

  const ToolBtn: React.FC<{ active?: boolean; onClick: () => void; title: string; children: React.ReactNode }> = ({ active, onClick, title, children }) => (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`h-7 w-7 flex items-center justify-center rounded text-xs font-bold transition-colors ${active ? "bg-blue-600 text-white" : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700"}`}
    >
      {children}
    </button>
  );

  return (
    <div
      className="absolute left-0 right-0 bottom-full mb-2 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl p-2 flex flex-wrap gap-1.5 items-center"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Text editing — editable lines only */}
      {line.editable !== false && (
        <input
          value={line.text}
          onChange={(e) => onUpdate({ text: e.target.value })}
          className="flex-1 min-w-[140px] max-w-[280px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] rounded-lg px-2 h-7 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Edit text..."
          style={{ fontFamily: line.fontFamily }}
        />
      )}

      <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />

      {/* Bold / Italic / Underline */}
      <ToolBtn active={line.bold} onClick={() => onUpdate({ bold: !line.bold })} title="Bold">
        <Bold className="h-3 w-3" />
      </ToolBtn>
      <ToolBtn active={line.italic} onClick={() => onUpdate({ italic: !line.italic })} title="Italic">
        <Italic className="h-3 w-3" />
      </ToolBtn>
      <ToolBtn active={line.underline} onClick={() => onUpdate({ underline: !line.underline })} title="Underline">
        <Underline className="h-3 w-3" />
      </ToolBtn>
      <ToolBtn active={line.superscript} onClick={() => onUpdate({ superscript: !line.superscript, subscript: false })} title="Superscript">
        X²
      </ToolBtn>
      <ToolBtn active={line.subscript} onClick={() => onUpdate({ subscript: !line.subscript, superscript: false })} title="Subscript">
        X₂
      </ToolBtn>

      <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />

      {/* Alignment */}
      <ToolBtn active={line.alignment === "left"} onClick={() => onUpdate({ alignment: "left" })} title="Align Left">
        <AlignLeft className="h-3 w-3" />
      </ToolBtn>
      <ToolBtn active={line.alignment === "center"} onClick={() => onUpdate({ alignment: "center" })} title="Align Center">
        <AlignCenter className="h-3 w-3" />
      </ToolBtn>
      <ToolBtn active={line.alignment === "right"} onClick={() => onUpdate({ alignment: "right" })} title="Align Right">
        <AlignRight className="h-3 w-3" />
      </ToolBtn>

      <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />

      {/* Font size */}
      <div className="flex items-center gap-1">
        <span className="text-[9px] text-slate-500 font-bold uppercase">Size</span>
        <input
          type="number"
          min="5"
          max="36"
          value={line.fontSize}
          onChange={(e) => onUpdate({ fontSize: Number(e.target.value) })}
          className="w-14 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] rounded-lg px-1.5 h-7 text-center text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <span className="text-[9px] text-slate-400">px</span>
      </div>

      {/* Font family */}
      <select
        value={line.fontFamily}
        onChange={(e) => onUpdate({ fontFamily: e.target.value })}
        className="h-7 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[10px] rounded-lg px-1.5 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-[150px]"
      >
        {AVAILABLE_FONTS.map((f) => (
          <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
            {f.label}
          </option>
        ))}
      </select>

      <button
        onClick={onClose}
        className="ml-auto h-6 w-6 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs rounded"
      >
        ✕
      </button>
    </div>
  );
};

// ─── Certificate Canvas ─────────────────────────────────────────────────────────

interface CertCanvasProps {
  view: CertView;
  lines: CertLineConfig[];
  onUpdateLine: (id: string, updates: Partial<CertLineConfig>) => void;
  certNumber?: string;
}

const CertCanvas: React.FC<CertCanvasProps> = ({ view, lines, onUpdateLine, certNumber = "001542" }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragStartOffset, setDragStartOffset] = useState(0);
  const canvasRef = useRef<HTMLDivElement>(null);

  const isFront = view === "internal-front" || view === "external-front";

  const selectedLine = lines.find((l) => l.id === selectedId) ?? null;

  const handleDragStart = useCallback((e: React.MouseEvent, id: string) => {
    const line = lines.find((l) => l.id === id);
    if (!line) return;
    setDraggingId(id);
    setDragStartY(e.clientY);
    setDragStartOffset(line.yOffsetPx);
  }, [lines]);

  useEffect(() => {
    if (!draggingId) return;
    const handleMove = (e: MouseEvent) => {
      const delta = e.clientY - dragStartY;
      onUpdateLine(draggingId, { yOffsetPx: dragStartOffset + delta });
    };
    const handleUp = () => setDraggingId(null);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [draggingId, dragStartY, dragStartOffset, onUpdateLine]);

  const getLine = (id: string) => lines.find((l) => l.id === id);

  return (
    <div className="relative" ref={canvasRef}>
      {/* Formatting toolbar */}
      {selectedLine && (
        <div className="relative z-50 mb-2">
          <FormattingToolbar
            line={selectedLine}
            onUpdate={(upd) => onUpdateLine(selectedLine.id, upd)}
            onClose={() => setSelectedId(null)}
          />
        </div>
      )}

      {/* The certificate */}
      <div
        className="w-[480px] bg-[#fefdf9] border-[6px] border-double border-[#8b7355] rounded-lg shadow-2xl relative overflow-hidden select-none"
        style={{ backgroundImage: "radial-gradient(rgba(139,115,85,0.025) 1px, transparent 0)", backgroundSize: "8px 8px", minHeight: isFront ? "670px" : "680px" }}
        onClick={() => setSelectedId(null)}
      >
        {/* Inner decorative border */}
        <div className="absolute inset-1.5 border border-[#8b7355]/15 pointer-events-none rounded" />

        {isFront ? (
          /* ─── FRONT PAGE ─────────────────────────────── */
          <div className="px-10 py-6 space-y-0.5">
            {/* University crest placeholder (pre-printed) */}
            <div className="flex justify-center mb-2 mt-1">
              <div className="w-16 h-16 rounded-full border-2 border-dashed border-[#8b7355]/30 flex items-center justify-center">
                <span className="text-[8px] text-slate-300 font-bold text-center leading-tight">PRE-PRINTED<br/>LOGO</span>
              </div>
            </div>

            {/* Editable lines: university name, preamble, etc. */}
            {["f-univ", "f-preamble", "f-student-name", "f-admitted", "f-degree", "f-on", "f-date-digital", "f-and", "f-conv", "f-convocation", "f-held-on", "f-date-verbal"].map((lid) => {
              const l = getLine(lid);
              if (!l) return null;
              return (
                <CertLine
                  key={l.id}
                  line={l}
                  isSelected={selectedId === l.id}
                  onSelect={() => setSelectedId(l.id)}
                  onUpdate={(upd) => onUpdateLine(l.id, upd)}
                  onDragStart={handleDragStart}
                />
              );
            })}

            {/* Seal placeholder (pre-printed) */}
            <div className="flex justify-center my-3">
              <div className="w-14 h-14 rounded-full border-2 border-dashed border-red-400/20 flex items-center justify-center">
                <span className="text-[7px] text-red-400/30 font-black tracking-widest">SEAL</span>
              </div>
            </div>

            {/* Signatures row */}
            <div className="flex justify-between items-end pt-2 border-t border-slate-200/50">
              <div className="w-32">
                <div className="h-5 border-b border-dashed border-slate-300 mb-1" />
                {["f-reg-name", "f-reg-title"].map((lid) => {
                  const l = getLine(lid);
                  if (!l) return null;
                  return (
                    <CertLine key={l.id} line={l} isSelected={selectedId === l.id}
                      onSelect={() => setSelectedId(l.id)}
                      onUpdate={(upd) => onUpdateLine(l.id, upd)}
                      onDragStart={handleDragStart}
                    />
                  );
                })}
              </div>
              <div className="w-36 text-right">
                <div className="h-5 border-b border-dashed border-slate-300 mb-1" />
                {["f-vc-name", "f-vc-title"].map((lid) => {
                  const l = getLine(lid);
                  if (!l) return null;
                  return (
                    <CertLine key={l.id} line={l} isSelected={selectedId === l.id}
                      onSelect={() => setSelectedId(l.id)}
                      onUpdate={(upd) => onUpdateLine(l.id, upd)}
                      onDragStart={handleDragStart}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* ─── BACK PAGE ──────────────────────────────── */
          <div className="px-6 py-4 flex flex-col">
            {/* Top-right: barcode area */}
            <div className="self-end mb-2 flex flex-col items-end">
              {/* Visual barcode representation */}
              <div className="bg-white border border-slate-100 p-1 rounded">
                <div className="flex items-end gap-px" style={{ height: "28px", width: "100px" }}>
                  {certNumber.split("").map((ch, i) => {
                    const h = ((ch.charCodeAt(0) % 5) + 3) * 4;
                    return (
                      <div key={i} className="flex gap-px">
                        <div style={{ width: "2px", height: `${h}px`, background: "#1e293b" }} />
                        <div style={{ width: "1px", height: `${Math.floor(h * 0.6)}px`, background: "#1e293b" }} />
                      </div>
                    );
                  })}
                </div>
              </div>
              <span className="text-[8px] font-mono text-slate-500 mt-0.5">{certNumber}</span>
            </div>

            {/* ── SINHALA SECTION ── */}
            <div className="mb-2 space-y-0.5">
              {["b-si-univ", "b-si-preamble", "b-si-date", "b-si-conv", "b-si-date2", "b-si-degree", "b-si-suffix"].map((lid) => {
                const l = getLine(lid);
                if (!l) return null;
                return (
                  <CertLine key={l.id} line={l} isSelected={selectedId === l.id}
                    onSelect={() => setSelectedId(l.id)}
                    onUpdate={(upd) => onUpdateLine(l.id, upd)}
                    onDragStart={handleDragStart}
                  />
                );
              })}

              {/* Sinhala signature columns */}
              <div className="flex justify-between items-end pt-1 border-t border-slate-200/50 mt-1">
                <div className="w-32">
                  <div className="h-4 border-b border-dashed border-slate-200 mb-0.5" />
                  {["b-si-reg-name", "b-si-reg-title"].map((lid) => {
                    const l = getLine(lid);
                    if (!l) return null;
                    return (
                      <CertLine key={l.id} line={l} isSelected={selectedId === l.id}
                        onSelect={() => setSelectedId(l.id)}
                        onUpdate={(upd) => onUpdateLine(l.id, upd)}
                        onDragStart={handleDragStart}
                      />
                    );
                  })}
                </div>
                <div className="w-40 text-right">
                  <div className="h-4 border-b border-dashed border-slate-200 mb-0.5" />
                  {["b-si-vc-name", "b-si-vc-title"].map((lid) => {
                    const l = getLine(lid);
                    if (!l) return null;
                    return (
                      <CertLine key={l.id} line={l} isSelected={selectedId === l.id}
                        onSelect={() => setSelectedId(l.id)}
                        onUpdate={(upd) => onUpdateLine(l.id, upd)}
                        onDragStart={handleDragStart}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Whitespace separator */}
            <div className="py-2" />

            {/* ── TAMIL SECTION ── */}
            <div className="space-y-0.5">
              {["b-ta-univ", "b-ta-preamble", "b-ta-date1", "b-ta-cont", "b-ta-degree", "b-ta-date2", "b-ta-cont2", "b-ta-suffix"].map((lid) => {
                const l = getLine(lid);
                if (!l) return null;
                return (
                  <CertLine key={l.id} line={l} isSelected={selectedId === l.id}
                    onSelect={() => setSelectedId(l.id)}
                    onUpdate={(upd) => onUpdateLine(l.id, upd)}
                    onDragStart={handleDragStart}
                  />
                );
              })}

              {/* Tamil signature columns */}
              <div className="flex justify-between items-end pt-1 border-t border-slate-200/50 mt-1">
                <div className="w-32">
                  <div className="h-4 border-b border-dashed border-slate-200 mb-0.5" />
                  {["b-ta-reg-name", "b-ta-reg-title"].map((lid) => {
                    const l = getLine(lid);
                    if (!l) return null;
                    return (
                      <CertLine key={l.id} line={l} isSelected={selectedId === l.id}
                        onSelect={() => setSelectedId(l.id)}
                        onUpdate={(upd) => onUpdateLine(l.id, upd)}
                        onDragStart={handleDragStart}
                      />
                    );
                  })}
                </div>
                <div className="w-40 text-right">
                  <div className="h-4 border-b border-dashed border-slate-200 mb-0.5" />
                  {["b-ta-vc-name", "b-ta-vc-title"].map((lid) => {
                    const l = getLine(lid);
                    if (!l) return null;
                    return (
                      <CertLine key={l.id} line={l} isSelected={selectedId === l.id}
                        onSelect={() => setSelectedId(l.id)}
                        onUpdate={(upd) => onUpdateLine(l.id, upd)}
                        onDragStart={handleDragStart}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Canvas helper tip */}
      <p className="text-center text-[10px] text-slate-400 mt-2 font-medium">
        Click any line to edit • Drag ⠿ handle to move vertically
      </p>
    </div>
  );
};

// ─── Main CertificateLayoutManager component ────────────────────────────────────

interface CertificateLayoutManagerProps {
  layoutConfig: any;
  layoutLoading: boolean;
  activeConvocationYear: string;
  onSave: () => void;
  onReset: () => void;
  onUpdateField: (key: string, value: any) => void;
  loading: boolean;
}

const CertificateLayoutManager: React.FC<CertificateLayoutManagerProps> = ({
  layoutConfig,
  layoutLoading,
  activeConvocationYear,
  onSave,
  onReset,
  onUpdateField,
  loading,
}) => {
  const [activeView, setActiveView] = useState<CertView>("internal-front");

  // Build the lines config from layoutConfig
  // We store certLines in layoutConfig.certLines, falling back to DEFAULT_CERT_LINES
  const getCertLines = useCallback((): CertLayoutLines => {
    if (layoutConfig?.certLines) {
      // Merge with defaults for any missing ids
      const merge = (defaults: CertLineConfig[], saved: CertLineConfig[]): CertLineConfig[] => {
        return defaults.map((def) => {
          const found = saved.find((s) => s.id === def.id);
          return found ? { ...def, ...found } : def;
        });
      };
      return {
        internalFront: merge(DEFAULT_CERT_LINES.internalFront, layoutConfig.certLines.internalFront ?? []),
        externalFront: merge(DEFAULT_CERT_LINES.externalFront, layoutConfig.certLines.externalFront ?? []),
        internalBack: merge(DEFAULT_CERT_LINES.internalBack, layoutConfig.certLines.internalBack ?? []),
        externalBack: merge(DEFAULT_CERT_LINES.externalBack, layoutConfig.certLines.externalBack ?? []),
      };
    }
    return DEFAULT_CERT_LINES;
  }, [layoutConfig]);

  const certLines = getCertLines();

  const getActiveLines = (): CertLineConfig[] => {
    return certLines[activeView.replace("-", "") as keyof CertLayoutLines] ??
      certLines[activeView === "internal-front" ? "internalFront" : activeView === "external-front" ? "externalFront" : activeView === "internal-back" ? "internalBack" : "externalBack"];
  };

  const getActiveLinesKey = (): keyof CertLayoutLines => {
    if (activeView === "internal-front") return "internalFront";
    if (activeView === "external-front") return "externalFront";
    if (activeView === "internal-back") return "internalBack";
    return "externalBack";
  };

  const handleUpdateLine = useCallback((id: string, updates: Partial<CertLineConfig>) => {
    const key: keyof CertLayoutLines =
      activeView === "internal-front" ? "internalFront"
      : activeView === "external-front" ? "externalFront"
      : activeView === "internal-back" ? "internalBack"
      : "externalBack";
    const currentLines = certLines[key];
    const updated = currentLines.map((l) => l.id === id ? { ...l, ...updates } : l);
    const newCertLines = { ...certLines, [key]: updated };
    onUpdateField("certLines", newCertLines);
  }, [certLines, activeView, onUpdateField]);

  const views: { id: CertView; label: string; short: string }[] = [
    { id: "internal-front", label: "Internal Certificate — Front", short: "Int. Front" },
    { id: "internal-back", label: "Internal Certificate — Back", short: "Int. Back" },
    { id: "external-front", label: "External Certificate — Front", short: "Ext. Front" },
    { id: "external-back", label: "External Certificate — Back", short: "Ext. Back" },
  ];

  if (layoutLoading || !layoutConfig) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
        <span className="text-xs font-bold text-slate-500">Loading certificate configuration...</span>
      </div>
    );
  }

  const activeLines = getActiveLines();
  const isFrontView = activeView.includes("front");

  return (
    <div className="flex flex-col gap-4">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Certificate Layout Manager</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Click any text to edit • Drag ⠿ handles to reposition lines • Cohort: {activeConvocationYear}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={onReset}
            variant="outline"
            className="border-slate-200 dark:border-slate-800 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 h-9 rounded-xl font-bold"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            Reset
          </Button>
          <Button
            onClick={onSave}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-9 rounded-xl font-bold shadow-lg shadow-blue-500/10 flex items-center gap-1.5"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save Layout
          </Button>
        </div>
      </div>

      {/* 4-view tab selector */}
      <div className="flex gap-1 bg-slate-100/70 dark:bg-slate-950/60 p-1 rounded-xl border border-slate-200 dark:border-slate-900">
        {views.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setActiveView(v.id)}
            className={`flex-1 py-2 px-2 text-[11px] font-extrabold rounded-lg transition-all text-center leading-tight ${
              activeView === v.id
                ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            {v.short}
          </button>
        ))}
      </div>

      {/* Active view label */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
          Editing:
        </span>
        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
          {views.find((v) => v.id === activeView)?.label}
        </span>
        <span className="ml-auto text-[9px] text-slate-400 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-800">
          {isFrontView ? "A4 Portrait — English" : "A4 Portrait — Sinhala + Tamil"}
        </span>
      </div>

      {/* Canvas centered */}
      <div className="flex justify-center overflow-x-auto pb-4">
        <div className="relative">
          {/* Canvas label badge */}
          <span className="absolute -top-2 left-3 z-10 bg-slate-800 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-md tracking-widest shadow">
            Interactive Canvas
          </span>

          <CertCanvas
            view={activeView}
            lines={activeLines}
            onUpdateLine={handleUpdateLine}
            certNumber="001542"
          />
        </div>
      </div>
    </div>
  );
};

export default CertificateLayoutManager;
