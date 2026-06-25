"use client";
import { useState, useRef, useCallback, DragEvent } from "react";
import { Upload, Download, Trash2, Image, SlidersHorizontal, ChevronLeft } from "lucide-react";
import Link from "next/link";

interface CompressedImage {
  name: string;
  originalSize: number;
  compressedSize: number;
  originalUrl: string;
  compressedUrl: string;
  width: number;
  height: number;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function savings(orig: number, comp: number) {
  return (((orig - comp) / orig) * 100).toFixed(1);
}

export default function ImageCompressorPage() {
  const [quality, setQuality] = useState(75);
  const [results, setResults] = useState<CompressedImage[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const compress = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const originalUrl = e.target?.result as string;
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0);
          const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
          const compressedUrl = canvas.toDataURL(outputType, quality / 100);
          const base64 = compressedUrl.split(",")[1];
          const compressedSize = Math.round((base64.length * 3) / 4);
          setResults((prev) => [
            {
              name: file.name,
              originalSize: file.size,
              compressedSize,
              originalUrl,
              compressedUrl,
              width: img.width,
              height: img.height,
            },
            ...prev,
          ]);
        };
        img.src = originalUrl;
      };
      reader.readAsDataURL(file);
    },
    [quality]
  );

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(compress);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const download = (item: CompressedImage) => {
    const a = document.createElement("a");
    a.href = item.compressedUrl;
    a.download = `compressed_${item.name}`;
    a.click();
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <Link href="/tools" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-violet-600 mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" /> All Tools
      </Link>

      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
          <SlidersHorizontal className="w-5 h-5 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Image Compressor</h1>
      </div>
      <p className="text-slate-500 mb-8">Compress JPG, PNG, WebP images in your browser. No upload. Instant.</p>

      {/* Quality slider */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6 shadow-sm">
        <label className="flex items-center justify-between text-sm font-medium text-slate-700 mb-3">
          <span className="flex items-center gap-2"><SlidersHorizontal className="w-4 h-4" /> Quality</span>
          <span className="text-violet-600 font-bold text-base">{quality}%</span>
        </label>
        <input
          type="range"
          min={10}
          max={100}
          value={quality}
          onChange={(e) => setQuality(Number(e.target.value))}
          className="w-full accent-violet-600"
        />
        <div className="flex justify-between text-xs text-slate-400 mt-1">
          <span>Smaller file</span><span>Best quality</span>
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors mb-8 ${
          dragging ? "border-violet-400 bg-violet-50" : "border-slate-300 hover:border-violet-300 hover:bg-slate-50"
        }`}
      >
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
        <Image className="w-10 h-10 text-slate-400 mx-auto mb-3" />
        <p className="font-semibold text-slate-700 mb-1">Drop images here or click to browse</p>
        <p className="text-sm text-slate-400">JPG, PNG, WebP supported · Multiple files at once</p>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">{results.length} image{results.length > 1 ? "s" : ""} compressed</h2>
            <button onClick={() => setResults([])} className="text-sm text-red-500 hover:text-red-700 flex items-center gap-1">
              <Trash2 className="w-3.5 h-3.5" /> Clear all
            </button>
          </div>
          {results.map((item, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col sm:flex-row gap-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.compressedUrl} alt={item.name} className="w-full sm:w-28 h-28 object-cover rounded-xl border border-slate-100" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 truncate mb-3">{item.name}</p>
                <div className="grid grid-cols-3 gap-3 text-sm mb-4">
                  <div>
                    <p className="text-slate-400 text-xs mb-0.5">Original</p>
                    <p className="font-semibold text-slate-700">{formatBytes(item.originalSize)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs mb-0.5">Compressed</p>
                    <p className="font-semibold text-emerald-600">{formatBytes(item.compressedSize)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-xs mb-0.5">Saved</p>
                    <p className="font-bold text-violet-600">{savings(item.originalSize, item.compressedSize)}%</p>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mb-3">{item.width} × {item.height} px</p>
                <button
                  onClick={() => download(item)}
                  className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
                >
                  <Download className="w-4 h-4" /> Download
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info */}
      <div className="mt-10 bg-slate-100 rounded-2xl p-6 text-sm text-slate-600 space-y-2">
        <p className="font-semibold text-slate-800 mb-2">How it works</p>
        <p>Images are processed entirely in your browser using the HTML5 Canvas API. Nothing is ever sent to a server.</p>
        <p>Adjust the quality slider to balance file size vs. visual quality. 70–80% is usually a sweet spot for photos.</p>
      </div>
    </div>
  );
}
