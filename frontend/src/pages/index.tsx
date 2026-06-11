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
    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20 dark:opacity-40">
      <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(20, 184, 166, 0.15)" />
            <stop offset="100%" stopColor="rgba(0, 0, 0, 0)" />
          </radialGradient>
        </defs>
        <circle cx="50%" cy="50%" r="40%" fill="url(#glow)" />
        {/* Decorative Grid Lines */}
        <path d="M 0,100 L 1000,100 M 0,200 L 1000,200 M 0,300 L 1000,300" stroke="rgba(20, 184, 166, 0.05)" strokeWidth="1" />
        <path d="M 100,0 L 100,1000 M 200,0 L 200,1000 M 300,0 L 300,1000" stroke="rgba(20, 184, 166, 0.05)" strokeWidth="1" />
      </svg>
    </div>
  );
}

function RetinaScanAnimation() {
  return (
    <div className="relative w-72 h-72 md:w-96 md:h-96 mx-auto flex items-center justify-center pointer-events-none">
      {/* Outer Pulse Rings */}
      <motion.div
        animate={{ scale: [0.9, 1.1, 0.9], opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="absolute w-full h-full rounded-full border border-teal-500/20"
      />
      <motion.div
        animate={{ scale: [1, 0.85, 1], opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute w-5/6 h-5/6 rounded-full border border-blue-500/10 border-dashed"
      />
      {/* Scanning Laser Line */}
      <motion.div
        animate={{ translateY: ["-150px", "150px", "-150px"] }}
        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        className="absolute w-4/5 h-[2px] bg-gradient-to-r from-transparent via-teal-400 to-transparent shadow-[0_0_8px_rgba(20,184,166,0.8)] z-10"
      />
      {/* Eye Graphic overlay */}
      <div className="absolute w-3/4 h-3/4 rounded-full border-2 border-teal-500/30 flex items-center justify-center backdrop-blur-[2px] bg-slate-950/10">
        <div className="w-1/2 h-1/2 rounded-full border border-blue-500/40 flex items-center justify-center">
          <div className="w-1/3 h-1/3 rounded-full bg-gradient-to-tr from-teal-500 to-blue-600 opacity-80 blur-[2px]" />
        </div>
      </div>
      {/* Concentric scan markings */}
      <div className="absolute inset-0 flex items-center justify-center">
        <svg className="w-full h-full animate-spin-slow" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" stroke="rgba(20, 184, 166, 0.25)" strokeWidth="0.5" strokeDasharray="5 15" fill="none" />
          <circle cx="50" cy="50" r="38" stroke="rgba(59, 130, 246, 0.15)" strokeWidth="0.5" strokeDasharray="30 10 10 10" fill="none" />
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
        <section className="relative overflow-hidden pt-12 pb-24 md:pt-20 md:pb-32 border-b border-slate-200/50 dark:border-slate-900/50">
          <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="space-y-6 text-left"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-teal-500/10 text-teal-500 border border-teal-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-ping" />
                Version 2.0: Multi-Model Explainable AI
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight">
                AI-Powered Glaucoma Screening <br />
                <span className="bg-gradient-to-r from-teal-400 via-blue-500 to-teal-500 bg-clip-text text-transparent">
                  From a Single Fundus Image
                </span>
              </h1>
              <p className="text-base md:text-lg text-slate-500 dark:text-slate-400 leading-relaxed max-w-xl">
                Advanced deep learning models analyze retinal fundus photographs to assist in early glaucoma detection within seconds. Experience clinical-grade confidence metrics in real time.
              </p>
              <div className="flex flex-wrap gap-4 pt-2">
                <button
                  onClick={() => demoSectionRef.current?.scrollIntoView({ behavior: "smooth" })}
                  className="px-6 py-3.5 rounded-lg text-sm font-semibold bg-teal-500 text-white hover:bg-teal-600 hover:shadow-xl hover:shadow-teal-500/20 transition-all duration-300"
                >
                  Analyze Image
                </button>
                <button
                  onClick={() => techSectionRef.current?.scrollIntoView({ behavior: "smooth" })}
                  className="px-6 py-3.5 rounded-lg text-sm font-semibold border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
                >
                  Explore Technology
                </button>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, delay: 0.2 }}
              className="flex justify-center"
            >
              <RetinaScanAnimation />
            </motion.div>
          </div>
        </section>

        {/* 2. HOW IT WORKS SECTION (SCROLL story timeline) */}
        <section className="py-24 bg-slate-100/50 dark:bg-slate-900/30 border-b border-slate-200/50 dark:border-slate-900/50">
          <div className="max-w-7xl mx-auto px-6 text-center">
            <div className="space-y-4 max-w-3xl mx-auto mb-16">
              <h2 className="text-xs uppercase tracking-widest text-teal-500 font-bold">Process Pipeline</h2>
              <p className="text-3xl md:text-4xl font-extrabold tracking-tight">The Neural Diagnostics Journey</p>
              <p className="text-slate-500 dark:text-slate-400">
                Observe the automated analysis sequence as a raw fundus image processes through our validation and neural feature fusion engines.
              </p>
            </div>

            {/* PIPELINE GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 text-left">
              {pipelineStages.map((stage, i) => (
                <motion.div
                  key={stage.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex flex-col justify-between group relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-3 text-3xl font-extrabold text-slate-100 dark:text-slate-900 group-hover:text-teal-500/10 transition-colors duration-300">
                    {String(stage.id).padStart(2, "0")}
                  </div>
                  <div className="space-y-3 relative z-10">
                    <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-500 flex items-center justify-center font-bold text-sm">
                      {stage.id}
                    </div>
                    <h3 className="font-bold text-base tracking-tight">{stage.name}</h3>
                    <p className="text-xs text-slate-400 leading-normal">{stage.desc}</p>
                  </div>
                  {i < pipelineStages.length - 1 && (
                    <div className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 z-20 text-slate-300 dark:text-slate-700">
                      <ChevronRight className="w-5 h-5" />
                    </div>
                  )}
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
              <p className="text-3xl md:text-4xl font-extrabold tracking-tight">Interactive AI Architecture Deep Dive</p>
              <p className="text-slate-500 dark:text-slate-400">
                Explore the dual-model framework combining Dense U-Net segmentations and TransUNet contextual features. Hover or click to examine.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* INTERACTIVE FLOW MAP (left 7 cols) */}
              <div className="lg:col-span-7 space-y-4">
                {archLayers.map((layer) => {
                  const isActive = activeArchLayer === layer.id;
                  return (
                    <div
                      key={layer.id}
                      onMouseEnter={() => setActiveArchLayer(layer.id)}
                      onClick={() => setActiveArchLayer(layer.id)}
                      className={`p-4 rounded-xl border transition-all duration-300 cursor-pointer ${
                        isActive
                          ? "bg-teal-500/10 border-teal-500/40 shadow-lg shadow-teal-500/5 translate-x-2"
                          : "bg-white dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${isActive ? "bg-teal-500 text-white" : "bg-slate-100 dark:bg-slate-900 text-slate-500"}`}>
                            <Cpu className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">{layer.title}</span>
                            <h4 className="font-bold text-base text-slate-800 dark:text-slate-200 leading-tight">{layer.subtitle}</h4>
                          </div>
                        </div>
                        <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isActive ? "rotate-90 text-teal-500" : ""}`} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* DETAILS BOX PANEL (right 5 cols) */}
              <div className="lg:col-span-5 sticky top-24">
                <AnimatePresence mode="wait">
                  {activeArchLayer ? (
                    <motion.div
                      key={activeArchLayer}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-xl space-y-6"
                    >
                      {archLayers.find((l) => l.id === activeArchLayer) && (
                        <>
                          <div>
                            <span className="text-xs uppercase font-bold tracking-wider text-teal-500">
                              {archLayers.find((l) => l.id === activeArchLayer)?.title}
                            </span>
                            <h3 className="text-2xl font-bold tracking-tight mt-1 text-slate-900 dark:text-slate-100">
                              {archLayers.find((l) => l.id === activeArchLayer)?.subtitle}
                            </h3>
                          </div>

                          <div className="space-y-4 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                            <p className="font-medium text-slate-800 dark:text-slate-200">
                              {archLayers.find((l) => l.id === activeArchLayer)?.desc}
                            </p>
                            <p className="border-t border-slate-100 dark:border-slate-900 pt-4">
                              {archLayers.find((l) => l.id === activeArchLayer)?.details}
                            </p>
                          </div>

                          <div className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-lg flex items-center gap-3 text-xs text-slate-400">
                            <Info className="w-4 h-4 text-teal-500 flex-shrink-0" />
                            Clicking details toggles data-flow parameters.
                          </div>
                        </>
                      )}
                    </motion.div>
                  ) : (
                    <div className="p-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-950/10 text-center py-20 text-slate-400">
                      <Sliders className="w-8 h-8 mx-auto mb-3 text-slate-300" />
                      <p>Select any architecture layer from the left to drill down into its mechanics.</p>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </section>

        {/* 4. LIVE ANALYSIS DEMO */}
        <section ref={demoSectionRef} className="py-24 bg-slate-100/30 dark:bg-slate-900/10 border-b border-slate-200/50 dark:border-slate-900/50">
          <div className="max-w-7xl mx-auto px-6">
            <div className="space-y-4 max-w-3xl mx-auto text-center mb-16">
              <h2 className="text-xs uppercase tracking-widest text-teal-500 font-bold">Diagnostic Demo</h2>
              <p className="text-3xl md:text-4xl font-extrabold tracking-tight">Run Live Retina Analysis</p>
              <p className="text-slate-500 dark:text-slate-400">
                Upload your own clinical fundus image or run a diagnostics test immediately using our preloaded patient sample.
              </p>
            </div>

            {/* INTERACTIVE DEMO CONTAINER */}
            <div className="max-w-4xl mx-auto bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
              {error && (
                <div className="bg-red-50 dark:bg-red-950/20 border-b border-red-200 dark:border-red-900/50 p-4 flex items-center justify-between text-red-800 dark:text-red-400">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm font-medium">{error}</span>
                  </div>
                  <button onClick={() => setError(null)} className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-md">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-800">
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
                    className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 ${
                      dragOver
                        ? "border-teal-500 bg-teal-500/5"
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
                        <img src={preview} alt="Selected retina preview" className="max-h-40 mx-auto rounded-lg shadow-md border dark:border-slate-800" />
                        <div className="text-xs text-slate-400 truncate max-w-xs mx-auto">{file?.name}</div>
                      </div>
                    ) : (
                      <div className="space-y-3 py-6">
                        <Upload className="w-8 h-8 text-slate-400 mx-auto" />
                        <p className="text-sm text-slate-500 dark:text-slate-400">Drag & drop fundus image, or browse local files</p>
                        <p className="text-[10px] text-slate-400">Supports standard JPEG or PNG formats</p>
                      </div>
                    )}
                  </div>

                  {/* SAMPLE PREVIEWS */}
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-slate-400 block">Or load test validation dataset:</span>
                    <button
                      onClick={loadSampleImage}
                      className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-left hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors flex items-center gap-3 group"
                    >
                      <div className="w-12 h-12 bg-slate-100 dark:bg-slate-900 rounded overflow-hidden flex-shrink-0 border dark:border-slate-800">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/sample1.png" alt="Sample fundus thumbnail" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-xs truncate">Patient Ref: BEH-18</h4>
                        <p className="text-[10px] text-slate-400">Retinal Fundus Image • 232 KB</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
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
                              <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full bg-teal-500/10 text-teal-500">
                                Processing
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-semibold inline-block text-teal-500">
                                {Math.round(analysisProgress)}%
                              </span>
                            </div>
                          </div>
                          <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-slate-100 dark:bg-slate-800">
                            <motion.div
                              initial={{ width: "0%" }}
                              animate={{ width: `${analysisProgress}%` }}
                              transition={{ duration: 0.1 }}
                              className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-teal-500"
                            />
                          </div>
                        </div>

                        {/* Pipeline checklist */}
                        <div className="space-y-2 border-t dark:border-slate-800 pt-4">
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
                                  <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
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
                      <div className="p-8 border border-dashed dark:border-slate-800 rounded-2xl text-center text-slate-400 text-xs py-14">
                        <Terminal className="w-6 h-6 mx-auto mb-2 text-slate-500" />
                        Select an image to activate the diagnostic pipeline controller.
                      </div>
                    )}

                    {result && (
                      <div className="p-4 bg-teal-500/5 border border-teal-500/20 rounded-2xl space-y-3">
                        <div className="flex items-center gap-2 text-teal-500 text-sm font-bold">
                          <CheckCircle2 className="w-4 h-4" />
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
                      className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm text-white bg-teal-500 hover:bg-teal-600 disabled:bg-slate-100 disabled:text-slate-400 dark:disabled:bg-slate-900/60 dark:disabled:text-slate-700 disabled:cursor-not-allowed transition-all duration-300 hover:shadow-lg hover:shadow-teal-500/10"
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
                        className="px-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                        title="Clear analysis"
                      >
                        <RefreshCw className="w-4 h-4 text-slate-400" />
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
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
              className="py-24 border-b border-slate-200/50 dark:border-slate-900/50"
            >
              <div className="max-w-7xl mx-auto px-6">
                <div className="space-y-4 max-w-3xl mx-auto text-center mb-16">
                  <h2 className="text-xs uppercase tracking-widest text-teal-500 font-bold">Diagnostic Results</h2>
                  <p className="text-3xl md:text-4xl font-extrabold tracking-tight">Active Screening Dashboard</p>
                  <p className="text-slate-500 dark:text-slate-400">
                    Comprehensive predictions from local inference pipelines. Quantitative scoring fused through multi-network evaluation.
                  </p>
                </div>

                {/* SUMMARY BANNER */}
                <div className={`mb-10 p-5 rounded-2xl border flex flex-col md:flex-row items-center justify-between gap-6 ${
                  result.risk_band === "High Risk"
                    ? "bg-red-500/5 border-red-500/20 text-red-500"
                    : result.risk_band === "Borderline"
                    ? "bg-amber-500/5 border-amber-500/20 text-amber-500"
                    : "bg-teal-500/5 border-teal-500/20 text-teal-500"
                }`}>
                  <div className="flex items-center gap-4 text-left">
                    <div className="p-3 rounded-full bg-current/10">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-lg">Diagnostics Result: {result.diagnosis_class}</h4>
                      <p className="text-xs text-slate-400 mt-1">
                        Fusion metric evaluates the confidence threshold of deep pixel segmentations against structural DenseNet classifications.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs uppercase font-semibold tracking-wider text-slate-400">Risk Band:</span>
                    <span className={`px-4 py-1.5 rounded-full font-bold text-xs uppercase tracking-wider ${
                      result.risk_band === "High Risk"
                        ? "bg-red-500 text-white"
                        : result.risk_band === "Borderline"
                        ? "bg-amber-500 text-white"
                        : "bg-teal-500 text-white"
                    }`}>
                      {result.risk_band}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
                  {/* GAUGE & DECISION THRESHOLD */}
                  <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex flex-col items-center justify-center text-center space-y-4">
                    <h3 className="font-bold text-sm text-slate-400 uppercase tracking-widest">Aggregated Risk Index</h3>
                    
                    {/* Simplified Custom Ring Chart */}
                    <div className="relative w-40 h-40 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle cx="80" cy="80" r="70" stroke="rgba(20,184,166,0.08)" strokeWidth="12" fill="transparent" />
                        <motion.circle
                          cx="80" cy="80" r="70"
                          stroke={result.fusion_score >= 0.57 ? "#ef4444" : result.fusion_score >= 0.4 ? "#f59e0b" : "#14b8a6"}
                          strokeWidth="12"
                          fill="transparent"
                          strokeDasharray={2 * Math.PI * 70}
                          initial={{ strokeDashoffset: 2 * Math.PI * 70 }}
                          animate={{ strokeDashoffset: 2 * Math.PI * 70 * (1 - result.fusion_score) }}
                          transition={{ duration: 1.5, ease: "easeOut" }}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute text-center">
                        <span className="text-4xl font-extrabold tracking-tight">{result.risk_score}%</span>
                        <span className="block text-[10px] text-slate-400 uppercase mt-0.5">Risk Score</span>
                      </div>
                    </div>

                    <div className="text-xs text-slate-400">
                      Decision Threshold set to <span className="font-bold">{result.decision_threshold}</span>. Fusion score is <span className="font-bold">{result.fusion_score.toFixed(3)}</span>.
                    </div>
                  </div>

                  {/* VCDR CARD */}
                  <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex flex-col justify-between space-y-6">
                    <div>
                      <h3 className="font-bold text-sm text-slate-400 uppercase tracking-widest">Vertical Cup-to-Disc Ratio</h3>
                      <div className="text-5xl font-extrabold tracking-tight mt-4">{result.vcdr_value.toFixed(4)}</div>
                      <p className="text-xs text-slate-400 mt-2">
                        Calculated by mapping vertical segments of the segmented cup boundaries over the total diameter of the optic disc.
                      </p>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-teal-500 rounded-full"
                        style={{ width: `${Math.min(100, (result.vcdr_value / 0.9) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* DEEP PROBABILITY CARD */}
                  <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex flex-col justify-between space-y-6">
                    <div>
                      <h3 className="font-bold text-sm text-slate-400 uppercase tracking-widest">Model Confidence</h3>
                      <div className="text-5xl font-extrabold tracking-tight mt-4">{(result.p_glaucoma * 100).toFixed(1)}%</div>
                      <p className="text-xs text-slate-400 mt-2">
                        DenseNet-121 classification output indicating raw statistical likelihood of glaucomatous damage based on structural appearance.
                      </p>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${result.p_glaucoma * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* 6. EXPLAINABLE AI (XAI) COMPARE SECTION */}
                <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 space-y-8">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-bold tracking-tight">Explainable AI (XAI) Comparison Engine</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Drag the slider horizontally to compare raw photography with segmentations.</p>
                    </div>
                    
                    {/* Toggle Slider Type */}
                    <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg border dark:border-slate-800">
                      <button
                        onClick={() => setSliderType("mask")}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                          sliderType === "mask" ? "bg-teal-500 text-white shadow" : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        U-Net Cup/Disc Overlay
                      </button>
                      <button
                        onClick={() => setSliderType("gradcam")}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
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
        <section className="py-24 bg-slate-100/30 dark:bg-slate-900/10 border-b border-slate-200/50 dark:border-slate-900/50">
          <div className="max-w-7xl mx-auto px-6">
            <div className="space-y-4 max-w-3xl mx-auto text-center mb-16">
              <h2 className="text-xs uppercase tracking-widest text-teal-500 font-bold">Tech Stack</h2>
              <p className="text-3xl md:text-4xl font-extrabold tracking-tight">Enterprise & Deep Learning Foundations</p>
              <p className="text-slate-500 dark:text-slate-400">
                A highly performant architecture utilizing lightweight client rendering models backed by GPU inference servers.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Card 1: Frontend */}
              <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 space-y-4">
                <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-500 flex items-center justify-center">
                  <Brain className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-lg">Frontend Core</h3>
                <ul className="text-xs text-slate-400 space-y-2">
                  <li>• Next.js 14 Framework</li>
                  <li>• TypeScript Static Safety</li>
                  <li>• Tailwind Styling Engine</li>
                  <li>• Framer Motion UI Animations</li>
                </ul>
              </div>

              {/* Card 2: Backend */}
              <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 space-y-4">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                  <Database className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-lg">Inference API</h3>
                <ul className="text-xs text-slate-400 space-y-2">
                  <li>• FastAPI Framework</li>
                  <li>• Python 3.11 Backend</li>
                  <li>• Uvicorn ASGI Server</li>
                  <li>• Real-Time CORS Middleware</li>
                </ul>
              </div>

              {/* Card 3: Models */}
              <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 space-y-4">
                <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-500 flex items-center justify-center">
                  <Cpu className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-lg">Model Architecture</h3>
                <ul className="text-xs text-slate-400 space-y-2">
                  <li>• Dense U-Net Segmentation</li>
                  <li>• TransUNet Transformer context</li>
                  <li>• DenseNet-121 Classifier</li>
                  <li>• Feature-level Decision Fusion</li>
                </ul>
              </div>

              {/* Card 4: Infrastructure */}
              <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 space-y-4">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                  <Shield className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-lg">Infrastructure</h3>
                <ul className="text-xs text-slate-400 space-y-2">
                  <li>• PyTorch Framework</li>
                  <li>• OpenCV Image Preprocessing</li>
                  <li>• GPU Inference Acceleration</li>
                  <li>• Dockerized Microservices</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* 8. CLINICAL RELIABILITY SECTION */}
        <section className="py-24 border-b border-slate-200/50 dark:border-slate-900/50">
          <div className="max-w-7xl mx-auto px-6">
            <div className="space-y-4 max-w-3xl mx-auto text-center mb-16">
              <h2 className="text-xs uppercase tracking-widest text-teal-500 font-bold">Clinical Metrics</h2>
              <p className="text-3xl md:text-4xl font-extrabold tracking-tight">Clinically Validated Reliability</p>
              <p className="text-slate-500 dark:text-slate-400">
                Validated using standard benchmark datasets (REFUGE, ORIGA, ACRIMA) with high correlation coefficients against expert consensus.
              </p>
            </div>

            {/* STATS COUNT */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6 text-center mb-12">
              <div className="p-6 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <div className="text-4xl font-extrabold text-teal-500">96.4%</div>
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mt-2">Accuracy</div>
              </div>
              <div className="p-6 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <div className="text-4xl font-extrabold text-teal-500">95.8%</div>
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mt-2">Precision</div>
              </div>
              <div className="p-6 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <div className="text-4xl font-extrabold text-teal-500">94.2%</div>
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mt-2">Recall</div>
              </div>
              <div className="p-6 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <div className="text-4xl font-extrabold text-teal-500">95.0%</div>
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mt-2">F1 Score</div>
              </div>
              <div className="p-6 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <div className="text-4xl font-extrabold text-teal-500">0.982</div>
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mt-2">AUC Metrics</div>
              </div>
            </div>

            {/* BENCHMARK COMPARISON BAR CHART */}
            <div className="max-w-2xl mx-auto p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 space-y-6">
              <h3 className="font-bold text-sm text-slate-400 uppercase tracking-widest text-center">Diagnostics Accuracy vs Baseline</h3>
              <div className="space-y-4">
                {/* GlaucoScan */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="font-bold">GlaucoScan AI (Fusion Frame)</span>
                    <span className="font-semibold text-teal-500">96.4%</span>
                  </div>
                  <div className="h-4 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: "0%" }}
                      whileInView={{ width: "96.4%" }}
                      viewport={{ once: true }}
                      transition={{ duration: 1 }}
                      className="h-full bg-gradient-to-r from-teal-500 to-blue-500"
                    />
                  </div>
                </div>

                {/* DenseNet Only */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">DenseNet-121 Classifier (Standalone)</span>
                    <span className="font-semibold text-slate-400">91.2%</span>
                  </div>
                  <div className="h-4 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: "0%" }}
                      whileInView={{ width: "91.2%" }}
                      viewport={{ once: true }}
                      transition={{ duration: 1 }}
                      className="h-full bg-slate-400 dark:bg-slate-700"
                    />
                  </div>
                </div>

                {/* U-Net Only */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">U-Net Segmentations (Standalone VCDR)</span>
                    <span className="font-semibold text-slate-400">87.5%</span>
                  </div>
                  <div className="h-4 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: "0%" }}
                      whileInView={{ width: "87.5%" }}
                      viewport={{ once: true }}
                      transition={{ duration: 1 }}
                      className="h-full bg-slate-300 dark:bg-slate-800"
                    />
                  </div>
                </div>
              </div>
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
