import React, { useState, useRef } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { Upload, FileText, AlertTriangle, CheckCircle, XCircle, Activity, ThumbsUp, ThumbsDown, ArrowRight, RefreshCw, Leaf, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AnalysisResult {
  productSummary: string;
  nutritionAnalysis: {
    caloriesLevel: string;
    fatLevel: string;
    sugarLevel: string;
    saltSodiumLevel: string;
    proteinLevel: string;
  };
  advantages: string[];
  disadvantages: string[];
  healthRisks: string[];
  suitableFor: string[];
  shouldAvoid: string[];
  additiveAnalysis: string[];
  healthScore: {
    score: number;
    explanation: string;
  };
  betterAlternative: string;
}

const systemInstruction = `You are a professional food scientist, nutritionist, and health advisor.
Analyze the provided food label text or image of a packaged product.
Your job is to deeply analyze the ingredients and nutrition values and provide a complete health evaluation.

RULES:
- Be accurate and realistic
- If data is unclear, make intelligent assumptions
- Keep explanation simple and practical
- Avoid generic answers
- Think like a real nutrition expert`;

const promptTemplate = `Analyze the following food label. Provide a complete health evaluation following the requested JSON schema.`;

const fileToGenerativePart = async (file: File) => {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });
  return {
    inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
  };
};

export default function App() {
  const [inputText, setInputText] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    if (!inputText.trim() && !imageFile) {
      setError("Please provide either text or an image of the food label.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const parts: any[] = [];
      if (imageFile) {
        const base64Data = await fileToGenerativePart(imageFile);
        parts.push(base64Data);
      }
      if (inputText.trim()) {
        parts.push({ text: `INPUT TEXT:\n${inputText}` });
      }
      parts.push({ text: promptTemplate });

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: { parts },
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              productSummary: { type: Type.STRING },
              nutritionAnalysis: {
                type: Type.OBJECT,
                properties: {
                  caloriesLevel: { type: Type.STRING, enum: ["Low", "Moderate", "High", "Unknown"] },
                  fatLevel: { type: Type.STRING, enum: ["Low", "Moderate", "High", "Unknown"] },
                  sugarLevel: { type: Type.STRING, enum: ["Low", "Moderate", "High", "Unknown"] },
                  saltSodiumLevel: { type: Type.STRING, enum: ["Low", "Moderate", "High", "Unknown"] },
                  proteinLevel: { type: Type.STRING, enum: ["Low", "Moderate", "High", "Unknown"] }
                },
                required: ["caloriesLevel", "fatLevel", "sugarLevel", "saltSodiumLevel", "proteinLevel"]
              },
              advantages: { type: Type.ARRAY, items: { type: Type.STRING } },
              disadvantages: { type: Type.ARRAY, items: { type: Type.STRING } },
              healthRisks: { type: Type.ARRAY, items: { type: Type.STRING } },
              suitableFor: { type: Type.ARRAY, items: { type: Type.STRING } },
              shouldAvoid: { type: Type.ARRAY, items: { type: Type.STRING } },
              additiveAnalysis: { type: Type.ARRAY, items: { type: Type.STRING } },
              healthScore: {
                type: Type.OBJECT,
                properties: {
                  score: { type: Type.NUMBER },
                  explanation: { type: Type.STRING }
                },
                required: ["score", "explanation"]
              },
              betterAlternative: { type: Type.STRING }
            },
            required: [
              "productSummary", "nutritionAnalysis", "advantages", "disadvantages",
              "healthRisks", "suitableFor", "shouldAvoid", "additiveAnalysis",
              "healthScore", "betterAlternative"
            ]
          }
        }
      });

      const jsonStr = response.text;
      if (jsonStr) {
        const parsed = JSON.parse(jsonStr);
        setResult(parsed);
      } else {
        setError("Failed to generate analysis. Please try again.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred during analysis.");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setInputText('');
    setImageFile(null);
    setImagePreview(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-emerald-200">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-600">
            <Leaf className="w-6 h-6" />
            <h1 className="text-xl font-bold tracking-tight">NutriScan</h1>
          </div>
          {result && (
            <button
              onClick={reset}
              className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              New Scan
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          {!result ? (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-2xl mx-auto space-y-8"
            >
              <div className="text-center space-y-3">
                <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                  Analyze Your Food Label
                </h2>
                <p className="text-slate-500 text-lg">
                  Paste the OCR text or upload an image of the nutrition label to get a professional health evaluation.
                </p>
              </div>

              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-6">
                
                {/* Image Upload Area */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Upload Label Image (Optional)
                  </label>
                  <div 
                    className={`border-2 border-dashed rounded-2xl p-6 transition-colors ${imagePreview ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-300 hover:border-emerald-400 bg-slate-50'}`}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      ref={fileInputRef}
                      onChange={handleImageUpload}
                    />
                    
                    {imagePreview ? (
                      <div className="relative flex flex-col items-center">
                        <img src={imagePreview} alt="Preview" className="max-h-48 rounded-lg shadow-sm mb-4 object-contain" />
                        <button 
                          onClick={() => { setImageFile(null); setImagePreview(null); }}
                          className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow-md text-slate-500 hover:text-red-500"
                        >
                          <XCircle className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="text-sm text-emerald-600 font-medium hover:text-emerald-700"
                        >
                          Change Image
                        </button>
                      </div>
                    ) : (
                      <div 
                        className="flex flex-col items-center justify-center cursor-pointer text-slate-500 hover:text-emerald-600"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <ImageIcon className="w-10 h-10 mb-3 text-slate-400" />
                        <p className="text-sm font-medium">Click to upload an image</p>
                        <p className="text-xs text-slate-400 mt-1">PNG, JPG up to 5MB</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="relative flex items-center py-2">
                  <div className="flex-grow border-t border-slate-200"></div>
                  <span className="flex-shrink-0 mx-4 text-slate-400 text-sm font-medium">AND / OR</span>
                  <div className="flex-grow border-t border-slate-200"></div>
                </div>

                {/* Text Input Area */}
                <div>
                  <label htmlFor="ocr-text" className="block text-sm font-medium text-slate-700 mb-2">
                    Paste Extracted Text
                  </label>
                  <textarea
                    id="ocr-text"
                    rows={6}
                    className="w-full rounded-2xl border border-slate-300 p-4 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow resize-none bg-slate-50"
                    placeholder="e.g., Nutrition Facts Serving Size 1 cup (228g) Calories 250 Total Fat 12g..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                  />
                </div>

                {error && (
                  <div className="p-4 bg-red-50 text-red-700 rounded-xl flex items-start gap-3 text-sm">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <p>{error}</p>
                  </div>
                )}

                <button
                  onClick={handleAnalyze}
                  disabled={loading || (!inputText.trim() && !imageFile)}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Analyzing Label...
                    </>
                  ) : (
                    <>
                      <Activity className="w-5 h-5" />
                      Analyze Nutrition
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Score & Summary Header */}
              <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 flex flex-col md:flex-row gap-8 items-center md:items-start">
                <div className="flex-shrink-0 flex flex-col items-center">
                  <ScoreCircle score={result.healthScore.score} />
                  <span className="text-sm font-medium text-slate-500 mt-3 uppercase tracking-wider">Health Score</span>
                </div>
                <div className="flex-grow text-center md:text-left space-y-4">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">Product Summary</h2>
                    <p className="text-slate-600 leading-relaxed text-lg">
                      {result.productSummary}
                    </p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm text-slate-700 italic">
                    <span className="font-semibold not-italic text-slate-900 mr-2">Verdict:</span>
                    {result.healthScore.explanation}
                  </div>
                </div>
              </div>

              {/* Nutrition Levels Grid */}
              <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200">
                <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-emerald-600" />
                  Nutrition Levels
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <LevelBadge label="Calories" level={result.nutritionAnalysis.caloriesLevel} type="neutral" />
                  <LevelBadge label="Fat" level={result.nutritionAnalysis.fatLevel} type="bad" />
                  <LevelBadge label="Sugar" level={result.nutritionAnalysis.sugarLevel} type="bad" />
                  <LevelBadge label="Sodium" level={result.nutritionAnalysis.saltSodiumLevel} type="bad" />
                  <LevelBadge label="Protein" level={result.nutritionAnalysis.proteinLevel} type="good" />
                </div>
              </div>

              {/* Detailed Analysis Masonry */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <div className="space-y-6">
                  <ListCard 
                    title="Advantages" 
                    items={result.advantages} 
                    icon={ThumbsUp} 
                    colorClass="bg-emerald-100 text-emerald-600" 
                  />
                  <ListCard 
                    title="Suitable For" 
                    items={result.suitableFor} 
                    icon={CheckCircle} 
                    colorClass="bg-blue-100 text-blue-600" 
                  />
                  <ListCard 
                    title="Additives & Preservatives" 
                    items={result.additiveAnalysis} 
                    icon={Activity} 
                    colorClass="bg-purple-100 text-purple-600" 
                  />
                </div>
                <div className="space-y-6">
                  <ListCard 
                    title="Disadvantages" 
                    items={result.disadvantages} 
                    icon={ThumbsDown} 
                    colorClass="bg-amber-100 text-amber-600" 
                  />
                  <ListCard 
                    title="Health Risks" 
                    items={result.healthRisks} 
                    icon={AlertTriangle} 
                    colorClass="bg-red-100 text-red-600" 
                  />
                  <ListCard 
                    title="Should Avoid" 
                    items={result.shouldAvoid} 
                    icon={XCircle} 
                    colorClass="bg-rose-100 text-rose-600" 
                  />
                </div>
              </div>

              {/* Better Alternative */}
              {result.betterAlternative && (
                <div className="bg-emerald-50 rounded-3xl p-6 sm:p-8 border border-emerald-100 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                  <div className="bg-emerald-100 p-3 rounded-2xl text-emerald-600 flex-shrink-0">
                    <ArrowRight className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-emerald-900 mb-1">Healthier Alternative</h3>
                    <p className="text-emerald-800">{result.betterAlternative}</p>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

// Helper Components

const ScoreCircle = ({ score }: { score: number }) => {
  let color = "text-emerald-500";
  let bgColor = "bg-emerald-50";
  let strokeColor = "#10b981";
  
  if (score < 40) {
    color = "text-red-500";
    bgColor = "bg-red-50";
    strokeColor = "#ef4444";
  } else if (score < 70) {
    color = "text-amber-500";
    bgColor = "bg-amber-50";
    strokeColor = "#f59e0b";
  }

  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center w-32 h-32">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
        <circle
          className="text-slate-100 stroke-current"
          strokeWidth="8"
          cx="50"
          cy="50"
          r={radius}
          fill="transparent"
        ></circle>
        <motion.circle
          className={`${color} stroke-current`}
          strokeWidth="8"
          strokeLinecap="round"
          cx="50"
          cy="50"
          r={radius}
          fill="transparent"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        ></motion.circle>
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className={`text-4xl font-black ${color}`}>{score}</span>
      </div>
    </div>
  );
};

const LevelBadge = ({ label, level, type }: { label: string, level: string, type: 'bad' | 'good' | 'neutral' }) => {
  let colorClass = "bg-slate-100 text-slate-700 border-slate-200";
  
  if (level === "Low") {
    colorClass = type === 'bad' ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200";
    if (type === 'neutral') colorClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
  } else if (level === "Moderate") {
    colorClass = "bg-amber-50 text-amber-700 border-amber-200";
  } else if (level === "High") {
    colorClass = type === 'bad' ? "bg-red-50 text-red-700 border-red-200" : "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (type === 'neutral') colorClass = "bg-amber-50 text-amber-700 border-amber-200";
  }

  return (
    <div className="flex flex-col p-4 rounded-2xl bg-slate-50 border border-slate-100 items-center text-center justify-center">
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{label}</span>
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold border ${colorClass}`}>
        {level}
      </span>
    </div>
  );
}

const ListCard = ({ title, items, icon: Icon, colorClass }: { title: string, items: string[], icon: any, colorClass: string }) => {
  if (!items || items.length === 0) return null;
  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
      <div className="flex items-center gap-3 mb-5">
        <div className={`p-2.5 rounded-xl ${colorClass}`}>
          <Icon size={20} />
        </div>
        <h3 className="font-bold text-slate-800 text-lg">{title}</h3>
      </div>
      <ul className="space-y-3">
        {items.map((item, idx) => (
          <li key={idx} className="flex items-start gap-3 text-slate-600 leading-relaxed">
            <span className="text-slate-300 mt-1">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
