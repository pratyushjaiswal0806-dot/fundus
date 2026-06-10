import { useState, useEffect, useRef, useCallback, type DragEvent, type ChangeEvent } from "react";
import Head from "next/head";
import Link from "next/link";
import { jsPDF } from "jspdf";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Download,
  FileImage,
  Info,
  Loader2,
  Upload,
  X,
} from "lucide-react";

interface AnalysisResult {
  status: string;
  fusion_score: number;
  risk_score: number;
  vcdr_value: number;
  p_glaucoma: number;
  diagnosis_class: "Glaucoma" | "Healthy" | "Glaucoma Suspicion";
  risk_band: "Low Risk" | "Borderline" | "High Risk";
  decision_threshold: number;
  segmentation_mask: string;
  gradcam_heatmap: string;
}

const API_BASE = "http://localhost:8000";

function fusionColor(score: number): string {
  if (score < 0.4) return "#22c55e";
  if (score < 0.57) return "#f59e0b";
  return "#ef4444";
}

function riskBandColor(band: string): string {
  if (band === "Low Risk") return "bg-green-100 text-green-800 border-green-300";
  if (band === "Borderline") return "bg-amber-100 text-amber-800 border-amber-300";
  return "bg-red-100 text-red-800 border-red-300";
}

function ScoreGauge({ score, threshold }: { score: number; threshold: number }) {
  const radius = 90;
  const stroke = 14;
  const cx = 110;
  const cy = 110;
  const startAngle = Math.PI * 0.8;
  const endAngle = Math.PI * 2.2;
  const totalArc = endAngle - startAngle;

  function polarToCartesian(angle: number) {
    return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
  }

  function arcPath(start: number, end: number) {
    const s = polarToCartesian(start);
    const e = polarToCartesian(end);
    const large = end - start > Math.PI ? 1 : 0;
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${large} 1 ${e.x} ${e.y}`;
  }

  const segments = [
    { start: startAngle, end: startAngle + totalArc * 0.39, color: "#22c55e" },
    { start: startAngle + totalArc * 0.39, end: startAngle + totalArc * 0.57, color: "#f59e0b" },
    { start: startAngle + totalArc * 0.57, end: endAngle, color: "#ef4444" },
  ];

  const clampedScore = Math.max(0, Math.min(1, score));
  const needleAngle = startAngle + totalArc * clampedScore;
  const needleTip = polarToCartesian(needleAngle);
  const needleBase1Angle = needleAngle + Math.PI / 2;
  const needleBase2Angle = needleAngle - Math.PI / 2;
  const base1 = { x: cx + 8 * Math.cos(needleBase1Angle), y: cy + 8 * Math.sin(needleBase1Angle) };
  const base2 = { x: cx + 8 * Math.cos(needleBase2Angle), y: cy + 8 * Math.sin(needleBase2Angle) };

  const thresholdAngle = startAngle + totalArc * threshold;
  const threshInner = { x: cx + (radius - 18) * Math.cos(thresholdAngle), y: cy + (radius - 18) * Math.sin(thresholdAngle) };
  const threshOuter = { x: cx + (radius + 18) * Math.cos(thresholdAngle), y: cy + (radius + 18) * Math.sin(thresholdAngle) };

  const diagColor = fusionColor(score);

  return (
    <div className="flex flex-col items-center">
      <svg width="220" height="170" viewBox="0 0 220 180">
        {segments.map((seg, i) => (
          <path
            key={i}
            d={arcPath(seg.start, seg.end)}
            fill="none"
            stroke={seg.color}
            strokeWidth={stroke}
            strokeLinecap="round"
          />
        ))}
        <line
          x1={threshInner.x}
          y1={threshInner.y}
          x2={threshOuter.x}
          y2={threshOuter.y}
          stroke="#374151"
          strokeWidth="2"
          strokeDasharray="4 3"
        />
        <text
          x={threshOuter.x + (threshOuter.x > cx ? 6 : -6)}
          y={threshOuter.y + 4}
          fontSize="10"
          fill="#374151"
          textAnchor={threshOuter.x > cx ? "start" : "end"}
          fontWeight="600"
        >
          0.57
        </text>
        <polygon points={`${needleTip.x},${needleTip.y} ${base1.x},${base1.y} ${cx},${cy} ${base2.x},${base2.y}`} fill="#1e293b" />
        <circle cx={cx} cy={cy} r="6" fill="#1e293b" />
        <circle cx={cx} cy={cy} r="3" fill="#fff" />
      </svg>
      <div className="text-center -mt-3">
        <div className="text-4xl font-bold" style={{ color: diagColor }}>
          {clampedScore.toFixed(3)}
        </div>
        <div className="text-lg font-semibold mt-1" style={{ color: diagColor }}>
          {score < 0.4 ? "Healthy" : score < 0.57 ? "Glaucoma Suspicion" : "Glaucoma"}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [online, setOnline] = useState<boolean | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [showMask, setShowMask] = useState(true);
  const [showGradcam, setShowGradcam] = useState(false);
  const [maskOpacity, setMaskOpacity] = useState(70);
  const [gradcamOpacity, setGradcamOpacity] = useState(50);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const maskImgRef = useRef<HTMLImageElement | null>(null);
  const gradcamImgRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/health`)
      .then((r) => { if (!r.ok) throw new Error("offline"); return r.json(); })
      .then(() => setOnline(true))
      .catch(() => setOnline(false));
  }, []);

  const handleFile = useCallback((f: File) => {
    setError(null);
    setResult(null);
    setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  }, []);

  const onDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && (f.type === "image/jpeg" || f.type === "image/png")) handleFile(f);
  }, [handleFile]);

  const onInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const analyze = useCallback(async () => {
    if (!file) return;
    setAnalyzing(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_BASE}/api/v1/analyze`, { method: "POST", body: form });
      const data = await res.json();
      if (data.status === "error") throw new Error(data.detail || "Analysis failed");
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Request failed");
    } finally {
      setAnalyzing(false);
    }
  }, [file]);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !preview) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const baseImg = imgRef.current;
    if (!baseImg || !baseImg.complete) return;

    canvas.width = baseImg.naturalWidth;
    canvas.height = baseImg.naturalHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(baseImg, 0, 0);

    if (showMask && maskImgRef.current && maskImgRef.current.complete) {
      ctx.globalAlpha = maskOpacity / 100;
      ctx.drawImage(maskImgRef.current, 0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1;
    }
    if (showGradcam && gradcamImgRef.current && gradcamImgRef.current.complete) {
      ctx.globalAlpha = gradcamOpacity / 100;
      ctx.drawImage(gradcamImgRef.current, 0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1;
    }
  }, [preview, showMask, showGradcam, maskOpacity, gradcamOpacity]);

  useEffect(() => {
    if (!preview || !result) return;
    const baseImg = new Image();
    baseImg.crossOrigin = "anonymous";
    baseImg.onload = () => { imgRef.current = baseImg; drawCanvas(); };
    baseImg.src = preview;

    const maskImg = new Image();
    maskImg.onload = () => { maskImgRef.current = maskImg; drawCanvas(); };
    maskImg.src = result.segmentation_mask;

    const gradcamImg = new Image();
    gradcamImg.onload = () => { gradcamImgRef.current = gradcamImg; drawCanvas(); };
    gradcamImg.src = result.gradcam_heatmap;
  }, [preview, result, drawCanvas]);

  useEffect(() => { drawCanvas(); }, [showMask, showGradcam, maskOpacity, gradcamOpacity, drawCanvas]);

  const downloadPdf = useCallback(() => {
    if (!result) return;
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("GlaucoScan AI — Screening Report", 20, 20);
    doc.setFontSize(11);
    doc.text(`Diagnosis: ${result.diagnosis_class}`, 20, 35);
    doc.text(`Risk Band: ${result.risk_band}`, 20, 43);
    doc.text(`Fusion Score: ${result.fusion_score.toFixed(3)}`, 20, 51);
    doc.text(`Risk Score: ${result.risk_score}%`, 20, 59);
    doc.text(`VCDR: ${result.vcdr_value}`, 20, 67);
    doc.text(`P(Glaucoma): ${result.p_glaucoma}`, 20, 75);
    doc.text(`Threshold: ${result.decision_threshold}`, 20, 83);
    doc.text(`Generated locally — not for clinical use`, 20, 100);
    doc.save("glauco_report.pdf");
  }, [result]);

  return (
    <>
      <Head>
        <title>GlaucoScan AI — Clinical Viewer</title>
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* HEADER */}
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between sticky top-0 z-50">
          <div className="flex items-center gap-3">
            <Activity className="w-7 h-7 text-blue-900" />
            <div>
              <h1 className="text-xl font-bold text-blue-900 leading-tight">GlaucoScan AI</h1>
              <p className="text-xs text-gray-500">AI-Assisted Glaucoma Screening — Local PoC v1.3</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
                online === null
                  ? "bg-gray-100 text-gray-500 border-gray-300"
                  : online
                  ? "bg-green-50 text-green-700 border-green-300"
                  : "bg-red-50 text-red-700 border-red-300"
              }`}
            >
              {online === null ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : online ? (
                <CheckCircle2 className="w-3 h-3" />
              ) : (
                <X className="w-3 h-3" />
              )}
              {online === null ? "Checking…" : online ? "System Online" : "Backend Offline"}
            </span>
            <Link
              href="/info"
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <Info className="w-4 h-4" /> Info <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
          {/* ERROR ALERT */}
          {error && (
            <div className="bg-red-50 border border-red-300 rounded-lg p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800">{error}</p>
              </div>
              <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* UPLOAD PANEL */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Upload className="w-5 h-5 text-blue-600" /> Upload Fundus Image
            </h2>
            <div
              onDrop={onDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                dragOver ? "border-blue-400 bg-blue-50" : "border-gray-300 hover:border-blue-300 hover:bg-gray-50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                onChange={onInputChange}
                className="hidden"
              />
              {preview ? (
                <div className="flex flex-col items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt="Preview" className="max-h-48 rounded-lg shadow-sm" />
                  <p className="text-sm text-gray-500">{file?.name}</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-gray-400">
                  <FileImage className="w-12 h-12" />
                  <p className="text-sm">Drag & drop a fundus image, or click to browse</p>
                  <p className="text-xs text-gray-400">JPEG or PNG</p>
                </div>
              )}
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={analyze}
                disabled={!file || analyzing}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Analyzing…
                  </>
                ) : (
                  <>
                    <Activity className="w-4 h-4" /> Analyze
                  </>
                )}
              </button>
              {result && (
                <button
                  onClick={downloadPdf}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  <Download className="w-4 h-4" /> Export PDF
                </button>
              )}
            </div>
          </div>

          {/* RESULTS */}
          {result && (
            <>
              {/* BORDERLINE BANNER */}
              {result.fusion_score >= 0.4 && result.fusion_score < 0.57 && (
                <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <p className="text-sm font-medium text-amber-800">
                    Borderline — Clinical Review Recommended (Score: {result.fusion_score.toFixed(3)})
                  </p>
                </div>
              )}

              {/* GAUGE */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Diagnostic Score</h2>
                <ScoreGauge score={result.fusion_score} threshold={result.decision_threshold} />
              </div>

              {/* METRICS ROW */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 text-center">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">VCDR</p>
                  <p className="text-3xl font-bold text-gray-900">{result.vcdr_value.toFixed(4)}</p>
                  <p className="text-xs text-gray-400 mt-1">Vertical Cup-to-Disc Ratio</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 text-center">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Risk Score</p>
                  <p className="text-3xl font-bold text-gray-900">{result.risk_score}%</p>
                  <p className="text-xs text-gray-400 mt-1">Fusion-based risk estimate</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 text-center">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Risk Band</p>
                  <p className={`text-2xl font-bold mt-1 inline-block px-3 py-1 rounded-lg border ${riskBandColor(result.risk_band)}`}>
                    {result.risk_band}
                  </p>
                </div>
              </div>

              {/* CANVAS OVERLAY VIEWER */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Overlay Viewer</h2>
                <div className="flex flex-col lg:flex-row gap-6">
                  <div className="flex-1 flex justify-center bg-gray-100 rounded-lg p-2 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={preview!}
                      alt="Source"
                      className="hidden"
                      crossOrigin="anonymous"
                    />
                    <canvas
                      ref={canvasRef}
                      className="max-w-full max-h-96 rounded"
                      style={{ imageRendering: "auto" }}
                    />
                  </div>
                  <div className="w-full lg:w-64 space-y-4">
                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showMask}
                          onChange={(e) => setShowMask(e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300"
                        />
                        Segmentation Mask
                      </label>
                      {showMask && (
                        <div className="mt-2 ml-6">
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={maskOpacity}
                            onChange={(e) => setMaskOpacity(Number(e.target.value))}
                            className="w-full accent-blue-600"
                          />
                          <p className="text-xs text-gray-400">{maskOpacity}%</p>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showGradcam}
                          onChange={(e) => setShowGradcam(e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300"
                        />
                        Grad-CAM Heatmap
                      </label>
                      {showGradcam && (
                        <div className="mt-2 ml-6">
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={gradcamOpacity}
                            onChange={(e) => setGradcamOpacity(Number(e.target.value))}
                            className="w-full accent-blue-600"
                          />
                          <p className="text-xs text-gray-400">{gradcamOpacity}%</p>
                        </div>
                      )}
                    </div>
                    <div className="border-t pt-4 mt-4">
                      <p className="text-xs text-gray-400 leading-relaxed">
                        Segmentation overlay: green = optic disc, red = optic cup.
                        <br />
                        Grad-CAM: shows regions driving the DenseNet classification.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
}
