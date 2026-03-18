'use client';

import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Upload, Wand2, Image as ImageIcon, Search, Loader2, Download, Copy, Check, Sparkles, Key } from 'lucide-react';
import Image from 'next/image';

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

// Constants for options
const ILLUMINATION_STYLES = [
  "Halo Backlit (Resplandor trasero)",
  "Front Lit (Iluminación frontal)",
  "Edge Neon (Neón en los bordes)",
  "Channel Letters (Letras de canal con LED interno)",
  "Marquee Bulbs (Focos estilo marquesina)"
];

const MATERIALS = [
  "Brushed Steel (Acero cepillado)",
  "Gold Acrylic (Acrílico dorado pulido)",
  "Matte Black (Metal negro mate)",
  "White Lacquer (Lacado blanco)",
  "Aged Copper (Cobre envejecido)"
];

const FACADES = [
  "Smooth White Concrete (Concreto blanco liso)",
  "Dark Marble Stone (Piedra de mármol oscuro)",
  "Exposed Brick (Ladrillo aparente)",
  "Wood Slats (Listones de madera)",
  "Glass Curtain Wall (Muro cortina de vidrio)"
];

const TIMES_OF_DAY = [
  "Night (Noche dramática)",
  "Blue Hour (Hora azul/Crepúsculo)",
  "Golden Hour (Hora dorada/Atardecer)",
  "Overcast (Día nublado brillante)"
];

export default function AranStudio() {
  // API Key State
  const [hasApiKey, setHasApiKey] = useState(true);
  const [isCheckingKey, setIsCheckingKey] = useState(true);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio && window.aistudio.hasSelectedApiKey) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(hasKey);
      }
      setIsCheckingKey(false);
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio && window.aistudio.openSelectKey) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true); // Assume success to mitigate race condition
    }
  };

  // State
  const [signText, setSignText] = useState('');
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [illumination, setIllumination] = useState(ILLUMINATION_STYLES[0]);
  const [material, setMaterial] = useState(MATERIALS[0]);
  const [facade, setFacade] = useState(FACADES[0]);
  const [timeOfDay, setTimeOfDay] = useState(TIMES_OF_DAY[0]);

  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);

  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isInspiring, setIsInspiring] = useState(false);

  const [copied, setCopied] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handlers
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setReferenceImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setReferenceImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const copyToClipboard = () => {
    if (!generatedPrompt) return;
    navigator.clipboard.writeText(generatedPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadImage = () => {
    if (!generatedImage) return;
    const a = document.createElement('a');
    a.href = generatedImage;
    a.download = `aran-studio-render-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // AI Functions
  const generatePrompt = async () => {
    setIsGeneratingPrompt(true);
    setGeneratedPrompt('');
    setGeneratedImage(null); // Clear previous image

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });
      const promptParts: any[] = [];

      let baseInstruction = `Eres un experto ingeniero de prompts para generadores de imágenes de IA (Midjourney/DALL-E/Stable Diffusion).
Tu tarea es crear UN SOLO prompt ultra-detallado (un solo párrafo, sin saltos de línea, separado por comas) para generar un render fotorrealista de un anuncio luminoso 3D en la fachada de un edificio.

Parámetros:
- Texto del anuncio: "${signText || 'ARAN STUDIO'}"
- Estilo de iluminación: ${illumination}
- Material de las letras: ${material}
- Tipo de fachada: ${facade}
- Momento del día: ${timeOfDay}
- Estilo de render: Render arquitectónico fotorrealista, hiperdetallado, resolución 8K, calidad cinematográfica, iluminación global, trazado de rayos.
- Cámara: Vista frontal directa o ligeramente en ángulo, nivel de los ojos, lente de 35mm.
`;

      if (referenceImage) {
        baseInstruction += `\nIMPORTANTE: Analiza la imagen adjunta (que contiene texto negro sobre fondo blanco). DEBES extraer el estilo exacto de la fuente, el peso de las letras, el kerning y el carácter del diseño. El render final DEBE replicar exactamente la tipografía de la imagen adjunta, pero convirtiéndola en letras 3D iluminadas según los parámetros anteriores.`;

        const base64Data = referenceImage.split(',')[1];
        const mimeType = referenceImage.split(';')[0].split(':')[1];

        promptParts.push({
          inlineData: {
            data: base64Data,
            mimeType: mimeType
          }
        });
      } else {
        baseInstruction += `\n- Fuente: Tipografía sans-serif geométrica, elegante y moderna, gruesa y legible (ya que no se proporcionó imagen de referencia).`;
      }

      promptParts.push({ text: baseInstruction + "\n\nDevuelve ÚNICAMENTE el prompt en inglés, nada más. No incluyas explicaciones." });

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: { parts: promptParts },
      });

      setGeneratedPrompt(response.text?.trim() || '');
    } catch (error) {
      console.error("Error generating prompt:", error);
      setGeneratedPrompt("Error al generar el prompt. Por favor, revisa tu conexión o intenta de nuevo.");
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  const generateImage = async () => {
    if (!generatedPrompt) return;
    setIsGeneratingImage(true);
    setGeneratedImage(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });
      const parts: any[] = [{ text: generatedPrompt }];

      if (referenceImage) {
        const base64Data = referenceImage.split(',')[1];
        const mimeType = referenceImage.split(';')[0].split(':')[1];
        parts.unshift({
          inlineData: {
            data: base64Data,
            mimeType: mimeType
          }
        });
        parts.push({ text: "CRITICAL: Use the exact font style, shape, and typography from the provided reference image for the text in the 3D sign." });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image-preview',
        contents: { parts: parts },
        config: {
          imageConfig: {
            aspectRatio: "16:9",
            imageSize: "1K"
          }
        }
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          const base64EncodeString = part.inlineData.data;
          const imageUrl = `data:${part.inlineData.mimeType};base64,${base64EncodeString}`;
          setGeneratedImage(imageUrl);
          break;
        }
      }
    } catch (error: any) {
      console.error("Error generating image:", error);
      const errorMsg = error.message || JSON.stringify(error);
      if (errorMsg.includes("Requested entity was not found") || errorMsg.includes("403") || errorMsg.includes("PERMISSION_DENIED")) {
        setHasApiKey(false);
        alert("La API Key seleccionada no tiene permisos o no fue encontrada. Por favor, selecciona una clave de un proyecto con facturación habilitada.");
      } else {
        alert("Hubo un error al generar la imagen. Por favor intenta de nuevo.");
      }
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const getInspiration = async () => {
    setIsInspiring(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: "Busca las tendencias actuales en diseño de letreros luminosos para fachadas comerciales en 2026. Sugiere una combinación elegante de iluminación, material y fachada para un negocio moderno y minimalista. Devuelve la respuesta en un formato corto y conciso, ideal para inspirar un prompt de IA.",
        config: {
          tools: [{ googleSearch: {} }],
        }
      });
      setGeneratedPrompt(`💡 Inspiración basada en tendencias actuales:\n\n${response.text}\n\n---\n(Puedes editar este texto o generar un nuevo prompt basado en tus configuraciones)`);
    } catch (error) {
      console.error("Error getting inspiration:", error);
    } finally {
      setIsInspiring(false);
    }
  };

  if (isCheckingKey) {
    return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }

  if (!hasApiKey) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-100 p-6 font-sans">
        <div className="max-w-md w-full bg-zinc-900/40 border border-white/10 rounded-2xl p-8 text-center space-y-6 shadow-2xl backdrop-blur-xl">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center shadow-inner border border-white/10 mx-auto">
            <Key className="w-8 h-8 text-zinc-300" />
          </div>
          <h1 className="text-2xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-zinc-100 to-zinc-500">ARAN STUDIO</h1>
          <div className="space-y-2">
            <p className="text-sm text-zinc-300">
              Para generar imágenes fotorrealistas de alta calidad, necesitas seleccionar una clave API de Google Cloud.
            </p>
            <p className="text-xs text-zinc-500">
              Asegúrate de que el proyecto tenga facturación habilitada. Consulta la <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="underline hover:text-zinc-300">documentación</a> para más detalles.
            </p>
          </div>
          <button
            onClick={handleSelectKey}
            className="w-full bg-zinc-100 hover:bg-white text-zinc-950 text-sm font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Key className="w-4 h-4" />
            Seleccionar API Key
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-zinc-800">
      {/* Background Glow */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-zinc-800/20 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-zinc-900/40 blur-[120px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/5 bg-zinc-950/50 backdrop-blur-xl sticky top-0">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center shadow-inner border border-white/10">
              <Sparkles className="w-4 h-4 text-zinc-300" />
            </div>
            <h1 className="text-xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-zinc-100 to-zinc-500">
              ARAN STUDIO
            </h1>
          </div>
          <div className="text-xs font-mono text-zinc-500 tracking-widest uppercase">
            3D Signage Generator
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Controls */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Upload Block */}
          <div className="bg-zinc-900/40 backdrop-blur-md border border-white/5 rounded-2xl p-6 shadow-2xl">
            <h2 className="text-sm font-semibold tracking-wider text-zinc-300 uppercase mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
              1. Fuente de Referencia
            </h2>
            <p className="text-xs text-zinc-500 mb-4">
              Sube una imagen con letras negras sobre fondo blanco. Solo extraeremos el estilo de la fuente.
            </p>
            
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative overflow-hidden border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 ${
                isDragging ? 'border-zinc-400 bg-zinc-800/50' : 'border-white/10 hover:border-white/20 hover:bg-zinc-800/30'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                className="hidden"
              />
              
              {referenceImage ? (
                <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-white/10 bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={referenceImage} alt="Reference" className="w-full h-full object-contain" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-xs font-medium bg-black/80 px-3 py-1.5 rounded-full backdrop-blur-sm">
                      Cambiar Imagen
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-zinc-800/50 flex items-center justify-center border border-white/5">
                    <Upload className="w-5 h-5 text-zinc-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-300">Haz clic o arrastra una imagen</p>
                    <p className="text-xs text-zinc-500 mt-1">PNG, JPG (Texto negro, fondo blanco)</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Configuration Block */}
          <div className="bg-zinc-900/40 backdrop-blur-md border border-white/5 rounded-2xl p-6 shadow-2xl space-y-5">
            <h2 className="text-sm font-semibold tracking-wider text-zinc-300 uppercase mb-2 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
              2. Configuración del Anuncio
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Texto del Anuncio</label>
                <input
                  type="text"
                  value={signText}
                  onChange={(e) => setSignText(e.target.value)}
                  placeholder="Ej. ARAN STUDIO"
                  className="w-full bg-zinc-950/50 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Iluminación</label>
                <select
                  value={illumination}
                  onChange={(e) => setIllumination(e.target.value)}
                  className="w-full bg-zinc-950/50 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-500 appearance-none"
                >
                  {ILLUMINATION_STYLES.map(style => <option key={style} value={style}>{style}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Material</label>
                <select
                  value={material}
                  onChange={(e) => setMaterial(e.target.value)}
                  className="w-full bg-zinc-950/50 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-500 appearance-none"
                >
                  {MATERIALS.map(mat => <option key={mat} value={mat}>{mat}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Fachada</label>
                <select
                  value={facade}
                  onChange={(e) => setFacade(e.target.value)}
                  className="w-full bg-zinc-950/50 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-500 appearance-none"
                >
                  {FACADES.map(fac => <option key={fac} value={fac}>{fac}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Momento del Día</label>
                <select
                  value={timeOfDay}
                  onChange={(e) => setTimeOfDay(e.target.value)}
                  className="w-full bg-zinc-950/50 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-500 appearance-none"
                >
                  {TIMES_OF_DAY.map(time => <option key={time} value={time}>{time}</option>)}
                </select>
              </div>
            </div>

            <div className="pt-2 flex gap-3">
              <button
                onClick={getInspiration}
                disabled={isInspiring}
                className="flex-1 bg-zinc-800/50 hover:bg-zinc-800 border border-white/5 text-zinc-300 text-xs font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {isInspiring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Inspiración
              </button>
              <button
                onClick={generatePrompt}
                disabled={isGeneratingPrompt}
                className="flex-[2] bg-zinc-100 hover:bg-white text-zinc-950 text-sm font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
              >
                {isGeneratingPrompt ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                Generar Prompt
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Results */}
        <div className="lg:col-span-7 space-y-6 flex flex-col">
          
          {/* Prompt Result */}
          <div className="bg-zinc-900/40 backdrop-blur-md border border-white/5 rounded-2xl p-6 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold tracking-wider text-zinc-300 uppercase flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                3. Prompt Generado
              </h2>
              <button
                onClick={copyToClipboard}
                disabled={!generatedPrompt}
                className="text-xs flex items-center gap-1.5 text-zinc-400 hover:text-zinc-100 transition-colors disabled:opacity-50"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            
            <textarea
              value={generatedPrompt}
              onChange={(e) => setGeneratedPrompt(e.target.value)}
              placeholder="El prompt generado aparecerá aquí. Puedes editarlo antes de renderizar."
              className="w-full flex-1 min-h-[120px] bg-zinc-950/50 border border-white/10 rounded-xl p-4 text-sm text-zinc-300 leading-relaxed focus:outline-none focus:ring-1 focus:ring-zinc-500 resize-none"
            />

            <div className="mt-4 flex justify-end">
              <button
                onClick={generateImage}
                disabled={!generatedPrompt || isGeneratingImage}
                className="bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-zinc-100 text-sm font-medium py-2.5 px-6 rounded-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGeneratingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                Renderizar Imagen 3D
              </button>
            </div>
          </div>

          {/* Image Result */}
          <div className="bg-zinc-900/40 backdrop-blur-md border border-white/5 rounded-2xl p-6 shadow-2xl flex-1 flex flex-col min-h-[400px]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold tracking-wider text-zinc-300 uppercase flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                4. Resultado Final
              </h2>
              {generatedImage && (
                <button
                  onClick={downloadImage}
                  className="text-xs flex items-center gap-1.5 text-zinc-400 hover:text-zinc-100 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Descargar
                </button>
              )}
            </div>

            <div className="flex-1 bg-zinc-950/50 border border-white/5 rounded-xl overflow-hidden relative flex items-center justify-center">
              {isGeneratingImage ? (
                <div className="flex flex-col items-center gap-4 text-zinc-500">
                  <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
                  <p className="text-sm font-medium animate-pulse">Generando render fotorrealista...</p>
                </div>
              ) : generatedImage ? (
                <div className="relative w-full h-full min-h-[300px]">
                  <Image
                    src={generatedImage}
                    alt="Generated 3D Sign"
                    fill
                    className="object-contain"
                    unoptimized // Required for base64 images
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 text-zinc-600">
                  <ImageIcon className="w-10 h-10 opacity-50" />
                  <p className="text-sm">El render aparecerá aquí</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
