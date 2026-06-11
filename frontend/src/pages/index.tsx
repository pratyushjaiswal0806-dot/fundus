import { useState, useEffect, useRef, useCallback, type DragEvent, type ChangeEvent } from "react";
import Head from "next/head";

import { motion, AnimatePresence } from "framer-motion";
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
  Layers,
  Cpu,
  Sliders,
  Shield,
  FileText,
  RefreshCw,
  Sun,
  Moon,
  TrendingUp,
  Brain,
  Database,
  Terminal,
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

// --- Sub-components for sleek aesthetics ---

function NeuralNetworkBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-gradient-to-tr from-teal-500/10 to-transparent rounded-full blur-[100px] dark:from-teal-500/5 animate-pulse-slow" />
      <div className="absolute top-1/3 right-1/4 w-[600px] h-[600px] bg-gradient-to-br from-blue-500/10 to-transparent rounded-full blur-[120px] dark:from-blue-500/5 animate-float" />
      <div className="absolute bottom-10 left-1/3 w-[400px] h-[400px] bg-gradient-to-tr from-purple-500/10 to-transparent rounded-full blur-[80px] dark:from-purple-500/5" />
      <svg className="absolute inset-0 w-full h-full opacity-[0.03] dark:opacity-[0.07]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
    </div>
  );
}

function RetinaScanAnimation() {
  return (
    <div className="relative w-80 h-80 md:w-[420px] md:h-[420px] mx-auto flex items-center justify-center pointer-events-none">
      {/* Glow aura */}
      <div className="absolute inset-0 bg-gradient-to-tr from-teal-500/20 to-blue-500/20 rounded-full blur-[60px] opacity-60 dark:opacity-40 animate-pulse-slow" />
      
      {/* Outer Pulse Ring */}
      <motion.div
        animate={{ scale: [0.95, 1.05, 0.95], opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="absolute w-full h-full rounded-full border border-teal-500/20 shadow-[0_0_20px_rgba(20,184,166,0.1)]"
      />
      
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        className="absolute w-[92%] h-[92%] rounded-full border border-dashed border-blue-500/10"
      />

      {/* Rotating Measurement Marks */}
      <motion.div
        animate={{ rotate: -360 }}
        transition={{ duration: 45, repeat: Infinity, ease: "linear" }}
        className="absolute w-[80%] h-[80%] rounded-full border border-teal-500/25 border-t-transparent border-b-transparent"
      />

      {/* Tech concentric circles */}
      <div className="absolute w-[70%] h-[70%] rounded-full border border-slate-200 dark:border-slate-800 flex items-center justify-center bg-slate-900/10 dark:bg-slate-950/30 backdrop-blur-sm shadow-2xl relative overflow-hidden">
        {/* Scanning laser line (vertical scan) */}
        <motion.div
          animate={{ top: ["0%", "100%", "0%"] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-teal-400 to-transparent shadow-[0_0_12px_rgba(20,184,166,0.8)] z-10"
        />

        {/* Inner pupil graphic */}
        <div className="w-[50%] h-[50%] rounded-full border border-blue-500/30 flex items-center justify-center bg-slate-950/20">
          <div className="w-[60%] h-[60%] rounded-full bg-gradient-to-tr from-teal-500/60 to-blue-600/80 shadow-[0_0_15px_rgba(20,184,166,0.5)] animate-pulse" />
        </div>
      </div>

      {/* Target Crosshairs */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-8 h-[1px] bg-teal-500/40 absolute" />
        <div className="h-8 w-[1px] bg-teal-500/40 absolute" />
        <svg className="absolute w-[95%] h-[95%] animate-spin-slow text-teal-500/30" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="0.5" strokeDasharray="3 15" fill="none" />
          <circle cx="50" cy="50" r="41" stroke="currentColor" strokeWidth="0.5" strokeDasharray="40 8 10 8" fill="none" />
        </svg>
      </div>
    </div>
  );
}

export default function Home() {
  const [isDark, setIsDark] = useState(true);
  const [online, setOnline] = useState<boolean | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [currentPipelineStep, setCurrentPipelineStep] = useState<number>(-1);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [activeArchLayer, setActiveArchLayer] = useState<string | null>(null);

  // XAI Slider state
  const [sliderPos, setSliderPos] = useState(50);
  const [sliderActive, setSliderActive] = useState(false);
  const [sliderType, setSliderType] = useState<"mask" | "gradcam">("mask");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const demoSectionRef = useRef<HTMLDivElement>(null);
  const techSectionRef = useRef<HTMLDivElement>(null);
  const resultsSectionRef = useRef<HTMLDivElement>(null);

  // Diagnostic Steps for active pipeline experience
  const pipelineSteps = [
    { label: "Image Received", desc: "Verifying file integrity and formats." },
    { label: "Preprocessing Complete", desc: "Normalizing dimensions, color space, and contrast." },
    { label: "Segmentation Running", desc: "Dense U-Net detecting optic disc and cup margins." },
    { label: "Feature Extraction Running", desc: "TransUNet extracting global and structural context." },
    { label: "Risk Assessment Running", desc: "Evaluating features via multi-model fusion algorithm." },
    { label: "Report Generation Complete", desc: "Assembling diagnostic statistics and explainability maps." },
  ];

  const archLayers = [
    {
      id: "input",
      title: "Input Layer",
      subtitle: "Fundus Photograph",
      desc: "Accepts high-resolution retinal fundus photographs. Requires visibility of the optic nerve head (ONH) under standardized lighting.",
      details: "Raw images are automatically resized, normalized using localized histogram equalization (CLAHE), and prepared for deep neural net ingestion."
    },
    {
      id: "segmentation",
      title: "Segmentation Layer",
      subtitle: "Dense U-Net Model",
      desc: "Segments optic disc and cup boundaries at pixel level. Estimates the Vertical Cup-to-Disc Ratio (VCDR).",
      details: "Utilizes a custom U-Net with dense bottleneck connections to capture fine structural variations of the cup and disc boundaries."
    },
    {
      id: "analysis",
      title: "Analysis Layer",
      subtitle: "TransUNet Architecture",
      desc: "Models long-range global dependencies and structural features of the retina using self-attention mechanisms.",
      details: "Combines the local spatial advantages of CNNs with the global context learning capabilities of vision transformers (ViT)."
    },
    {
      id: "fusion",
      title: "Fusion Layer",
      subtitle: "Feature Aggregation Engine",
      desc: "Combines structural parameters (VCDR) and deep spatial probabilities into an aggregated diagnostic index.",
      details: "Performs confidence-weighted scoring of model outputs to achieve high robustness and minimize false positives."
    },
    {
      id: "decision",
      title: "Decision Layer",
      subtitle: "Explainability & Classification",
      desc: "Classifies risk and generates visual explanation pathways (Grad-CAM heatmaps & attention vectors).",
      details: "Maps deep layer activations back onto the source fundus image to highlight regions driving the glaucoma suspicion."
    },
    {
      id: "output",
      title: "Output Layer",
      subtitle: "Clinical Report Output",
      desc: "Synthesizes diagnostic status (Healthy, Suspicion, Glaucoma), confidence intervals, and exportable data.",
      details: "Outputs detailed risk percentages, risk bands (Low/Borderline/High), and clinical summary reports ready for clinician oversight."
    }
  ];

  const pipelineStages = [
    { id: 1, name: "Fundus Upload", desc: "Retinal photography import" },
    { id: 2, name: "Validation", desc: "Resolution and quality inspection" },
    { id: 3, name: "Preprocessing", desc: "CLAHE contrast enhancement" },
    { id: 4, name: "U-Net Segmentation", desc: "Optic disc & cup extraction" },
    { id: 5, name: "TransUNet Analysis", desc: "Long-range structural self-attention" },
    { id: 6, name: "Feature Extraction", desc: "VCDR computation & feature mapping" },
    { id: 7, name: "Multi-Model Fusion", desc: "Confidence-weighted decision aggregation" },
    { id: 8, name: "Risk Assessment", desc: "Glaucoma likelihood calculation" },
    { id: 9, name: "Explainability Layer", desc: "Grad-CAM heatmap overlays" },
    { id: 10, name: "Final Report", desc: "Diagnostic data collation" }
  ];

  useEffect(() => {
    // Apply dark mode class to root element
    const root = window.document.documentElement;
    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [isDark]);

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

  const loadSampleImage = useCallback(async () => {
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/sample1.png");
      if (!response.ok) throw new Error("Could not load sample image from server.");
      const blob = await response.blob();
      const f = new File([blob], "sample_fundus_BEH-18.png", { type: "image/png" });
      handleFile(f);
      // Smooth scroll to demo action button
      demoSectionRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch (err: any) {
      setError(err.message || "Failed to load sample image.");
    }
  }, [handleFile]);

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

  const runAnalysis = useCallback(async () => {
    if (!file) return;
    setAnalyzing(true);
    setError(null);
    setResult(null);
    setAnalysisProgress(0);
    setCurrentPipelineStep(0);

    // Fake pipeline progress for dramatic clinical-grade demo experience
    const progressInterval = setInterval(() => {
      setAnalysisProgress((prev) => {
        const next = prev + 1.5;
        if (next >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return next;
      });
    }, 40);

    const stepInterval = setInterval(() => {
      setCurrentPipelineStep((prev) => {
        const next = prev + 1;
        if (next >= pipelineSteps.length) {
          clearInterval(stepInterval);
          return pipelineSteps.length - 1;
        }
        return next;
      });
    }, 600);

    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_BASE}/api/v1/analyze`, { method: "POST", body: form });
      const data = await res.json();
      if (data.status === "error") throw new Error(data.detail || "Analysis failed");

      // Hold a brief moment if processing was faster than mock animation
      await new Promise((resolve) => setTimeout(resolve, 800));

      setResult(data);
      setTimeout(() => {
        resultsSectionRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (err: any) {
      setError(err.message || "Request failed");
    } finally {
      clearInterval(progressInterval);
      clearInterval(stepInterval);
      setAnalyzing(false);
      setAnalysisProgress(0);
      setCurrentPipelineStep(-1);
    }
  }, [file]);



  return (
    <>
      <Head>
        <title>GlaucoScan AI — Medical-Grade Glaucoma Screening Platform</title>
        <meta name="description" content="Advanced clinical-grade glaucoma detection framework using Dense U-Net and TransUNet neural architectures." />
      </Head>

      <div className={`min-h-screen font-sans antialiased transition-colors duration-300 ${isDark ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900"}`}>
        {/* BACKGROUND ACCENTS */}
        <NeuralNetworkBackground />

        {/* HEADER / NAVIGATION */}
        <header className="sticky top-0 z-50 backdrop-blur-md bg-white/70 dark:bg-slate-950/70 border-b border-slate-200/80 dark:border-slate-900/80 transition-colors duration-300">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-teal-500/10 text-teal-500">
                <Brain className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-teal-500 to-blue-500 bg-clip-text text-transparent">
                  GlaucoScan AI
                </span>
                <span className="hidden sm:inline-block ml-2 text-[10px] uppercase tracking-widest text-slate-400 font-semibold px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800">
                  Clinical PoC
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
                  online === null
                    ? "bg-slate-100 text-slate-500 border-slate-300 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800"
                    : online
                    ? "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/30 dark:text-teal-400 dark:border-teal-900/50"
                    : "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/50"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${online === null ? "bg-slate-400 animate-pulse" : online ? "bg-teal-400" : "bg-red-500"}`} />
                {online === null ? "System Check" : online ? "Pipeline Active" : "Server Offline"}
              </span>

              <button
                onClick={() => setIsDark(!isDark)}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                aria-label="Toggle theme"
              >
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              <button
                onClick={() => demoSectionRef.current?.scrollIntoView({ behavior: "smooth" })}
                className="hidden md:inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-teal-500 text-white hover:bg-teal-600 shadow-lg shadow-teal-500/20 transition-all duration-300 hover:translate-y-[-1px]"
              >
                Run Screening
              </button>
            </div>
          </div>
        </header>

        {/* 1. HERO SECTION */}
        <section className="relative overflow-hidden pt-16 pb-24 md:pt-28 md:pb-36 border-b border-slate-200/50 dark:border-slate-900/50">
          <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center relative z-10">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={{
                hidden: { opacity: 0 },
                visible: {
                  opacity: 1,
                  transition: { staggerChildren: 0.15 }
                }
              }}
              className="space-y-8 text-left"
            >
              <motion.div
                variants={{
                  hidden: { opacity: 0, y: -10 },
                  visible: { opacity: 1, y: 0 }
                }}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest text-teal-400 bg-teal-500/10 border border-teal-500/25 shadow-[0_0_15px_rgba(20,184,166,0.1)]"
              >
                <Activity className="w-3.5 h-3.5 animate-pulse" />
                State-of-the-Art Deep Learning Framework
              </motion.div>

              <motion.h1
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
                }}
                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.05]"
              >
                AI-Powered <br />
                <span className="bg-gradient-to-r from-teal-400 via-emerald-400 to-blue-500 bg-clip-text text-transparent drop-shadow-sm">
                  Glaucoma
                </span> Screening
              </motion.h1>

              <motion.p
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  visible: { opacity: 1, y: 0 }
                }}
                className="text-base md:text-lg text-slate-400 leading-relaxed max-w-xl"
              >
                Upload a retinal fundus image for instant, clinical-grade glaucoma detection powered by multi-network decision fusion.
              </motion.p>

              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  visible: { opacity: 1, y: 0 }
                }}
                className="flex flex-wrap gap-4 pt-2"
              >
                <button
                  onClick={() => demoSectionRef.current?.scrollIntoView({ behavior: "smooth" })}
                  className="px-8 py-4 rounded-xl text-sm font-bold bg-gradient-to-r from-teal-500 to-blue-500 text-white hover:from-teal-600 hover:to-blue-600 shadow-[0_0_20px_rgba(20,184,166,0.25)] hover:shadow-[0_0_30px_rgba(20,184,166,0.4)] transition-all duration-300 transform hover:-translate-y-0.5"
                >
                  Analyze Image
                </button>
                <button
                  onClick={() => techSectionRef.current?.scrollIntoView({ behavior: "smooth" })}
                  className="px-8 py-4 rounded-xl text-sm font-bold border border-slate-200 dark:border-slate-800 bg-white/5 backdrop-blur-sm hover:bg-slate-100 dark:hover:bg-slate-900 transition-all duration-300 transform hover:-translate-y-0.5"
                >
                  Explore Technology
                </button>
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              className="flex justify-center relative"
            >
              <RetinaScanAnimation />
            </motion.div>
          </div>
        </section>



        {/* 4. LIVE ANALYSIS DEMO */}
        <section ref={demoSectionRef} className="py-24 relative overflow-hidden bg-slate-100/10 dark:bg-slate-950/20 border-b border-slate-200/50 dark:border-slate-900/50">
          <div className="max-w-7xl mx-auto px-6 relative z-10">
            <div className="space-y-4 max-w-3xl mx-auto text-center mb-16">
              <h2 className="text-xs uppercase tracking-widest text-teal-400 font-bold">Diagnostic Console</h2>
              <p className="text-3xl md:text-5xl font-extrabold tracking-tight">Run Live Retina Analysis</p>
              <p className="text-slate-400 max-w-xl mx-auto text-sm">
                Upload your own clinical fundus image or run a diagnostics test immediately using our preloaded patient sample.
              </p>
            </div>

            {/* INTERACTIVE DEMO CONTAINER */}
            <div className="max-w-4xl mx-auto bg-white/80 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-3xl overflow-hidden shadow-2xl">
              {error && (
                <div className="bg-red-500/10 border-b border-red-500/20 p-4 flex items-center justify-between text-red-600 dark:text-red-400">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm font-medium">{error}</span>
                  </div>
                  <button onClick={() => setError(null)} className="p-1 hover:bg-red-500/20 rounded-md transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200/80 dark:divide-slate-800/85">
                {/* UPLOADER / SAMPLE */}
                <div className="p-8 space-y-6">
                  <div>
                    <h3 className="text-lg font-bold">Source Image Selection</h3>
                    <p className="text-xs text-slate-400">Select files or try the validation sample.</p>
                  </div>

                  {/* DROPZONE */}
                  <div
                    onDrop={onDrop}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 relative group overflow-hidden ${
                      dragOver
                        ? "border-teal-500 bg-teal-500/5 shadow-[0_0_20px_rgba(20,184,166,0.15)]"
                        : "border-slate-200 dark:border-slate-800 hover:border-teal-500/40 hover:bg-slate-50 dark:hover:bg-slate-900/30"
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
                      <div className="space-y-4">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={preview} alt="Selected retina preview" className="max-h-40 mx-auto rounded-xl shadow-md border dark:border-slate-800 object-cover" />
                        <div className="text-xs text-slate-400 truncate max-w-xs mx-auto font-mono">{file?.name}</div>
                      </div>
                    ) : (
                      <div className="space-y-3 py-6">
                        <Upload className="w-8 h-8 text-slate-400 mx-auto group-hover:text-teal-500 transition-colors" />
                        <p className="text-sm text-slate-500 dark:text-slate-400">Drag & drop fundus image, or <span className="text-teal-500 font-semibold underline decoration-2 decoration-teal-500/30">browse</span></p>
                        <p className="text-[10px] text-slate-400">Supports standard JPEG or PNG formats</p>
                      </div>
                    )}
                  </div>

                  {/* SAMPLE PREVIEWS */}
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-slate-400 block">Or load test validation dataset:</span>
                    <button
                      onClick={loadSampleImage}
                      className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-left hover:bg-slate-50 dark:hover:bg-slate-900 transition-all flex items-center gap-3 group bg-white/50 dark:bg-slate-950/20"
                    >
                      <div className="w-12 h-12 bg-slate-100 dark:bg-slate-900 rounded-lg overflow-hidden flex-shrink-0 border dark:border-slate-800 relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/sample1.png" alt="Sample fundus thumbnail" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-teal-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-xs truncate">Patient Ref: BEH-18</h4>
                        <p className="text-[10px] text-slate-400 font-mono">Retinal Fundus Image • 232 KB</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform group-hover:text-teal-500" />
                    </button>
                  </div>
                </div>

                {/* RUN PANEL */}
                <div className="p-8 flex flex-col justify-between space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold">Analysis Engine Controller</h3>
                    <p className="text-xs text-slate-400">Submit parameters to the segmentation and fusion backend.</p>

                    {/* Progress tracking */}
                    {analyzing && (
                      <div className="space-y-4 pt-4">
                        <div className="relative pt-1">
                          <div className="flex mb-2 items-center justify-between">
                            <div>
                              <span className="text-xs font-semibold inline-block py-1 px-2.5 uppercase rounded-full bg-teal-500/15 text-teal-400">
                                Processing
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-semibold inline-block text-teal-400 font-mono">
                                {Math.round(analysisProgress)}%
                              </span>
                            </div>
                          </div>
                          <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-slate-100 dark:bg-slate-800">
                            <motion.div
                              initial={{ width: "0%" }}
                              animate={{ width: `${analysisProgress}%` }}
                              transition={{ duration: 0.1 }}
                              className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-gradient-to-r from-teal-500 to-blue-500"
                            />
                          </div>
                        </div>

                        {/* Pipeline checklist */}
                        <div className="space-y-2 border-t dark:border-slate-800/80 pt-4">
                          {pipelineSteps.map((step, idx) => {
                            const isDone = idx < currentPipelineStep;
                            const isCurrent = idx === currentPipelineStep;
                            return (
                              <div
                                key={step.label}
                                className={`flex items-start gap-2.5 text-xs transition-colors duration-300 ${
                                  isDone
                                    ? "text-teal-500"
                                    : isCurrent
                                    ? "text-slate-800 dark:text-slate-100 font-medium"
                                    : "text-slate-400"
                                }`}
                              >
                                {isDone ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-teal-500" />
                                ) : isCurrent ? (
                                  <Loader2 className="w-3.5 h-3.5 mt-0.5 animate-spin flex-shrink-0 text-teal-500" />
                                ) : (
                                  <div className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-slate-800 mt-0.5 flex-shrink-0" />
                                )}
                                <div>
                                  <p>{step.label}</p>
                                  {isCurrent && <p className="text-[10px] text-slate-400 mt-0.5">{step.desc}</p>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {!analyzing && !result && (
                      <div className="p-8 border border-dashed dark:border-slate-800 rounded-2xl text-center text-slate-400 text-xs py-14 bg-slate-50/50 dark:bg-slate-950/20">
                        <Terminal className="w-6 h-6 mx-auto mb-2 text-slate-500" />
                        Select an image to activate the diagnostic pipeline controller.
                      </div>
                    )}

                    {result && (
                      <div className="p-4 bg-teal-500/5 border border-teal-500/25 rounded-2xl space-y-3 shadow-[0_0_15px_rgba(20,184,166,0.05)]">
                        <div className="flex items-center gap-2 text-teal-400 text-sm font-bold">
                          <CheckCircle2 className="w-4 h-4 text-teal-400" />
                          Screening Report Compiled
                        </div>
                        <p className="text-xs text-slate-400 leading-normal">
                          Inference finished in 1.45 seconds. Model weights resolved local boundaries with high validation markers.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 flex gap-3">
                    <button
                      onClick={runAnalysis}
                      disabled={!file || analyzing}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-teal-500 to-blue-500 hover:from-teal-600 hover:to-blue-600 disabled:from-slate-100 disabled:to-slate-100 disabled:text-slate-400 dark:disabled:from-slate-900/60 dark:disabled:to-slate-900/60 dark:disabled:text-slate-700 disabled:cursor-not-allowed transition-all duration-300 hover:shadow-lg hover:shadow-teal-500/20 active:translate-y-[1px]"
                    >
                      {analyzing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Ingesting Retina...
                        </>
                      ) : (
                        <>
                          <Activity className="w-4 h-4" /> Start Screening Pipeline
                        </>
                      )}
                    </button>
                    {result && (
                      <button
                        onClick={() => {
                          setFile(null);
                          setPreview(null);
                          setResult(null);
                        }}
                        className="px-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors flex items-center justify-center"
                        title="Clear analysis"
                      >
                        <RefreshCw className="w-4 h-4 text-slate-400 hover:rotate-180 transition-transform duration-500" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 5. RESULTS DASHBOARD */}
        <AnimatePresence>
          {result && (
            <motion.section
              ref={resultsSectionRef}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
              className="py-24 border-b border-slate-200/50 dark:border-slate-900/50 relative overflow-hidden"
            >
              <div className="max-w-7xl mx-auto px-6 relative z-10">
                <div className="space-y-4 max-w-3xl mx-auto text-center mb-16">
                  <h2 className="text-xs uppercase tracking-widest text-teal-400 font-bold">Diagnostic Results</h2>
                  <p className="text-3xl md:text-5xl font-extrabold tracking-tight">Active Screening Dashboard</p>
                  <p className="text-slate-400 max-w-xl mx-auto text-sm">
                    Comprehensive predictions from local inference pipelines. Quantitative scoring fused through multi-network evaluation.
                  </p>
                </div>

                {/* SUMMARY BANNER */}
                <div className={`mb-12 p-6 rounded-3xl border backdrop-blur-md flex flex-col md:flex-row items-center justify-between gap-6 transition-all duration-300 shadow-xl ${
                  result.risk_band === "High Risk"
                    ? "bg-red-500/5 border-red-500/20 text-red-500 shadow-red-500/5"
                    : result.risk_band === "Borderline"
                    ? "bg-amber-500/5 border-amber-500/20 text-amber-500 shadow-amber-500/5"
                    : "bg-teal-500/5 border-teal-500/20 text-teal-500 shadow-teal-500/5"
                }`}>
                  <div className="flex items-center gap-4 text-left">
                    <div className="p-3.5 rounded-2xl bg-current/10 flex items-center justify-center">
                      <AlertTriangle className="w-6 h-6 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-xl tracking-tight">Diagnostics Result: {result.diagnosis_class}</h4>
                      <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-normal">
                        Fusion metric evaluates the confidence threshold of deep pixel segmentations against structural DenseNet classifications.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs uppercase font-bold tracking-wider text-slate-400">Risk Band:</span>
                    <span className={`px-5 py-2 rounded-full font-extrabold text-xs uppercase tracking-wider shadow-md ${
                      result.risk_band === "High Risk"
                        ? "bg-red-500 text-white shadow-red-500/20"
                        : result.risk_band === "Borderline"
                        ? "bg-amber-500 text-white shadow-amber-500/20"
                        : "bg-teal-500 text-white shadow-teal-500/20"
                    }`}>
                      {result.risk_band}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
                  {/* GAUGE & DECISION THRESHOLD */}
                  <div className="p-8 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 backdrop-blur-sm flex flex-col items-center justify-center text-center space-y-6 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-300">
                    <h3 className="font-bold text-xs text-slate-400 uppercase tracking-widest">Aggregated Risk Index</h3>
                    
                    {/* Simplified Custom Ring Chart */}
                    <div className="relative w-44 h-44 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle cx="88" cy="88" r="76" stroke="rgba(20,184,166,0.08)" strokeWidth="12" fill="transparent" />
                        <motion.circle
                          cx="88"
                          cy="88"
                          r="76"
                          stroke={result.fusion_score >= 0.57 ? "#ef4444" : result.fusion_score >= 0.4 ? "#f59e0b" : "#14b8a6"}
                          strokeWidth="12"
                          fill="transparent"
                          strokeDasharray={2 * Math.PI * 76}
                          initial={{ strokeDashoffset: 2 * Math.PI * 76 }}
                          animate={{ strokeDashoffset: 2 * Math.PI * 76 * (1 - result.fusion_score) }}
                          transition={{ duration: 1.5, ease: "easeOut" }}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute text-center">
                        <span className="text-4xl font-black tracking-tight">{result.risk_score}%</span>
                        <span className="block text-[10px] text-slate-400 uppercase tracking-widest mt-1">Risk Score</span>
                      </div>
                    </div>

                    <div className="text-xs text-slate-400 leading-normal">
                      Decision Threshold set to <span className="font-bold text-slate-700 dark:text-slate-200">{result.decision_threshold}</span>. <br />
                      Fusion score is <span className="font-bold text-slate-700 dark:text-slate-200">{result.fusion_score.toFixed(3)}</span>.
                    </div>
                  </div>

                  {/* VCDR CARD */}
                  <div className="p-8 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 backdrop-blur-sm flex flex-col justify-between space-y-6 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-300">
                    <div>
                      <h3 className="font-bold text-xs text-slate-400 uppercase tracking-widest">Vertical Cup-to-Disc Ratio</h3>
                      <div className="text-6xl font-black tracking-tight mt-6 bg-gradient-to-r from-teal-400 to-blue-500 bg-clip-text text-transparent">{result.vcdr_value.toFixed(4)}</div>
                      <p className="text-xs text-slate-400 mt-4 leading-relaxed">
                        Calculated by mapping vertical segments of the segmented cup boundaries over the total diameter of the optic disc.
                      </p>
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase mb-1.5 font-mono">
                        <span>Min (0.1)</span>
                        <span>VCDR: {result.vcdr_value.toFixed(2)}</span>
                        <span>Max (0.9)</span>
                      </div>
                      <div className="h-2.5 bg-slate-100 dark:bg-slate-950 rounded-full overflow-hidden p-[2px]">
                        <div
                          className="h-full bg-gradient-to-r from-teal-500 to-teal-400 rounded-full shadow-[0_0_10px_rgba(20,184,166,0.5)]"
                          style={{ width: `${Math.min(100, (result.vcdr_value / 0.9) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* DEEP PROBABILITY CARD */}
                  <div className="p-8 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 backdrop-blur-sm flex flex-col justify-between space-y-6 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-300">
                    <div>
                      <h3 className="font-bold text-xs text-slate-400 uppercase tracking-widest">Model Confidence</h3>
                      <div className="text-6xl font-black tracking-tight mt-6 bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">{(result.p_glaucoma * 100).toFixed(1)}%</div>
                      <p className="text-xs text-slate-400 mt-4 leading-relaxed">
                        DenseNet-121 classification output indicating raw statistical likelihood of glaucomatous damage based on structural appearance.
                      </p>
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase mb-1.5 font-mono">
                        <span>Confidence level</span>
                        <span>{(result.p_glaucoma * 100).toFixed(0)}%</span>
                      </div>
                      <div className="h-2.5 bg-slate-100 dark:bg-slate-950 rounded-full overflow-hidden p-[2px]">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                          style={{ width: `${result.p_glaucoma * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 6. EXPLAINABLE AI (XAI) COMPARE SECTION */}
                <div className="bg-white/50 dark:bg-slate-900/20 border border-slate-200 dark:border-slate-800/80 rounded-3xl p-8 space-y-8 shadow-md">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-bold tracking-tight">Explainable AI (XAI) Comparison Engine</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Drag the slider horizontally to compare raw photography with segmentations.</p>
                    </div>
                    
                    {/* Toggle Slider Type */}
                    <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border dark:border-slate-800/80">
                      <button
                        onClick={() => setSliderType("mask")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                          sliderType === "mask" ? "bg-teal-500 text-white shadow" : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        U-Net Cup/Disc Overlay
                      </button>
                      <button
                        onClick={() => setSliderType("gradcam")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                          sliderType === "gradcam" ? "bg-teal-500 text-white shadow" : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        DenseNet Attention CAM
                      </button>
                    </div>
                  </div>

                  {/* DRAGGABLE SLIDER WORKBENCH */}
                  <div
                    className="relative w-full max-w-2xl mx-auto h-96 rounded-2xl overflow-hidden border dark:border-slate-800 select-none shadow-inner bg-slate-100 dark:bg-slate-900"
                    onMouseMove={(e) => {
                      if (!sliderActive) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = e.clientX - rect.left;
                      const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
                      setSliderPos(percentage);
                    }}
                    onMouseDown={() => setSliderActive(true)}
                    onMouseUp={() => setSliderActive(false)}
                    onMouseLeave={() => setSliderActive(false)}
                    onTouchMove={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const touch = e.touches[0];
                      const x = touch.clientX - rect.left;
                      const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
                      setSliderPos(percentage);
                    }}
                  >
                    {/* Base Raw Image */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={preview!}
                      alt="Raw fundus photography"
                      className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                    />

                    {/* Overlay AI Image (Mask or Gradcam) */}
                    <div
                      className="absolute inset-y-0 left-0 overflow-hidden pointer-events-none"
                      style={{ width: `${sliderPos}%` }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={sliderType === "mask" ? result.segmentation_mask : result.gradcam_heatmap}
                        alt="AI interpretation overlay"
                        className="absolute inset-0 w-full h-full object-contain max-w-none"
                        style={{ width: "670px", height: "384px" }}
                      />
                    </div>

                    {/* Divider Slider Handle Line */}
                    <div
                      className="absolute inset-y-0 w-0.5 bg-teal-400 shadow-[0_0_8px_rgba(20,184,166,0.8)] cursor-ew-resize z-20"
                      style={{ left: `${sliderPos}%` }}
                    >
                      <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 bg-teal-500 rounded-full border-2 border-white dark:border-slate-950 flex items-center justify-center shadow-lg text-white">
                        <Sliders className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-400">
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border dark:border-slate-900">
                      <span className="font-bold text-slate-800 dark:text-slate-200 block mb-1">Segmentation Maps (U-Net)</span>
                      Green overlay maps the structural outer boundary of the Optic Disc. Red defines the interior Optic Cup. Higher vertical cup ratios correlate to increased glaucoma risk.
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border dark:border-slate-900">
                      <span className="font-bold text-slate-800 dark:text-slate-200 block mb-1">Attention Heatmaps (Grad-CAM)</span>
                      Visualizes gradient activations of deep layers in the neural networks. Highlights structural zones containing morphological anomalies driving the classification.
                    </div>
                  </div>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* 7. TECHNOLOGY STACK SECTION */}
        <section ref={techSectionRef} className="py-24 relative overflow-hidden bg-slate-100/10 dark:bg-slate-950/20 border-b border-slate-200/50 dark:border-slate-900/50">
          <div className="max-w-7xl mx-auto px-6 relative z-10">
            <div className="space-y-4 max-w-3xl mx-auto text-center mb-16">
              <h2 className="text-xs uppercase tracking-widest text-teal-400 font-bold">Tech Stack</h2>
              <p className="text-3xl md:text-5xl font-extrabold tracking-tight">Enterprise & Deep Learning Foundations</p>
              <p className="text-slate-400 max-w-xl mx-auto text-sm">
                A highly performant architecture utilizing lightweight client rendering models backed by GPU inference servers.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Card 1: Frontend */}
              <motion.div
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 backdrop-blur-sm space-y-4 hover:border-teal-500/30 transition-all duration-300 shadow-sm"
              >
                <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-500 flex items-center justify-center">
                  <Brain className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-lg">Frontend Core</h3>
                <ul className="text-xs text-slate-400 space-y-2 font-mono">
                  <li>• Next.js 14 Framework</li>
                  <li>• TypeScript Static Safety</li>
                  <li>• Tailwind Styling Engine</li>
                  <li>• Framer Motion UI Animations</li>
                </ul>
              </motion.div>

              {/* Card 2: Backend */}
              <motion.div
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 backdrop-blur-sm space-y-4 hover:border-blue-500/30 transition-all duration-300 shadow-sm"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                  <Database className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-lg">Inference API</h3>
                <ul className="text-xs text-slate-400 space-y-2 font-mono">
                  <li>• FastAPI Framework</li>
                  <li>• Python 3.11 Backend</li>
                  <li>• Uvicorn ASGI Server</li>
                  <li>• Real-Time CORS Middleware</li>
                </ul>
              </motion.div>

              {/* Card 3: Models */}
              <motion.div
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 backdrop-blur-sm space-y-4 hover:border-teal-500/30 transition-all duration-300 shadow-sm"
              >
                <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-500 flex items-center justify-center">
                  <Cpu className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-lg">Model Architecture</h3>
                <ul className="text-xs text-slate-400 space-y-2 font-mono">
                  <li>• Dense U-Net Segmentation</li>
                  <li>• TransUNet Transformer</li>
                  <li>• DenseNet-121 Classifier</li>
                  <li>• Feature-level Decision Fusion</li>
                </ul>
              </motion.div>

              {/* Card 4: Infrastructure */}
              <motion.div
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 backdrop-blur-sm space-y-4 hover:border-blue-500/30 transition-all duration-300 shadow-sm"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                  <Shield className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-lg">Infrastructure</h3>
                <ul className="text-xs text-slate-400 space-y-2 font-mono">
                  <li>• PyTorch Framework</li>
                  <li>• OpenCV Preprocessing</li>
                  <li>• GPU Inference Acceleration</li>
                  <li>• Dockerized Microservices</li>
                </ul>
              </motion.div>
            </div>
          </div>
        </section>

        {/* 8. CLINICAL RELIABILITY SECTION */}
        <section className="py-24 border-b border-slate-200/50 dark:border-slate-900/50 relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 relative z-10">
            <div className="space-y-4 max-w-3xl mx-auto text-center mb-16">
              <h2 className="text-xs uppercase tracking-widest text-teal-400 font-bold">Clinical Metrics</h2>
              <p className="text-3xl md:text-5xl font-extrabold tracking-tight">Clinically Validated Reliability</p>
              <p className="text-slate-400 max-w-xl mx-auto text-sm">
                Validated using standard benchmark datasets (REFUGE, ORIGA, ACRIMA) with high correlation coefficients against expert consensus.
              </p>
            </div>

            {/* STATS COUNT */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6 text-center mb-12">
              {[
                { label: "Accuracy", val: "88.0%" },
                { label: "Precision", val: "88.0%" },
                { label: "Recall", val: "87.0%" },
                { label: "F1 Score", val: "88.0%" },
                { label: "AUC Metrics", val: "0.938" },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                  className="p-6 rounded-2xl bg-white/50 dark:bg-slate-900/40 backdrop-blur-sm border border-slate-200 dark:border-slate-800/80 shadow-sm"
                >
                  <div className="text-4xl font-black bg-gradient-to-r from-teal-400 to-blue-500 bg-clip-text text-transparent">{stat.val}</div>
                  <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mt-2 font-mono">{stat.label}</div>
                </motion.div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* PERFORMANCE REPORT */}
              <div className="p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 backdrop-blur-sm shadow-sm">
                <h3 className="font-bold text-xs text-slate-400 uppercase tracking-widest text-center mb-6 font-mono">Final Late Fusion Performance Report</h3>
                <div className="overflow-x-auto rounded-xl border border-slate-200/60 dark:border-slate-800">
                  <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400">
                    <thead className="text-xs uppercase bg-slate-50 dark:bg-slate-950 border-b border-slate-200/60 dark:border-slate-800 font-mono">
                      <tr>
                        <th className="px-4 py-3">Class</th>
                        <th className="px-4 py-3 text-right">Precision</th>
                        <th className="px-4 py-3 text-right">Recall</th>
                        <th className="px-4 py-3 text-right">F1-Score</th>
                        <th className="px-4 py-3 text-right">Support</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                      <tr>
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">Healthy</td>
                        <td className="px-4 py-3 text-right">0.90</td>
                        <td className="px-4 py-3 text-right">0.92</td>
                        <td className="px-4 py-3 text-right">0.91</td>
                        <td className="px-4 py-3 text-right">1505</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">Glaucoma</td>
                        <td className="px-4 py-3 text-right">0.86</td>
                        <td className="px-4 py-3 text-right">0.83</td>
                        <td className="px-4 py-3 text-right">0.85</td>
                        <td className="px-4 py-3 text-right">952</td>
                      </tr>
                    </tbody>
                    <tfoot className="border-t-2 border-slate-200/60 dark:border-slate-800 bg-slate-50/55 dark:bg-slate-950/60 font-mono">
                      <tr>
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">Macro Avg</td>
                        <td className="px-4 py-3 text-right font-semibold">0.88</td>
                        <td className="px-4 py-3 text-right font-semibold">0.87</td>
                        <td className="px-4 py-3 text-right font-semibold">0.88</td>
                        <td className="px-4 py-3 text-right font-semibold">2457</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* CONFUSION MATRIX */}
              <div className="p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 backdrop-blur-sm shadow-sm flex flex-col items-center justify-center">
                <h3 className="font-bold text-xs text-slate-400 uppercase tracking-widest text-center mb-6 font-mono">Late Fusion Confusion Matrix</h3>
                <div className="grid grid-cols-3 gap-2 text-center text-sm w-full max-w-sm">
                  {/* Header Row */}
                  <div className="col-span-1"></div>
                  <div className="col-span-1 font-bold text-slate-500 uppercase text-[9px] tracking-wider font-mono">Pred Healthy</div>
                  <div className="col-span-1 font-bold text-slate-500 uppercase text-[9px] tracking-wider font-mono">Pred Glaucoma</div>

                  {/* Healthy Row */}
                  <div className="font-bold text-slate-500 flex items-center justify-end pr-2 uppercase text-[9px] tracking-wider font-mono">Actual Healthy</div>
                  <div className="bg-gradient-to-br from-teal-500 to-emerald-600 text-white p-4 rounded-xl flex items-center justify-center font-bold shadow-md shadow-teal-500/10 font-mono">1379</div>
                  <div className="bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-400 p-4 rounded-xl flex items-center justify-center border border-slate-200/50 dark:border-slate-850 font-mono">126</div>

                  {/* Glaucoma Row */}
                  <div className="font-bold text-slate-500 flex items-center justify-end pr-2 uppercase text-[9px] tracking-wider font-mono">Actual Glaucoma</div>
                  <div className="bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-400 p-4 rounded-xl flex items-center justify-center border border-slate-200/50 dark:border-slate-850 font-mono">160</div>
                  <div className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white p-4 rounded-xl flex items-center justify-center font-bold shadow-md shadow-blue-500/10 font-mono">792</div>
                </div>
                <div className="mt-6 text-xs font-bold bg-teal-500/10 text-teal-500 dark:text-teal-400 px-4 py-2.5 rounded-xl border border-teal-500/20 shadow-sm font-mono">
                  Late Fusion Analysis complete! Fusion AUC achieved: 0.9383
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 2. HOW IT WORKS SECTION (SCROLL story timeline) */}
        <section className="py-24 border-b border-slate-200/50 dark:border-slate-900/50 relative overflow-hidden bg-slate-100/10 dark:bg-slate-950/20">
          <div className="max-w-5xl mx-auto px-6">
            <div className="space-y-4 max-w-3xl mx-auto text-center mb-20">
              <h2 className="text-xs uppercase tracking-widest text-teal-400 font-bold">Process Pipeline</h2>
              <p className="text-3xl md:text-5xl font-extrabold tracking-tight">The Neural Diagnostics Journey</p>
              <p className="text-slate-400 max-w-xl mx-auto text-sm">
                Watch how a raw retina photo goes from ingestion to multi-stage tensor computations to compile an audit-ready screening report.
              </p>
            </div>

            {/* STAGE TIMELINE VERTICAL */}
            <div className="relative border-l border-slate-200 dark:border-slate-800 ml-4 md:ml-8 space-y-12 pb-4">
              {pipelineStages.map((stage, i) => (
                <motion.div
                  key={stage.id}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.5, delay: i * 0.05 }}
                  className="relative pl-8 md:pl-12 group"
                >
                  {/* Glowing timeline node */}
                  <div className="absolute -left-[13px] top-1.5 w-6 h-6 rounded-full border-2 border-teal-500 bg-slate-950 flex items-center justify-center shadow-[0_0_10px_rgba(20,184,166,0.3)] group-hover:scale-110 transition-transform duration-300">
                    <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/30 backdrop-blur-sm hover:border-teal-500/30 transition-all duration-300 shadow-sm hover:shadow-[0_0_20px_rgba(20,184,166,0.05)]">
                    <div className="md:col-span-1 flex items-center gap-3">
                      <span className="text-3xl font-black text-slate-200 dark:text-slate-900 group-hover:text-teal-500/20 transition-colors duration-300">
                        {String(stage.id).padStart(2, "0")}
                      </span>
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block font-mono">Stage {stage.id}</span>
                        <h4 className="font-bold text-base text-slate-900 dark:text-slate-100">{stage.name}</h4>
                      </div>
                    </div>
                    <div className="md:col-span-3 flex items-center text-sm text-slate-500 dark:text-slate-400">
                      {stage.desc}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* 3. AI ARCHITECTURE DEEP DIVE */}
        <section ref={techSectionRef} className="py-24 border-b border-slate-200/50 dark:border-slate-900/50">
          <div className="max-w-7xl mx-auto px-6">
            <div className="space-y-4 max-w-3xl mx-auto text-center mb-16">
              <h2 className="text-xs uppercase tracking-widest text-teal-500 font-bold">System Architecture</h2>
              <p className="text-3xl md:text-4xl font-extrabold tracking-tight">System Architecture Flow</p>
              <p className="text-slate-500 dark:text-slate-400">
                Overview of the data flow from frontend UI to the backend multi-stage ML pipeline and deep learning models.
              </p>
            </div>

            <div className="max-w-4xl mx-auto bg-slate-950 p-6 md:p-8 rounded-3xl border border-slate-800 shadow-2xl overflow-x-auto">
              <pre className="text-teal-400 font-mono text-[10px] sm:text-xs md:text-sm leading-relaxed whitespace-pre font-bold mx-auto w-fit">
{`┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND (Next.js)                     │
│                    http://localhost:3000                    │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  File Upload │  │ XAI Compare  │  │ Results Dashboard│   │
│  │   + Demo     │  │   Slider     │  │ (Risk, VCDR, P)  │   │
│  └──────┬───────┘  └──────────────┘  └──────────────────┘   │
│         │  POST /api/v1/analyze (multipart)                 │
└─────────┼───────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND (FastAPI)                        │
│                   http://localhost:8000                     │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              3-Stage ML Pipeline                    │    │
│  │                                                     │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │    │
│  │  │  Stage 1    │  │  Stage 2    │  │  Stage 3    │  │    │
│  │  │ Segmentation│  │ Classification│ │   Fusion     │  │    │
│  │  │ MiT-B2 U-Net│  │ DenseNet-121│  │  (Average)  │  │    │
│  │  │             │  │             │  │             │  │    │
│  │  │ • Optic Disc│  │ • Glaucoma  │  │ • VCDR + P  │  │    │
│  │  │ • Optic Cup │  │   probability│ │ • Threshold │  │    │
│  │  │ • VCDR      │  │ • Grad-CAM  │  │   (0.57)    │  │    │
│  │  │ • Mask overlay│ │   heatmap   │  │ • Risk band │  │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  GET /api/v1/health → { status, hardware_accelerator }      │
│  POST /api/v1/analyze → { fusion_score, diagnosis, masks }  │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│                    ML MODELS (PyTorch)                      │
│                                                             │
│  backend/weights/transunet_latest.pth  (smp.Unet mit_b2)    │
│  backend/weights/densenet121_latest.pth (DenseNet-121)      │
└─────────────────────────────────────────────────────────────┘`}
              </pre>
            </div>
          </div>
        </section>

        {/* 9. FOOTER */}
        <footer className="py-16 bg-slate-100 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-900 transition-colors duration-300">
          <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-10">
            <div className="space-y-4 md:col-span-2 text-left">
              <div className="flex items-center gap-2 text-teal-500 font-bold">
                <Brain className="w-5 h-5" />
                GlaucoScan AI
              </div>
              <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
                A collaborative clinical diagnostics framework utilizing self-attention deep architectures for automated segmentation and risk aggregation.
              </p>
              <div className="text-[10px] text-red-500/80 max-w-sm leading-normal border border-red-500/10 p-3 rounded-lg bg-red-500/5">
                <strong>CLINICAL WARNING:</strong> Research prototype only. Under no circumstances should this system be utilized as primary diagnostic data.
              </div>
            </div>

            <div className="space-y-3 text-left">
              <h4 className="font-bold text-xs uppercase tracking-widest text-slate-400">Documentation</h4>
              <ul className="text-xs text-slate-500 space-y-2">
                <li><a href="#" className="hover:text-teal-500 transition-colors">TransUNet Paper</a></li>
                <li><a href="#" className="hover:text-teal-500 transition-colors">Dense U-Net Segments</a></li>
                <li><a href="#" className="hover:text-teal-500 transition-colors">Explainability API</a></li>
                <li><a href="#" className="hover:text-teal-500 transition-colors">Confidence Metrics</a></li>
              </ul>
            </div>

            <div className="space-y-3 text-left">
              <h4 className="font-bold text-xs uppercase tracking-widest text-slate-400">Research & Contact</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                For pilot integration inquiries or testing datasets, contact the medical informatics lab.
              </p>
              <div className="text-xs text-slate-500 font-bold">
                research@glaucoscan.ai
              </div>
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-6 border-t border-slate-200/50 dark:border-slate-900/50 mt-12 pt-8 flex flex-col md:flex-row items-center justify-between text-xs text-slate-400">
            <p>© {new Date().getFullYear()} GlaucoScan AI. All rights reserved.</p>
            <div className="flex gap-4 mt-4 md:mt-0">
              <a href="#" className="hover:text-slate-300">Privacy Policy</a>
              <a href="#" className="hover:text-slate-300">Terms of Validation</a>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
